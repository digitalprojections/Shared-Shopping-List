import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
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
          isAdmin: false
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
        isAdmin: false
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
        callback(doc.data() as AppUser);
      }
    }, (error) => {
      console.error("User profile subscription error:", error);
    });
  }
};
