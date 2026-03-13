import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { AppUser } from '../types';

export const userService = {
  ensureUserProfile: async (userId: string): Promise<void> => {
    if (!isFirebaseConfigured) return;
    console.log("Ensuring User Profile for:", userId);
    const userRef = doc(db, 'users', userId);
    try {
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        console.log("Creating NEW User Profile for:", userId);
        const newUser: AppUser = {
          uid: userId,
          coinBalance: 0,
          coinBatches: [],
          isAdmin: false,
          lastActionAt: 0
        };
        await setDoc(userRef, newUser);
      } else {
        console.log("Existing user profile found for:", userId);
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
    console.log("Subscribing to User Profile:", userId);
    const userRef = doc(db, 'users', userId);
    
    return onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as AppUser;
        console.log("User Profile Update Received:", data.uid);
        const now = Date.now();
        // Calculate effective balance based on non-expired batches
        const effectiveBalance = (data.coinBatches || [])
          .filter(b => b.expiresAt > now)
          .reduce((sum, b) => sum + b.remaining, 0);
        
        callback({
          ...data,
          coinBalance: effectiveBalance
        });
      } else {
        console.warn("User Profile Doc does not exist for:", userId);
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
    if (!isFirebaseConfigured) return { success: true };

    try {
      const consumeCoinFn = httpsCallable<{ userId: string }, { success: boolean }>(functions, 'consumeCoin');
      const result = await consumeCoinFn({ userId });
      return { success: result.data.success };
    } catch (error: any) {
      console.error("Error consuming coin via Cloud Function:", error);
      const message = error.message || 'Error consuming coin';
      return { success: false, error: message };
    }
  }
};
