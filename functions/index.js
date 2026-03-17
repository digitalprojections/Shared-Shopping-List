const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.consumeCoin = onCall({
  // Enforce authentication
  enforceAppCheck: false, // Set to true if App Check is enabled
}, async (request) => {
  // Check if user is authenticated
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

      // Anti-abuse: 2-second cooldown
      if (userData.lastActionAt && (now - userData.lastActionAt < 2000)) {
        throw new HttpsError('resource-exhausted', 'Please wait 2 seconds between actions.');
      }

      // Filter valid batches and sort by creation time (FIFO)
      const validBatches = (userData.coinBatches || [])
        .filter(b => b.expiresAt > now && b.remaining > 0)
        .sort((a, b) => a.createdAt - b.createdAt);

      if (validBatches.length === 0) {
        throw new HttpsError('failed-precondition', 'Insufficient coins.');
      }

      // Consume 1 coin from the oldest batch
      const oldestBatch = validBatches[0];
      oldestBatch.remaining -= 1;

      // Update the batches in the original data structure
      const updatedBatches = (userData.coinBatches || []).map(b => 
        b.id === oldestBatch.id ? oldestBatch : b
      );

      // Recalculate total balance
      const totalBalance = updatedBatches
        .filter(b => b.expiresAt > now)
        .reduce((sum, b) => sum + b.remaining, 0);

      transaction.update(userRef, {
        coinBatches: updatedBatches,
        coinBalance: totalBalance,
        lastActionAt: now
      });
      
      logger.info(`Coin consumed for user ${uid}. New balance: ${totalBalance}`);
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in consumeCoin:", error);
    throw new HttpsError('internal', 'An internal error occurred while consuming a coin.');
  }
});

exports.grantRewardedCoin = onCall({
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
      // Safety cap: allow up to 20 coins per reward to match user settings
      const rewardAmount = Math.max(1, Math.min(requestedAmount, 20));
      const newBatch = {
        id: `reward_${now}`,
        createdAt: now,
        expiresAt: now + (30 * 24 * 60 * 60 * 1000), // 30 days
        remaining: rewardAmount,
        type: 'reward'
      };

      const updatedBatches = [...(userData.coinBatches || []), newBatch];
      const totalBalance = updatedBatches
        .filter(b => b.expiresAt > now)
        .reduce((sum, b) => sum + b.remaining, 0);

      transaction.update(userRef, {
        coinBatches: updatedBatches,
        coinBalance: totalBalance,
        lastAdAt: now,
        lastAdDay: today,
        adCount: adCount + 1
      });

      logger.info(`Rewarded coin granted to user ${uid}. New balance: ${totalBalance}`);
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in grantRewardedCoin:", error);
    throw new HttpsError('internal', 'An internal error occurred while granting reward.');
  }
});

exports.redeemCoupon = onCall({
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
        amount: couponData.coinsAmount,
        remaining: couponData.coinsAmount,
        createdAt: now,
        expiresAt: expiresAt,
        type: 'coupon'
      };

      const updatedBatches = [...(userData.coinBatches || []), newBatch];
      const totalBalance = updatedBatches
        .filter(b => b.expiresAt > now)
        .reduce((sum, b) => sum + b.remaining, 0);

      transaction.update(couponRef, {
        isConsumed: true,
        consumedBy: uid,
        consumedAt: now
      });

      transaction.update(userRef, {
        coinBatches: updatedBatches,
        coinBalance: totalBalance,
        lastActionAt: now
      });

      return { coins: couponData.coinsAmount };
    });

    return { success: true, message: `Successfully redeemed ${result.coins} coins!`, coins: result.coins };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in redeemCoupon:", error);
    throw new HttpsError('internal', error.message || 'Error redeeming coupon.');
  }
});

exports.claimFreeWebCoupon = onCall({
  enforceAppCheck: false,
  cors: true,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const userRef = db.collection('users').doc(uid);
  
  // We use a specific code prefix to make it identifiable in history
  const couponCode = `FREE-WEB-${uid.substring(0, 8).toUpperCase()}`;
  const couponRef = db.collection('coupons').doc(couponCode);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User profile not found.');
      }

      const userData = userDoc.data();
      if (userData.freeCouponClaimed) {
        throw new HttpsError('already-exists', 'You have already claimed your free gift.');
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

      const updatedBatches = [...(userData.coinBatches || []), newBatch];
      const totalBalance = updatedBatches
        .filter(b => b.expiresAt > now)
        .reduce((sum, b) => sum + b.remaining, 0);

      // Create the coupon record as consumed
      transaction.set(couponRef, {
        code: couponCode,
        coinsAmount: giftAmount,
        isConsumed: true,
        consumedBy: uid,
        consumedAt: now,
        createdAt: now
      });

      transaction.update(userRef, {
        coinBatches: updatedBatches,
        coinBalance: totalBalance,
        freeCouponClaimed: true,
        lastActionAt: now
      });

      return { coins: giftAmount };
    });

    return { success: true, message: `Successfully claimed ${result.coins} free coins!`, coins: result.coins };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in claimFreeWebCoupon:", error);
    throw new HttpsError('internal', error.message || 'Error claiming free gift.');
  }
});

exports.grantPurchaseCoins = onCall({
  enforceAppCheck: false,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { productId, purchaseToken } = request.data;
  if (!productId) {
    throw new HttpsError('invalid-argument', 'Product ID is required.');
  }

  // Backend source of truth for coin amounts
  const COIN_MAP = {
    'coins_50': 50,
    'coins_200': 200,
    'coins_500': 500,
    'coins_1000': 1000,
    'coins_1200': 1200,
    'coins_50_test': 50 // For sandbox testing
  };

  let amount = COIN_MAP[productId];
  
  // Dynamic parsing fallback if not in map
  if (!amount) {
    const match = productId.match(/coins_(\d+)/);
    if (match && match[1]) {
      amount = parseInt(match[1], 10);
    }
  }

  if (!amount) {
    throw new HttpsError('invalid-argument', `Unknown product identifier: ${productId}`);
  }

  // NOTE: In a production app, you MUST verify the purchaseToken with Google/Apple/RevenueCat API here.
  // For now, we assume the frontend sent a valid purchase notification from RevenueCat.
  
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

      // Purchases NEVER expire (set to 100 years for accounting simplicity)
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

      const updatedBatches = [...(userData.coinBatches || []), newBatch];
      const totalBalance = updatedBatches
        .filter(b => b.expiresAt > now)
        .reduce((sum, b) => sum + b.remaining, 0);

      transaction.update(userRef, {
        coinBatches: updatedBatches,
        coinBalance: totalBalance,
        lastActionAt: now
      });

      logger.info(`Purchased coins (${amount}) granted to user ${uid}.`);
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error in grantPurchaseCoins:", error);
    throw new HttpsError('internal', 'An internal error occurred while granting purchase.');
  }
});
