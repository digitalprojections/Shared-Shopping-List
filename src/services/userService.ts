import { doc, getDoc, setDoc, updateDoc, onSnapshot, query, collection, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured, functions, auth } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { AppUser, PushToken } from '../types';
import { User, signOut } from 'firebase/auth';
import { shoppingService } from './shoppingService';
import { storeService } from './storeService';

export const userService = {
  ensureUserProfile: async (userId: string, existingDoc?: any): Promise<void> => {
    if (!isFirebaseConfigured || !userId) return;
    
    const userRef = doc(db, 'users', userId);
    try {
      // If we already know it doesn't exist from a snapshot, skip the getDoc
      if (!existingDoc) {
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) return;
      }
      
      console.log("Creating NEW User Profile for:", userId);
      const newUser: AppUser = {
        uid: userId,
        fl: 0,
        ldrd: '',
        ldra: 0,
        laa: Date.now(),
        isAdmin: false,
        isMerchant: false,
        preferences: [],
        followedStores: [],
        ownedStores: []
      };
      await setDoc(userRef, newUser);
    } catch (error) {
      console.error("Error ensuring user profile:", error);
    }
  },

  getUserProfile: async (userId: string): Promise<AppUser | null> => {
    if (!isFirebaseConfigured || !userId) return null;
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      const newUser: AppUser = {
        uid: userId,
        fl: 0,
        ldrd: '',
        ldra: 0,
        laa: Date.now(),
        isAdmin: false,
        isMerchant: false,
        preferences: [],
        followedStores: [],
        ownedStores: []
      };
      await setDoc(userRef, newUser);
      return newUser;
    }
    
    return userDoc.data() as AppUser;
  },

  subscribeToUserProfile: (userId: string, callback: (user: AppUser) => void) => {
    if (!isFirebaseConfigured || !userId) return () => {};
    console.log("Subscribing to User Profile:", userId);
    const userRef = doc(db, 'users', userId);
    
    return onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data() as AppUser;
        const now = Date.now();
        
        // Map short keys to long names for UI consumption (transitional)
        const fuelLevel = data.fuelLevel ?? data.fl ?? (data.coinBalance || 0);
        const lastActionAt = data.laa ?? data.lastActionAt ?? now;
        const lastDailyRewardDay = data.lastDailyRewardDay ?? data.ldrd ?? '';
        const lastDailyRewardAt = data.ldra ?? data.lastDailyRewardAt ?? 0;
        
        callback({
          ...data,
          fuelLevel,
          lastActionAt,
          lastDailyRewardDay,
          lastDailyRewardAt
        });
      } else {
        // If profile doesn't exist, trigger creation
        console.log("Profile missing in snapshot, creating...");
        userService.ensureUserProfile(userId, false); // pass false to skip another getDoc
      }
    }, (error) => {
      console.error("User profile subscription error:", error);
    });
  },

  subscribeToFollowing: (userId: string, callback: (storeIds: string[]) => void) => {
    if (!isFirebaseConfigured || !userId) return () => {};
    const followingRef = collection(db, 'users', userId, 'following');
    return onSnapshot(followingRef, (snapshot) => {
      const storeIds = snapshot.docs.map(doc => doc.id);
      callback(storeIds);
    }, (error) => {
      console.error("Error subscribing to following list:", error);
    });
  },
  calculateEffectiveFuel: (user: AppUser): number => {
    // Top-level value takes precedence if populated via recent function
    if (user.fuelLevel !== undefined && user.fuelLevel > 0) return user.fuelLevel;
    if (user.fl !== undefined && user.fl > 0) return user.fl;
    
    // Legacy calculation
    const now = Date.now();
    const fuelBatches = user.fuelBatches || user.coinBatches || [];
    
    if (fuelBatches.length > 0) {
      return fuelBatches
        .filter((b: any) => (b.expiresAt ? b.expiresAt > now : (b.ea ? b.ea > now : true)))
        .reduce((sum: number, b: any) => sum + (b.remaining ?? b.r ?? b.amount ?? b.a ?? 0), 0);
    }
    
    return user.coinBalance ?? 0;
  },

  consumeFuel: async (userId: string, amount: number = 1): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured) return { success: true };

    try {
      const consumeFuelFn = httpsCallable<{ userId: string; amount: number }, { success: boolean }>(functions, 'consumeFuel');
      const result = await consumeFuelFn({ userId, amount });
      return { success: result.data.success };
    } catch (error: any) {
      console.error("Error consuming fuel via Cloud Function:", error);
      const message = error.message || 'Error consuming fuel';
      return { success: false, error: message };
    }
  },

  deleteUserAccount: async (userInstance: User): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured) return { success: false, error: 'Firebase not configured' };

    try {
      const userId = userInstance.uid;
      console.log("Starting account deletion for:", userId);

      // 1. Delete owned lists and their items
      const listsQuery = query(collection(db, 'lists'), where('ownerId', '==', userId));
      const listsSnapshot = await getDocs(listsQuery);
      
      for (const listDoc of listsSnapshot.docs) {
        await shoppingService.deleteList(listDoc.id, userId);
      }

      // 2. Delete followed collections
      const followedQuery = query(collection(db, 'followed_collections'), where('followerId', '==', userId));
      const followedSnapshot = await getDocs(followedQuery);
      const batch = writeBatch(db);
      followedSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // 2.5 Delete owned stores (resolves unattended stores orphan issue)
      const storesQuery = query(collection(db, 'stores'), where('ownerId', '==', userId));
      const storesSnapshot = await getDocs(storesQuery);
      // Wait, deleting a store requires deeper cleanup (products, stale images, etc.) so we should use storeService if possible.
      // Assuming storeService.deleteStore(storeId: string) exists:
      for (const storeDoc of storesSnapshot.docs) {
        // Need to import storeService for this to work. Let's make sure it's imported at the top.
        // Or we just try/catch if storeService is not imported yet, we'll do the imports next
        // For now, assume it's imported or I will import it in another chunk
        await storeService.deleteStore(storeDoc.id);
      }

      // 3. Delete user profile
      await deleteDoc(doc(db, 'users', userId));

      // 4. Finally, delete the Firebase Auth account
      await userInstance.delete();
      
      return { success: true };
    } catch (error: any) {
      console.error("Error in deleteUserAccount:", error);
      return { 
        success: false, 
        error: error.code === 'auth/requires-recent-login' 
          ? 'SEC_ERROR_RECENT_LOGIN' 
          : error.message || 'Error deleting account' 
      };
    }
  },

  updateFcmToken: async (userId: string, token: string, platform: 'android' | 'ios' | 'web'): Promise<void> => {
    if (!isFirebaseConfigured || !userId) return;
    const userRef = doc(db, 'users', userId);
    try {
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data = userDoc.data() as AppUser;
        let tokens = data.fcmTokens || [];
        
        // Check if this specific token already exists
        const tokenExists = tokens.some(t => t.token === token);
        
        if (!tokenExists) {
          const newToken: PushToken = {
            token: token,
            platform: platform,
            createdAt: Date.now()
          };
          
          await setDoc(userRef, { 
            fcmTokens: [...tokens, newToken] 
          }, { merge: true });
        }
      }
    } catch (error) {
      console.error("Error updating FCM token:", error);
    }
  },

  updatePreferences: async (userId: string, preferences: string[]): Promise<void> => {
    if (!isFirebaseConfigured || !userId) return;
    const userRef = doc(db, 'users', userId);
    try {
      await updateDoc(userRef, { preferences });
    } catch (error) {
      console.error("Error updating preferences:", error);
    }
  },

  claimDailyFuelReward: async (): Promise<{ success: boolean; amount?: number; alreadyClaimed?: boolean; error?: string }> => {
    if (!isFirebaseConfigured) return { success: false, error: 'Firebase not configured' };
    
    try {
      const claimFn = httpsCallable<void, { success: boolean; amount: number; alreadyClaimed?: boolean }>(functions, 'grantDailyFuelReward');
      const result = await claimFn();
      return result.data;
    } catch (error: any) {
      console.error("Error claiming daily reward:", error);
      return { success: false, error: error.message || 'Failed to claim daily reward' };
    }
  }
};
