import { doc, getDoc, setDoc, updateDoc, onSnapshot, query, collection, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, isFirebaseConfigured, functions, auth } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { AppUser } from '../types';
import { User, signOut } from 'firebase/auth';
import { shoppingService } from './shoppingService';

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
        coinBalance: 0,
        coinBatches: [],
        isAdmin: false,
        lastActionAt: 0,
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
        coinBalance: 0,
        coinBatches: [],
        isAdmin: false,
        lastActionAt: 0,
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
        const effectiveBalance = (data.coinBatches || [])
          .filter(b => b.expiresAt > now)
          .reduce((sum, b) => sum + b.remaining, 0);
        
        callback({
          ...data,
          coinBalance: effectiveBalance
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

  calculateEffectiveBalance: (user: AppUser): number => {
    const now = Date.now();
    return (user.coinBatches || [])
      .filter(b => b.expiresAt > now)
      .reduce((sum, b) => sum + b.remaining, 0);
  },

  consumeCoin: async (userId: string, amount: number = 1): Promise<{ success: boolean; error?: string }> => {
    if (!isFirebaseConfigured) return { success: true };

    try {
      const consumeCoinFn = httpsCallable<{ userId: string; amount: number }, { success: boolean }>(functions, 'consumeCoin');
      const result = await consumeCoinFn({ userId, amount });
      return { success: result.data.success };
    } catch (error: any) {
      console.error("Error consuming coin via Cloud Function:", error);
      const message = error.message || 'Error consuming coin';
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

  updateFcmToken: async (userId: string, token: string): Promise<void> => {
    if (!isFirebaseConfigured || !userId) return;
    const userRef = doc(db, 'users', userId);
    try {
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data = userDoc.data() as AppUser;
        const tokens = data.fcmTokens || [];
        if (!tokens.includes(token)) {
          await setDoc(userRef, { fcmTokens: [...tokens, token] }, { merge: true });
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
  }
};
