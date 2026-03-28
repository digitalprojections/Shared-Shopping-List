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
    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
      }

      const userData = userDoc.data();
      const now = Date.now();

      // Anti-abuse: 1-second cooldown
      if (userData.lastActionAt && (now - userData.lastActionAt < 1000)) {
        throw new HttpsError('resource-exhausted', 'Please wait 1 second between actions.');
      }

      // Filter valid fuel batches and sort by creation time (FIFO)
      let legacyBatches = userData.fuelBatches || userData.coinBatches || [];
      const legacyBalance = userData.coinBalance || userData.fuelLevel || 0;
      if (legacyBatches.length === 0 && legacyBalance > 0) {
        legacyBatches.push({
          id: `legacy_balance_${now}`,
          amount: legacyBalance,
          remaining: legacyBalance,
          createdAt: now,
          expiresAt: now + (100 * 365 * 24 * 60 * 60 * 1000),
          type: 'legacy_migration'
        });
      }
      let fuelBatches = legacyBatches.map(b => ({ ...b }));

      const validBatches = fuelBatches
        .filter(b => b.expiresAt > now && b.remaining > 0)
        .sort((a, b) => a.createdAt - b.createdAt);

      const currentLevel = validBatches.reduce((sum, b) => sum + b.remaining, 0);

      if (currentLevel < amountToConsume) {
        throw new HttpsError('failed-precondition', 'Insufficient fuel.');
      }

      // Consume fuel across multiple batches if needed
      let remainingToDeduct = amountToConsume;
      for (const batch of validBatches) {
        if (remainingToDeduct <= 0) break;
        
        const deduct = Math.min(batch.remaining, remainingToDeduct);
        batch.remaining -= deduct;
        remainingToDeduct -= deduct;
        
        const index = fuelBatches.findIndex(b => b.id === batch.id);
        if (index !== -1) {
          fuelBatches[index].remaining = batch.remaining;
        }
      }

      // Recalculate total fuel level
      const newLevel = fuelBatches
        .filter(b => b.expiresAt > now)
        .reduce((sum, b) => sum + b.remaining, 0);

      transaction.update(userRef, {
        fuelBatches: fuelBatches,
        fuelLevel: newLevel,
        // Keep legacy fields for backward compatibility during transition if needed
        coinBatches: fuelBatches,
        coinBalance: newLevel,
        lastActionAt: now
      });
      
      logger.info(`Consumed ${amountToConsume} fuel for user ${uid}. New level: ${newLevel}`);
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in consumeFuel:", error);
    throw new HttpsError('internal', 'An internal error occurred while consuming fuel.');
  }
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

      // Cooldown: 1 minute between ads
      if (userData.lastAdAt && (now - userData.lastAdAt < 60000)) {
        throw new HttpsError('resource-exhausted', 'Please wait 1 minute between ads.');
      }

      // Max 10 ads per 24 hours
      const today = new Date().toISOString().split('T')[0];
      let adCount = userData.lastAdDay === today ? (userData.adCount || 0) : 0;

      if (adCount >= 10) {
        throw new HttpsError('resource-exhausted', 'Daily ad limit reached.');
      }

      const requestedAmount = (request.data && request.data.amount) ? Number(request.data.amount) : 1;
      const rewardAmount = Math.max(1, Math.min(requestedAmount, 20));
      const newBatch = {
        id: `reward_${now}`,
        createdAt: now,
        expiresAt: now + (30 * 24 * 60 * 60 * 1000), // 30 days
        remaining: rewardAmount,
        type: 'reward'
      };

      let legacyBatches = userData.fuelBatches || userData.coinBatches || [];
      const legacyBalance = userData.coinBalance || userData.fuelLevel || 0;
      if (legacyBatches.length === 0 && legacyBalance > 0) {
        legacyBatches.push({
          id: `legacy_balance_${now}`,
          amount: legacyBalance,
          remaining: legacyBalance,
          createdAt: now,
          expiresAt: now + (100 * 365 * 24 * 60 * 60 * 1000),
          type: 'legacy_migration'
        });
      }
      const updatedBatches = [...legacyBatches, newBatch];
      const totalLevel = updatedBatches
        .filter(b => b.expiresAt > now)
        .reduce((sum, b) => sum + b.remaining, 0);

      transaction.update(userRef, {
        fuelBatches: updatedBatches,
        fuelLevel: totalLevel,
        coinBatches: updatedBatches,
        coinBalance: totalLevel,
        lastAdAt: now,
        lastAdDay: today,
        adCount: adCount + 1
      });

      logger.info(`Rewarded fuel granted to user ${uid}. New level: ${totalLevel}`);
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
      if (userData.lastActionAt && (now - userData.lastActionAt < 10000)) {
        throw new HttpsError('resource-exhausted', 'Please wait 10 seconds between redemptions.');
      }

      const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days
      const newBatch = {
        id: `coupon_${Math.random().toString(36).substring(7)}`,
        amount: couponData.fuelAmount || couponData.coinsAmount,
        remaining: couponData.fuelAmount || couponData.coinsAmount,
        createdAt: now,
        expiresAt: expiresAt,
        type: 'coupon'
      };

      let legacyBatches = userData.fuelBatches || userData.coinBatches || [];
      const legacyBalance = userData.coinBalance || userData.fuelLevel || 0;
      if (legacyBatches.length === 0 && legacyBalance > 0) {
        legacyBatches.push({
          id: `legacy_balance_${now}`,
          amount: legacyBalance,
          remaining: legacyBalance,
          createdAt: now,
          expiresAt: now + (100 * 365 * 24 * 60 * 60 * 1000),
          type: 'legacy_migration'
        });
      }
      const updatedBatches = [...legacyBatches, newBatch];
      const totalLevel = updatedBatches
        .filter(b => b.expiresAt > now)
        .reduce((sum, b) => sum + b.remaining, 0);

      transaction.update(couponRef, {
        isConsumed: true,
        consumedBy: uid,
        consumedAt: now
      });

      transaction.update(userRef, {
        fuelBatches: updatedBatches,
        fuelLevel: totalLevel,
        coinBatches: updatedBatches,
        coinBalance: totalLevel,
        lastActionAt: now
      });

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
      if (userData.freeGiftClaimed) {
        throw new HttpsError('already-exists', 'You have already claimed your free fuel gift.');
      }

      const now = Date.now();
      const giftAmount = 50;
      const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days
      
      const newBatch = {
        id: `free_${Math.random().toString(36).substring(7)}`,
        amount: giftAmount,
        remaining: giftAmount,
        createdAt: now,
        expiresAt: expiresAt,
        type: 'coupon'
      };

      let legacyBatches = userData.fuelBatches || userData.coinBatches || [];
      const legacyBalance = userData.coinBalance || userData.fuelLevel || 0;
      if (legacyBatches.length === 0 && legacyBalance > 0) {
        legacyBatches.push({
          id: `legacy_balance_${now}`,
          amount: legacyBalance,
          remaining: legacyBalance,
          createdAt: now,
          expiresAt: now + (100 * 365 * 24 * 60 * 60 * 1000),
          type: 'legacy_migration'
        });
      }
      const updatedBatches = [...legacyBatches, newBatch];
      const totalLevel = updatedBatches
        .filter(b => b.expiresAt > now)
        .reduce((sum, b) => sum + b.remaining, 0);

      transaction.set(couponRef, {
        code: couponCode,
        fuelAmount: giftAmount,
        isConsumed: true,
        consumedBy: uid,
        consumedAt: now,
        createdAt: now
      });

      transaction.update(userRef, {
        fuelBatches: updatedBatches,
        fuelLevel: totalLevel,
        coinBatches: updatedBatches,
        coinBalance: totalLevel,
        freeGiftClaimed: true,
        lastActionAt: now
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
      const now = Date.now();

      const expiresAt = now + (100 * 365 * 24 * 60 * 60 * 1000); 
      
      const newBatch = {
        id: `purchase_${productId}_${now}`,
        amount: Number(amount),
        remaining: Number(amount),
        createdAt: now,
        expiresAt: expiresAt,
        type: 'purchase',
        productId: productId
      };

      let legacyBatches = userData.fuelBatches || userData.coinBatches || [];
      const legacyBalance = userData.coinBalance || userData.fuelLevel || 0;
      if (legacyBatches.length === 0 && legacyBalance > 0) {
        legacyBatches.push({
          id: `legacy_balance_${now}`,
          amount: legacyBalance,
          remaining: legacyBalance,
          createdAt: now,
          expiresAt: now + (100 * 365 * 24 * 60 * 60 * 1000),
          type: 'legacy_migration'
        });
      }
      const updatedBatches = [...legacyBatches, newBatch];
      const totalLevel = updatedBatches
        .filter(b => b.expiresAt > now)
        .reduce((sum, b) => sum + b.remaining, 0);

      transaction.update(userRef, {
        fuelBatches: updatedBatches,
        fuelLevel: totalLevel,
        coinBatches: updatedBatches,
        coinBalance: totalLevel,
        lastActionAt: now
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
          const fuelLevel = ownerData.fl || ownerData.fuelLevel || ownerData.coinBalance || 0;
          if (fuelLevel < 50) {
            throw new HttpsError('failed-precondition', 'Insufficient fuel to engage in this order. (Min 50 fuel required)');
          }

          // 1. Get batches from subcollection AND legacy array
          const subSnap = await ownerRef.collection('fuel_batches').where('ea', '>', now).get();
          let fuelBatches = [];
          subSnap.forEach(doc => fuelBatches.push({ ...doc.data(), _path: doc.ref }));
          
          // Add legacy batches if they exist
          const legacyBatches = ownerData.fuelBatches || ownerData.coinBatches || [];
          if (legacyBatches.length > 0) {
            legacyBatches.forEach(b => {
              // Convert to short keys if needed
              fuelBatches.push({
                id: b.id,
                a: b.amount,
                r: b.remaining,
                ca: b.createdAt,
                ea: b.expiresAt,
                t: b.type
              });
            });
          } else {
            const legacyBalance = ownerData.coinBalance || ownerData.fuelLevel || 0;
            if (legacyBalance > 0) {
              const mId = `legacy_balance_${now}`;
              fuelBatches.push({
                id: mId,
                a: legacyBalance, r: legacyBalance,
                ca: now, ea: now + (100 * 365 * 24 * 60 * 60 * 1000),
                t: 'legacy_migration'
              });
            }
          }

          const validBatches = fuelBatches
            .filter(b => b.ea > now && b.r > 0)
            .sort((a, b) => a.ca - b.ca);

          let remainingToDeduct = 50; 
          for (const batch of validBatches) {
            if (remainingToDeduct <= 0) break;
            const deduct = Math.min(batch.r, remainingToDeduct);
            batch.r -= deduct;
            remainingToDeduct -= deduct;
            
            // If it was already in subcollection, update it
            if (batch._path) {
              transaction.update(batch._path, { r: batch.r });
            } else {
              // If it was legacy, it will be saved in step 2
              const newBatchRef = ownerRef.collection('fuel_batches').doc(batch.id || `migrated_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
              transaction.set(newBatchRef, { ...batch, _path: undefined });
            }
          }

          const newLevel = validBatches.reduce((sum, b) => sum + b.r, 0);

          transaction.update(ownerRef, {
            fl: newLevel,
            laa: now,
            fuelBatches: admin.firestore.FieldValue.delete(),
            coinBatches: admin.firestore.FieldValue.delete(),
            fuelLevel: admin.firestore.FieldValue.delete(),
            coinBalance: admin.firestore.FieldValue.delete()
          });
          
          transaction.update(orderRef, { engaged: true });
          logger.info(`Charged 50 fuel from store owner ${uid}. New level: ${newLevel}`);
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

      // 2. Verify Completed Order for this Store
      const ordersSnap = await db.collection('orders')
        .where('customerId', '==', uid)
        .where('storeId', '==', storeId)
        .where('status', '==', 'completed')
        .limit(1)
        .get();

      if (ordersSnap.empty) {
        throw new HttpsError('failed-precondition', 'You must have at least one completed order from this store to leave a rating.');
      }

      const existingRatingDoc = await transaction.get(ratingRef);
      const isNewRating = !existingRatingDoc.exists;
      const oldRating = existingRatingDoc.exists ? existingRatingDoc.data().rating : 0;

      // 3. Update Store Aggregates
      let newCount = storeData.ratingCount || 0;
      let newSum = (storeData.averageRating || 0) * newCount;

      if (isNewRating) {
        newCount += 1;
        newSum += rating;
      } else {
        newSum = newSum - oldRating + rating;
      }

      const newAverage = newSum / newCount;

      transaction.update(storeRef, {
        averageRating: newAverage,
        ratingCount: newCount,
        updatedAt: now
      });

      // 4. Record Rating
      transaction.set(ratingRef, {
        rating: rating,
        createdAt: now,
        updatedAt: now
      });

      // 5. Implicit Fuel Consumption (1 unit)
      const fuelLevel = userData.fl || userData.fuelLevel || userData.coinBalance || 0;
      if (fuelLevel < 1) {
        throw new HttpsError('failed-precondition', 'Insufficient fuel to submit rating.');
      }

      // 1. Get batches from subcollection AND legacy array
      const subSnap = await userRef.collection('fuel_batches').where('ea', '>', now).get();
      let fuelBatches = [];
      subSnap.forEach(doc => fuelBatches.push({ ...doc.data(), _path: doc.ref }));
      
      const legacyBatches = userData.fuelBatches || userData.coinBatches || [];
      if (legacyBatches.length > 0) {
        legacyBatches.forEach(b => {
          fuelBatches.push({
            id: b.id,
            a: b.amount,
            r: b.remaining,
            ca: b.createdAt,
            ea: b.expiresAt,
            t: b.type
          });
        });
      } else {
        const legacyBalance = userData.coinBalance || userData.fuelLevel || 0;
        if (legacyBalance > 0) {
          const mId = `legacy_balance_${now}`;
          fuelBatches.push({
            id: mId,
            a: legacyBalance, r: legacyBalance,
            ca: now, ea: now + (100 * 365 * 24 * 60 * 60 * 1000),
            t: 'legacy_migration'
          });
        }
      }

      const validBatches = fuelBatches
        .filter(b => b.ea > now && b.r > 0)
        .sort((a, b) => a.ca - b.ca);

      let remainingToDeduct = 1;
      for (const batch of validBatches) {
        if (remainingToDeduct <= 0) break;
        const deduct = Math.min(batch.r, remainingToDeduct);
        batch.r -= deduct;
        remainingToDeduct -= deduct;
        
        if (batch._path) {
          transaction.update(batch._path, { r: batch.r });
        } else {
          const newBatchRef = userRef.collection('fuel_batches').doc(batch.id || `migrated_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`);
          transaction.set(newBatchRef, { ...batch, _path: undefined });
        }
      }

      const newLevel = validBatches.reduce((sum, b) => sum + b.r, 0);

      // 6. Update User Cooldown and Fuel
      transaction.update(userRef, {
        lastRatingDate: today,
        laa: now,
        fl: newLevel,
        fuelBatches: admin.firestore.FieldValue.delete(),
        coinBatches: admin.firestore.FieldValue.delete(),
        fuelLevel: admin.firestore.FieldValue.delete(),
        coinBalance: admin.firestore.FieldValue.delete()
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
      if (userData.lastDailyRewardDay === today) {
        return { success: false, alreadyClaimed: true };
      }

      const rewardAmount = 1;
      const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days
      const batchId = `daily_${now}`;
      
      const newBatch = {
        id: batchId,
        a: rewardAmount, // amount
        r: rewardAmount, // remaining
        ca: now, // createdAt
        ea: expiresAt, // expiresAt
        t: 'reward' // type
      };

      // 1. Write the new batch to storage subcollection
      const batchRef = userRef.collection('fuel_batches').doc(batchId);
      transaction.set(batchRef, newBatch);

      // 2. Query all valid batches to calculate current level
      // Note: We can't query in a transaction easily without fetching all docs.
      // For now, we fetch all non-expired batches.
      const batchesSnap = await userRef.collection('fuel_batches')
        .where('ea', '>', now)
        .get();
      
      let totalLevel = rewardAmount; // Start with the new one
      
      // Migrate legacy arrays or raw balance
      const legacyBatches = userData.fuelBatches || userData.coinBatches || [];
      const legacyBalance = userData.coinBalance || userData.fuelLevel || 0;
      
      if (legacyBatches.length > 0) {
        legacyBatches.forEach(b => {
          const ea = b.expiresAt || b.ea;
          const r = b.remaining || b.r || 0;
          if (ea && ea > now && r > 0) {
            totalLevel += r;
            const mId = b.id || `migrated_${now}_${Math.random().toString(36).substr(2, 5)}`;
            transaction.set(userRef.collection('fuel_batches').doc(mId), {
               id: mId, a: b.amount || b.a, r: r, ca: b.createdAt || b.ca || now, ea: ea, t: b.type || b.t || 'migrated'
            });
          }
        });
      } else if (legacyBalance > 0) {
        totalLevel += legacyBalance;
        const mId = `legacy_balance_${now}`;
        transaction.set(userRef.collection('fuel_batches').doc(mId), {
           id: mId, a: legacyBalance, r: legacyBalance, ca: now, ea: now + (100 * 365 * 24 * 60 * 60 * 1000), t: 'legacy_migration'
        });
      }

      batchesSnap.forEach(doc => {
        const b = doc.data();
        if (b.id !== batchId) {
          totalLevel += (b.r || 0);
        }
      });

      // 3. Update main document with summary and metadata
      // Also cleanup old arrays if they exist (Migration-on-the-fly)
      transaction.update(userRef, {
        fl: totalLevel, // Short key for fuelLevel
        ldrd: today, // lastDailyRewardDay
        ldra: now, // lastDailyRewardAt
        laa: now, // lastActionAt
        fuelBatches: admin.firestore.FieldValue.delete(),
        coinBatches: admin.firestore.FieldValue.delete(),
        fuelLevel: admin.firestore.FieldValue.delete(),
        coinBalance: admin.firestore.FieldValue.delete()
      });

      logger.info(`Daily reward granted. New level: ${totalLevel}`);
      return { success: true, amount: rewardAmount };
    });

    return result;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in grantDailyFuelReward:", error);
    throw new HttpsError('internal', 'An error occurred while granting daily reward.');
  }
});
