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

      const rewardAmount = 1;
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
