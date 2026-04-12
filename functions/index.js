const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const { firestore } = require("firebase-functions/v1");
const admin = require("firebase-admin");

admin.initializeApp();

exports.consumeFuel = onCall({
  // Enforce App Check if needed
  enforceAppCheck: false,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const amountToConsume = (request.data && request.data.amount) ? Math.max(1, Number(request.data.amount)) : 1;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
      }

      const userData = userDoc.data();
      const now = Date.now();
      const fuelInventoryRef = userRef.collection('fuel_inventory');

      // 1. Migration & Sync: Ensure all fuel is in the subcollection
      let inventorySnap = await transaction.get(fuelInventoryRef);
      let inventoryDocs = inventorySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // If we have legacy data, migrate it now
      const legacyBalance = Number(userData.fl ?? userData.fuelLevel ?? userData.coinBalance ?? 0);
      const legacyBatches = userData.fuelBatches || userData.coinBatches || [];

      if (legacyBalance > 0 || legacyBatches.length > 0) {
        logger.info(`Migrating legacy fuel for user ${uid}`);
        
        // Convert legacy batches
        legacyBatches.forEach(b => {
          const id = b.id || `migrated_${Math.random().toString(36).substring(7)}`;
          const batchData = {
            a: Number(b.a ?? b.amount ?? b.remaining ?? b.r ?? 1),
            r: Number(b.r ?? b.remaining ?? b.a ?? b.amount ?? 1),
            ca: b.ca ?? b.createdAt ?? now,
            ea: b.ea ?? b.expiresAt ?? (now + 30 * 24 * 60 * 60 * 1000),
            t: b.t ?? b.type ?? 'reward'
          };
          if (batchData.r > 0 && batchData.ea > now) {
            transaction.set(fuelInventoryRef.doc(id), batchData);
            inventoryDocs.push({ id, ...batchData });
          }
        });

        // Convert base balance if not already represented in batches
        if (legacyBalance > (legacyBatches.reduce((s, b) => s + (b.r ?? b.remaining ?? 0), 0))) {
          const diff = legacyBalance - (legacyBatches.reduce((s, b) => s + (b.r ?? b.remaining ?? 0), 0));
          if (diff > 0) {
            const id = `migrated_base_${now}`;
            const baseData = { a: diff, r: diff, ca: now, ea: now + (100 * 365 * 24 * 60 * 60 * 1000), t: 'purchase' };
            transaction.set(fuelInventoryRef.doc(id), baseData);
            inventoryDocs.push({ id, ...baseData });
          }
        }

        // Clear legacy fields
        transaction.update(userRef, {
          fl: admin.firestore.FieldValue.delete(),
          fuelLevel: admin.firestore.FieldValue.delete(),
          coinBalance: admin.firestore.FieldValue.delete(),
          fuelBatches: admin.firestore.FieldValue.delete(),
          coinBatches: admin.firestore.FieldValue.delete(),
          lastActionAt: admin.firestore.FieldValue.delete()
        });
      }

      // 2. Filter & Sort Inventory for consumption
      const validItems = inventoryDocs
        .filter(item => item.ea > now && item.r > 0)
        .sort((a, b) => a.ea - b.ea || a.ca - b.ca); // Priority: Expiring soonest, then oldest

      const totalAvailable = validItems.reduce((sum, item) => sum + item.r, 0);

      if (totalAvailable < amountToConsume) {
        throw new HttpsError('failed-precondition', `Insufficient fuel. Available: ${totalAvailable}`);
      }

      // 3. Consume
      let remainingToConsume = amountToConsume;
      for (const item of validItems) {
        if (remainingToConsume <= 0) break;
        
        const take = Math.min(item.r, remainingToConsume);
        const newRemaining = item.r - take;
        remainingToConsume -= take;

        if (newRemaining <= 0) {
          transaction.delete(fuel_inventoryRef.doc(item.id));
        } else {
          transaction.update(fuelInventoryRef.doc(item.id), { r: newRemaining });
        }
      }

      // 4. Update total level in user doc for quick UI access
      const finalLevel = totalAvailable - amountToConsume;
      transaction.update(userRef, { fl: finalLevel, laa: now });

      logger.info(`Consumed ${amountToConsume} fuel for user ${uid}. Total: ${finalLevel}`);
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in consumeFuel:", error);
    throw new HttpsError('internal', 'An internal error occurred while consuming fuel.');
  }
});
});

exports.grantRewardedFuel = onCall({
  enforceAppCheck: false,
  cors: true,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
      }

      const userData = userDoc.data();
      const now = Date.now();
      const fuelInventoryRef = userRef.collection('fuel_inventory');

      // 1. Cooldown & Limit Checks
      if (userData.lastAdAt && (now - userData.lastAdAt < 60000)) {
        throw new HttpsError('resource-exhausted', 'Please wait 1 minute between ads.');
      }

      const today = new Date().toISOString().split('T')[0];
      let adCount = userData.lastAdDay === today ? (userData.adCount || 0) : 0;
      if (adCount >= 10) {
        throw new HttpsError('resource-exhausted', 'Daily ad limit reached.');
      }

      // 2. Grant Reward
      const requestedAmount = (request.data && request.data.amount) ? Number(request.data.amount) : 1;
      const rewardAmount = Math.max(1, Math.min(requestedAmount, 20));
      
      const batchId = `reward_${now}`;
      const rewardData = {
        a: rewardAmount,
        r: rewardAmount,
        ca: now,
        ea: now + (30 * 24 * 60 * 60 * 1000),
        t: 'reward'
      };

      transaction.set(fuelInventoryRef.doc(batchId), rewardData);

      // 3. Update Sync/Total
      const currentLevel = userData.fl || 0;
      transaction.update(userRef, {
        fl: currentLevel + rewardAmount,
        lastAdAt: now,
        lastAdDay: today,
        adCount: adCount + 1
      });

      logger.info(`Rewarded fuel granted to user ${uid}. Granted: ${rewardAmount}`);
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in grantRewardedFuel:", error);
    throw new HttpsError('internal', 'An internal error occurred while granting fuel reward.');
  }
});

exports.redeemFuelCoupon = onCall({
  enforceAppCheck: false,
  cors: true,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { code } = request.data;
  if (!code) {
    throw new HttpsError('invalid-argument', 'Coupon code is required.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const couponRef = db.collection('coupons').doc(code.trim().toUpperCase());
  const userRef = db.collection('users').doc(uid);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const couponDoc = await transaction.get(couponRef);
      const userDoc = await transaction.get(userRef);

      if (!couponDoc.exists) {
        throw new HttpsError('not-found', 'Invalid coupon code.');
      }

      const couponData = couponDoc.data();
      if (couponData.isConsumed) {
        throw new HttpsError('failed-precondition', 'This coupon has already been used.');
      }

      const userData = userDoc.data();
      const now = Date.now();

      // Anti-abuse: 10-second cooldown
      const lastActionAt = userData.laa ?? userData.lastActionAt;
      if (lastActionAt && (now - lastActionAt < 10000)) {
        throw new HttpsError('resource-exhausted', 'Please wait 10 seconds between redemptions.');
      }

      const amount = Number(couponData.fuelAmount || couponData.coinsAmount || 0);
      const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days
      const newBatch = {
        id: `coupon_${Math.random().toString(36).substring(7)}`,
        a: amount,
        r: amount,
        ca: now,
        ea: expiresAt,
        t: 'coupon'
      };

      let fuelBatches = [];
      const legacyBatches = userData.fuelBatches || userData.coinBatches || [];
      const legacyBalance = Number(userData.fl ?? userData.fuelLevel ?? userData.coinBalance ?? 0);

      if (legacyBatches.length > 0) {
        legacyBatches.forEach(b => {
          fuelBatches.push({
            id: b.id,
            a: Number(b.a ?? b.amount ?? b.remaining ?? b.r ?? 0),
            r: Number(b.r ?? b.remaining ?? 0),
            ca: b.ca ?? b.createdAt ?? now,
            ea: b.ea ?? b.expiresAt ?? (now + 100 * 365 * 24 * 60 * 60 * 1000),
            t: b.t ?? b.type ?? 'legacy'
          });
        });
      } else if (legacyBalance > 0) {
        fuelBatches.push({
          id: `migration_${now}`,
          a: legacyBalance,
          r: legacyBalance,
          ca: now,
          ea: now + (100 * 365 * 24 * 60 * 60 * 1000),
          t: 'coupon'
        });
      }

      const updatedBatches = [...fuelBatches.filter(b => b.ea > now && b.r > 0), newBatch];
      const totalLevel = updatedBatches.reduce((sum, b) => sum + Number(b.r), 0);

      transaction.update(couponRef, {
        isConsumed: true,
        consumedBy: uid,
        consumedAt: now
      });

      const fuelInventoryRef = userRef.collection('fuel_inventory');
      const batchId = `coupon_${Math.random().toString(36).substring(7)}`;
      transaction.set(fuelInventoryRef.doc(batchId), {
        a: amount,
        r: amount,
        ca: now,
        ea: expiresAt,
        t: 'coupon'
      });

      transaction.update(userRef, {
        fl: (userData.fl || 0) + amount,
        laa: now
      });

      return { fuel: amount };

      return { fuel: newBatch.amount };
    });

    return { success: true, message: `Successfully redeemed ${result.fuel} fuel!`, fuel: result.fuel };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in redeemFuelCoupon:", error);
    throw new HttpsError('internal', error.message || 'Error redeeming coupon.');
  }
});

exports.claimFreeFuelGift = onCall({
  enforceAppCheck: false,
  cors: true,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  const couponCode = `FREE-FUEL-${uid.substring(0, 8).toUpperCase()}`;
  const couponRef = db.collection('coupons').doc(couponCode);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
      }

      const userData = userDoc.data();
      if (userData.freeCouponClaimed) {
        throw new HttpsError('already-exists', 'You have already claimed your free fuel gift.');
      }

      const now = Date.now();
      const giftAmount = 50;
      const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days

      const newBatch = {
        id: `free_${Math.random().toString(36).substring(7)}`,
        a: giftAmount,
        r: giftAmount,
        ca: now,
        ea: expiresAt,
        t: 'gift'
      };

      let fuelBatches = [];
      const legacyBatches = userData.fuelBatches || userData.coinBatches || [];
      const legacyBalance = Number(userData.fl ?? userData.fuelLevel ?? userData.coinBalance ?? 0);

      if (legacyBatches.length > 0) {
        legacyBatches.forEach(b => {
          fuelBatches.push({
            id: b.id,
            a: Number(b.a ?? b.amount ?? b.remaining ?? b.r ?? 0),
            r: Number(b.r ?? b.remaining ?? 0),
            ca: b.ca ?? b.createdAt ?? now,
            ea: b.ea ?? b.expiresAt ?? (now + 100 * 365 * 24 * 60 * 60 * 1000),
            t: b.t ?? b.type ?? 'legacy'
          });
        });
      } else if (legacyBalance > 0) {
        fuelBatches.push({
          id: `migration_${now}`,
          a: legacyBalance,
          r: legacyBalance,
          ca: now,
          ea: now + (100 * 365 * 24 * 60 * 60 * 1000),
          t: 'gift'
        });
      }

      const updatedBatches = [...fuelBatches.filter(b => b.ea > now && b.r > 0), newBatch];
      const totalLevel = updatedBatches.reduce((sum, b) => sum + Number(b.r), 0);

      transaction.set(couponRef, {
        code: couponCode,
        fuelAmount: giftAmount,
        isConsumed: true,
        consumedBy: uid,
        consumedAt: now,
        createdAt: now
      });

      const fuelInventoryRef = userRef.collection('fuel_inventory');
      transaction.set(fuelInventoryRef.doc(`free_${Math.random().toString(36).substring(7)}`), {
        a: giftAmount,
        r: giftAmount,
        ca: now,
        ea: expiresAt,
        t: 'gift'
      });

      transaction.update(userRef, {
        fl: (userData.fl || 0) + giftAmount,
        laa: now,
        freeCouponClaimed: true
      });

      return { fuel: giftAmount };
    });

    return { success: true, message: `Successfully claimed ${result.fuel} free fuel!`, fuel: result.fuel };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in claimFreeFuelGift:", error);
    throw new HttpsError('internal', error.message || 'Error claiming free gift.');
  }
});

exports.grantPurchaseFuel = onCall({
  enforceAppCheck: false,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { productId, purchaseToken } = request.data;
  if (!productId) {
    throw new HttpsError('invalid-argument', 'Product ID is required.');
  }

  const FUEL_MAP = {
    'fuel_50': 50,
    'fuel_200': 200,
    'fuel_500': 500,
    'fuel_1000': 1000,
    'fuel_1200': 1200,
    'fuel_50_test': 50,
    // Legacy support for coin IDs
    'coins_50': 50,
    'coins_200': 200,
    'coins_500': 500,
    'coins_1000': 1000,
    'coins_1200': 1200
  };

  let amount = FUEL_MAP[productId];

  if (!amount) {
    const match = productId.match(/(?:fuel|coins)_(\d+)/);
    if (match && match[1]) {
      amount = parseInt(match[1], 10);
    }
  }

  if (!amount) {
    throw new HttpsError('invalid-argument', `Unknown product identifier: ${productId}`);
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  try {
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
      }

      const userData = userDoc.data();
      const expiresAt = now + (100 * 365 * 24 * 60 * 60 * 1000);

      const newBatch = {
        id: `purchase_${productId}_${now}`,
        a: Number(amount),
        r: Number(amount),
        ca: now,
        ea: expiresAt,
        t: 'purchase'
      };

      let fuelBatches = [];
      const legacyBatches = userData.fuelBatches || userData.coinBatches || [];
      const legacyBalance = Number(userData.fl ?? userData.fuelLevel ?? userData.coinBalance ?? 0);

      if (legacyBatches.length > 0) {
        legacyBatches.forEach(b => {
          fuelBatches.push({
            id: b.id,
            a: Number(b.a ?? b.amount ?? b.remaining ?? b.r ?? 0),
            r: Number(b.r ?? b.remaining ?? 0),
            ca: b.ca ?? b.createdAt ?? now,
            ea: b.ea ?? b.expiresAt ?? (now + 100 * 365 * 24 * 60 * 60 * 1000),
            t: b.t ?? b.type ?? 'legacy'
          });
        });
      } else if (legacyBalance > 0) {
        fuelBatches.push({
          id: `migration_${now}`,
          a: legacyBalance,
          r: legacyBalance,
          ca: now,
          ea: now + (100 * 365 * 24 * 60 * 60 * 1000),
          t: 'purchase'
        });
      }

      const fuelInventoryRef = userRef.collection('fuel_inventory');
      transaction.set(fuelInventoryRef.doc(`purchase_${productId}_${now}`), {
        a: Number(amount),
        r: Number(amount),
        ca: now,
        ea: expiresAt,
        t: 'purchase'
      });

      transaction.update(userRef, {
        fl: (userData.fl || 0) + Number(amount),
        laa: now
      });

      logger.info(`Purchased fuel (${amount}) granted to user ${uid}.`);
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in grantPurchaseFuel:", error);
    throw new HttpsError('internal', 'An internal error occurred while granting purchase.');
  }
});

/**
 * Helper to get prioritized FCM tokens for a set of user IDs.
 * Prioritizes native tokens (android/ios) over web tokens to prevent duplicates.
 */
async function getPrioritizedTokens(recipientIds) {
  const db = admin.firestore();
  const tokens = [];

  if (!recipientIds || recipientIds.size === 0) return tokens;

  const usersSnap = await db.collection('users')
    .where(admin.firestore.FieldPath.documentId(), 'in', Array.from(recipientIds))
    .get();

  usersSnap.forEach(userDoc => {
    const userData = userDoc.data();
    const allTokens = userData.fcmTokens || [];

    // Fallback for legacy fcmToken field
    if (userData.fcmToken) {
      allTokens.push({ token: userData.fcmToken, platform: 'unknown' });
    }

    if (allTokens.length === 0) return;

    // Separate tokens by platform
    const nativeTokens = allTokens.filter(t => t.platform === 'android' || t.platform === 'ios');
    const webTokens = allTokens.filter(t => t.platform === 'web');

    // If native tokens exist, only use those (Smart Prioritization)
    if (nativeTokens.length > 0) {
      tokens.push(...nativeTokens.map(t => t.token));
    } else {
      // Otherwise, fallback to web tokens
      tokens.push(...webTokens.map(t => t.token || t)); // Handle both object and legacy string formats
    }
  });

  return tokens;
}

exports.onListUpdateNotification = firestore.document("lists/{listId}").onUpdate(async (change, context) => {
  const newValue = change.after.data();
  const previousValue = change.before.data();

  // Only notify if updatedAt changed
  if (newValue.updatedAt === previousValue.updatedAt) return;

  const db = admin.firestore();
  const listId = context.params.listId;
  const listName = newValue.name;

  // Get all users who should receive the notification: owner + sharedUsers
  const recipientIds = new Set([newValue.ownerId, ...(newValue.sharedUsers || [])]);

  // Remove the person who made the change to avoid self-notification
  if (newValue.lastUpdatedBy) {
    recipientIds.delete(newValue.lastUpdatedBy);
  }

  if (recipientIds.size === 0) return;

  const tokens = await getPrioritizedTokens(recipientIds);

  if (tokens.length === 0) return;

  const message = {
    notification: {
      title: 'List Updated',
      body: `"${listName}" has been updated.`,
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        click_action: 'FCM_PLUGIN_ACTIVITY',
        icon: 'ic_launcher',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
          'content-available': 1,
        },
      },
    },
    data: {
      listId: listId,
    },
    tokens: tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(`Notifications sent: ${response.successCount} success, ${response.failureCount} failure`);
  } catch (error) {
    logger.error("Error sending notifications:", error);
  }
});

exports.onOrderCreatedNotification = firestore.document("orders/{orderId}").onCreate(async (snapshot, context) => {
  const orderData = snapshot.data();
  if (!orderData) return;

  const db = admin.firestore();
  const orderId = context.params.orderId;
  const storeId = orderData.storeId;
  const customerName = orderData.customerName || 'A customer';

  try {
    // 1. Get the store to find the ownerId
    const storeDoc = await db.collection('stores').doc(storeId).get();
    if (!storeDoc.exists) {
      logger.error(`Store ${storeId} not found for order ${orderId}`);
      return;
    }

    const storeData = storeDoc.data();
    const ownerId = storeData.ownerId;
    if (!ownerId) {
      logger.error(`No ownerId found for store ${storeId}`);
      return;
    }

    const tokens = await getPrioritizedTokens(new Set([ownerId]));

    if (tokens.length === 0) {
      logger.info(`No FCM tokens for owner ${ownerId}`);
      return;
    }

    // 3. Send the notification
    const message = {
      notification: {
        title: 'New Order! 🛍️',
        body: `${customerName} just placed an order at your store "${storeData.name}".`,
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          click_action: 'FCM_PLUGIN_ACTIVITY',
          icon: 'ic_launcher',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'content-available': 1,
          },
        },
      },
      data: {
        orderId: orderId,
        type: 'new_order'
      },
      tokens: tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    logger.info(`Order notifications sent: ${response.successCount} success, ${response.failureCount} failure`);
  } catch (error) {
    logger.error("Error in onOrderCreatedNotification:", error);
  }
});

exports.onOrderChatNotification = firestore.document("orders/{orderId}").onUpdate(async (change, context) => {
  const newValue = change.after.data();
  const previousValue = change.before.data();

  // Only notify if chat changed and a new message was added
  const newChat = newValue.chat || [];
  const oldChat = previousValue.chat || [];
  if (newChat.length <= oldChat.length) return;

  const lastMessage = newChat[newChat.length - 1];
  const db = admin.firestore();
  const orderId = context.params.orderId;
  const storeId = newValue.storeId;

  try {
    // Determine recipient: if customer sent message, notify owner. If owner sent message, notify customer.
    let recipientId;
    let senderName;

    if (lastMessage.senderId === newValue.customerId) {
      // Customer sent message -> Notify owner
      const storeDoc = await db.collection('stores').doc(storeId).get();
      recipientId = storeDoc.data()?.ownerId;
      senderName = newValue.customerName || 'Customer';
    } else {
      // Owner sent message -> Notify customer
      recipientId = newValue.customerId;
      senderName = newValue.storeName || 'Store';
    }

    if (!recipientId || recipientId === lastMessage.senderId) return;

    const tokens = await getPrioritizedTokens(new Set([recipientId]));

    if (tokens.length === 0) return;

    const message = {
      notification: {
        title: `Message from ${senderName}`,
        body: lastMessage.text,
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          click_action: 'FCM_PLUGIN_ACTIVITY',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      data: {
        orderId: orderId,
        type: 'chat_message'
      },
      tokens: tokens,
    };

    await admin.messaging().sendEachForMulticast(message);
  } catch (error) {
    logger.error("Error in onOrderChatNotification:", error);
  }
});

exports.processOrder = onCall({
  enforceAppCheck: false,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { orderId, status, deliveryTime } = request.data;
  if (!orderId || !status) {
    throw new HttpsError('invalid-argument', 'Order ID and status are required.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const orderRef = db.collection('orders').doc(orderId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef);
      if (!orderDoc.exists) {
        throw new HttpsError('not-found', 'Order not found.');
      }

      const orderData = orderDoc.data();
      const storeId = orderData.storeId;

      // Get store to verify ownership and cooldown
      const storeDoc = await transaction.get(db.collection('stores').doc(storeId));
      if (!storeDoc.exists) {
        throw new HttpsError('not-found', 'Store not found.');
      }

      const storeData = storeDoc.data();
      if (storeData.ownerId !== uid) {
        throw new HttpsError('permission-denied', 'You do not own this store.');
      }

      const ownerRef = db.collection('users').doc(uid);
      const ownerDoc = await transaction.get(ownerRef);
      const ownerData = ownerDoc.data();
      const now = Date.now();

      // Define engagement states
      const engagedStatus = ['processing', 'out_for_delivery', 'completed'];
      const isEngagement = engagedStatus.includes(status);

      // Handle Fuel Consumption on Engagement
      if (isEngagement && !orderData.engaged) {
        const fuelInventoryRef = ownerRef.collection('fuel_inventory');
        let inventorySnap = await transaction.get(fuelInventoryRef);
        let validItems = inventorySnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(item => item.ea > now && item.r > 0)
          .sort((a, b) => a.ea - b.ea || a.ca - b.ca);

        const totalAvailable = validItems.reduce((sum, item) => sum + item.r, 0);

        if (totalAvailable < 50) {
          throw new HttpsError('failed-precondition', 'Insufficient fuel to engage in this order. (Min 50 required)');
        }

        let remainingToDeduct = 50;
        for (const item of validItems) {
          if (remainingToDeduct <= 0) break;
          const take = Math.min(item.r, remainingToDeduct);
          const newRemaining = item.r - take;
          remainingToDeduct -= take;

          if (newRemaining <= 0) transaction.delete(fuelInventoryRef.doc(item.id));
          else transaction.update(fuelInventoryRef.doc(item.id), { r: newRemaining });
        }

        transaction.update(ownerRef, {
          fl: totalAvailable - 50,
          laa: now
        });

        transaction.update(orderRef, { engaged: true });
        logger.info(`Charged 50 fuel from store owner ${uid}. New level: ${totalAvailable - 50}`);
      }

      // 2. Enforce Delivery Cooldown for Completion
      if (status === 'completed') {
        const minCooldown = (storeData.minDeliveryTime || 0) * 60000; // minutes to ms
        const elapsed = now - orderData.createdAt;
        if (elapsed < minCooldown) {
          const remainingMins = Math.ceil((minCooldown - elapsed) / 60000);
          throw new HttpsError('failed-precondition', `Fraud prevention: Please wait ${remainingMins} more minutes before completing this delivery.`);
        }
      }

      // 3. Update Order Status
      const updateData = {
        status: status,
        updatedAt: now
      };
      if (deliveryTime) updateData.deliveryTime = deliveryTime;

      transaction.update(orderRef, updateData);

      return { success: true };
    });

    return result;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in processOrder:", error);
    throw new HttpsError('internal', 'An error occurred while processing the order.');
  }
});

exports.rateStoreSecure = onCall({
  enforceAppCheck: false,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { storeId, rating } = request.data;
  if (!storeId || typeof rating !== 'number' || rating < 1 || rating > 5) {
    throw new HttpsError('invalid-argument', 'Valid storeId and rating (1-5) are required.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  const storeRef = db.collection('stores').doc(storeId);
  const ratingRef = storeRef.collection('ratings').doc(uid);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const storeDoc = await transaction.get(storeRef);

      if (!userDoc.exists || !storeDoc.exists) {
        throw new HttpsError('not-found', 'User or Store not found.');
      }

      const storeData = storeDoc.data();
      if (storeData.ownerId === uid) {
        throw new HttpsError('permission-denied', 'Store owners cannot rate their own stores.');
      }

      const userData = userDoc.data();
      const now = Date.now();
      const today = new Date().toISOString().split('T')[0];

      // 1. Check Daily Global Limit
      if (userData.lastRatingDate === today) {
        throw new HttpsError('resource-exhausted', 'Fraud prevention: You can only rate one store per day.');
      }

      // 2. (Relaxed) Any authenticated user may rate a store

      const existingRatingDoc = await transaction.get(ratingRef);
      const isNewRating = !existingRatingDoc.exists;
      const oldRating = existingRatingDoc.exists ? existingRatingDoc.data().rating : 0;

      // 5. Fuel Consumption (1 unit)
      const fuelInventoryRef = userRef.collection('fuel_inventory');
      let inventorySnap = await transaction.get(fuelInventoryRef);
      let validItems = inventorySnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => item.ea > now && item.r > 0)
        .sort((a, b) => a.ea - b.ea);

      const totalAvailable = validItems.reduce((sum, item) => sum + item.r, 0);

      if (totalAvailable < 1) {
        throw new HttpsError('failed-precondition', 'Insufficient fuel to submit rating.');
      }

      // Deduct 1 unit
      const topItem = validItems[0];
      if (topItem.r <= 1) transaction.delete(fuelInventoryRef.doc(topItem.id));
      else transaction.update(fuelInventoryRef.doc(topItem.id), { r: topItem.r - 1 });

      // 6. Update User
      transaction.update(userRef, {
        lastRatingDate: today,
        laa: now,
        fl: totalAvailable - 1
      });

      return { success: true };
    });

    return result;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in rateStoreSecure:", error);
    throw new HttpsError('internal', 'An error occurred while submitting your rating.');
  }
});

exports.grantDailyFuelReward = onCall({
  enforceAppCheck: false,
  cors: true,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
      }

      const userData = userDoc.data();
      const now = Date.now();
      const today = new Date().toISOString().split('T')[0];

      // Check if already claimed today
      const lastDailyRewardDay = userData.ldrd || userData.lastDailyRewardDay;
      if (lastDailyRewardDay === today) {
        return { success: false, alreadyClaimed: true };
      }

      const rewardAmount = 1;
      const fuelInventoryRef = userRef.collection('fuel_inventory');
      const batchId = `daily_${now}`;

      transaction.set(fuelInventoryRef.doc(batchId), {
        a: rewardAmount,
        r: rewardAmount,
        ca: now,
        ea: now + (30 * 24 * 60 * 60 * 1000),
        t: 'reward'
      });

      transaction.update(userRef, {
        ldrd: today,
        ldra: now,
        fl: (userData.fl || 0) + rewardAmount
      });

      logger.info(`Daily reward granted. Added: ${rewardAmount}`);
      return { success: true, amount: rewardAmount };
    });

    return result;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in grantDailyFuelReward:", error);
    throw new HttpsError('internal', 'An error occurred while granting daily reward.');
  }
});
