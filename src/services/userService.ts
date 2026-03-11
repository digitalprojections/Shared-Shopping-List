import { doc, getDoc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { AppUser } from '../types';

export const userService = {
  ensureUserProfile: async (userId: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    const userRef = doc(db, 'users', userId);
    try {
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        const newUser: AppUser = {
          uid: userId,
          coinBalance: 0,
          coinBatches: [],
          isAdmin: false,
          lastActionAt: 0
        };
        await setDoc(userRef, newUser);
      }
    } catch (error) {
      console.error("Error ensuring user profile:", error);
    }
  },

  getUserProfile: async (userId: string): Promise<AppUser | null> => {
    if (!isFirebaseConfigured) return null;
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      const newUser: AppUser = {
        uid: userId,
        coinBalance: 0,
        coinBatches: [],
        isAdmin: false,
        lastActionAt: 0
      };
      await setDoc(userRef, newUser);
      return newUser;
    }
    
    return userDoc.data() as AppUser;
  },

  subscribeToUserProfile: (userId: string, callback: (user: AppUser) => void) => {
    if (!isFirebaseConfigured) return () => {};
    const userRef = doc(db, 'users', userId);
    
    return onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as AppUser;
        const now = Date.now();
        // Calculate effective balance based on non-expired batches
        const effectiveBalance = (data.coinBatches || [])
          .filter(b => b.expiresAt > now)
          .reduce((sum, b) => sum + b.remaining, 0);
        
        callback({
          ...data,
          coinBalance: effectiveBalance
        });
      }
    }, (error) => {
      console.error("User profile subscription error:", error);
    });
  },

  calculateEffectiveBalance: (user: AppUser): number => {
    const now = Date.now();
    return (user.coinBatches || [])
      .filter(b => b.expiresAt > now)
      .reduce((sum, b) => sum + b.remaining, 0);
  },

  consumeCoin: async (userId: string): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured) return { success: true }; // No-op if local only

    const userRef = doc(db, 'users', userId);
    
    try {
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error('User not found');
        
        const userData = userDoc.data() as AppUser;
        const now = Date.now();
        
        // Anti-abuse: 2-second cooldown
        if (userData.lastActionAt && (now - userData.lastActionAt < 2000)) {
          throw new Error('Please wait 2 seconds between actions');
        }
        
        // Filter valid batches and sort by creation time (FIFO)
        const validBatches = (userData.coinBatches || [])
          .filter(b => b.expiresAt > now && b.remaining > 0)
          .sort((a, b) => a.createdAt - b.createdAt);
        
        if (validBatches.length === 0) {
          throw new Error('Insufficient coins');
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
      });
      
      return { success: true };
    } catch (error: any) {
      console.error("Error consuming coin:", error);
      return { success: false, error: error.message };
    }
  }
};
