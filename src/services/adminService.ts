import { collection, doc, getDoc, getDocs, deleteDoc, writeBatch, query, where, limit, orderBy, startAfter } from 'firebase/firestore';
import { db, isFirebaseConfigured, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { AppUser, Store } from '../types';
import { storeService } from './storeService';
import { shoppingService } from './shoppingService';

export const adminService = {
  // --- User Management ---
  getRecentUsers: async (lastDocSnapshot?: any): Promise<{ users: AppUser[], lastVisible: any }> => {
    if (!isFirebaseConfigured) return { users: [], lastVisible: null };
    let q = query(
      collection(db, 'users'),
      orderBy('laa', 'desc'),
      limit(20)
    );
    
    if (lastDocSnapshot) {
      q = query(q, startAfter(lastDocSnapshot));
    }
    
    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => doc.data() as AppUser);
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    
    return { users, lastVisible };
  },

  searchUserById: async (userId: string): Promise<AppUser | null> => {
    if (!isFirebaseConfigured || !userId) return null;
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      return userDoc.exists() ? (userDoc.data() as AppUser) : null;
    } catch {
      return null;
    }
  },

  updateUserField: async (userId: string, updates: Partial<AppUser>): Promise<boolean> => {
    if (!isFirebaseConfigured || !userId) return false;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', userId), updates);
      await batch.commit();
      return true;
    } catch (error) {
      console.error("Error updating user:", error);
      return false;
    }
  },

  // --- Orphaned Data Cleanup ---
  findOrphanedStores: async (): Promise<Store[]> => {
    if (!isFirebaseConfigured) return [];
    
    // Fetch all stores (this is feasible for an admin tool on a moderate dataset)
    const storesQuery = query(collection(db, 'stores'));
    const snapshot = await getDocs(storesQuery);
    const allStores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
    
    const uniqueOwners = Array.from(new Set(allStores.map(s => s.ownerId)));
    const activeOwnerIds = new Set<string>();
    
    // Batch query users (max 30 per 'in' query)
    const chunkSize = 30;
    for (let i = 0; i < uniqueOwners.length; i += chunkSize) {
      const chunk = uniqueOwners.slice(i, i + chunkSize);
      const usersQuery = query(collection(db, 'users'), where('uid', 'in', chunk));
      const userSnap = await getDocs(usersQuery);
      
      userSnap.forEach(doc => {
        const u = doc.data() as AppUser;
        // Optional: If you only want to consider them valid owners if they are merchants
        // if (u.isMerchant) activeOwnerIds.add(u.uid);
        activeOwnerIds.add(u.uid);
      });
    }
    
    // An orphaned store is one whose owner does not exist in the users DB
    return allStores.filter(store => !activeOwnerIds.has(store.ownerId));
  },

  deleteOrphanedStore: async (storeId: string): Promise<boolean> => {
    if (!isFirebaseConfigured) return false;
    try {
      await storeService.deleteStore(storeId);
      return true;
    } catch (error) {
      console.error("Error deleting orphaned store:", error);
      return false;
    }
  }
};
