import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  orderBy,
  getDoc,
  getDocs,
  setDoc,
  increment,
  writeBatch,
  arrayUnion
} from 'firebase/firestore';
import { db, isFirebaseConfigured, cleanObject } from '../lib/firebase';
import { userService } from './userService';
import { ShoppingList, ListItem, ShareLink, Permission } from '../types';

export const shoppingService = {
  // Lists
  subscribeToLists: (userId: string, callback: (lists: ShoppingList[]) => void) => {
    if (!isFirebaseConfigured || !userId) return () => { };

    const ownedSource = new Map<string, ShoppingList>();
    const sharedSource = new Map<string, ShoppingList>();
    const followedSources = new Map<string, Map<string, ShoppingList>>();

    const notify = () => {
      const mergedMap = new Map<string, ShoppingList>();
      // Merge results from all sources: Followed < Shared < Owned (priority)
      followedSources.forEach(source => {
        source.forEach((list, id) => mergedMap.set(id, list));
      });
      sharedSource.forEach((list, id) => mergedMap.set(id, list));
      ownedSource.forEach((list, id) => mergedMap.set(id, list));

      const finalLists = Array.from(mergedMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
      callback(finalLists);
    };

    const unsubscribes: (() => void)[] = [];

    // Query 1: Owned lists
    const qOwned = query(collection(db, 'lists'), where('ownerId', '==', userId));
    unsubscribes.push(onSnapshot(qOwned, (snapshot) => {
      ownedSource.clear();
      snapshot.docs.forEach(doc => {
        ownedSource.set(doc.id, { id: doc.id, ...doc.data() } as ShoppingList);
      });
      notify();
    }));

    // Query 2: Directly shared lists
    const qShared = query(collection(db, 'lists'), where('sharedUsers', 'array-contains', userId));
    unsubscribes.push(onSnapshot(qShared, (snapshot) => {
      sharedSource.clear();
      snapshot.docs.forEach(doc => {
        sharedSource.set(doc.id, { id: doc.id, ...doc.data() } as ShoppingList);
      });
      notify();
    }));

    // Query 3: Followed collections
    const qCol = query(collection(db, 'followed_collections'), where('followerId', '==', userId));
    const colUnsubscribes = new Map<string, () => void>();

    unsubscribes.push(onSnapshot(qCol, (snap) => {
      const currentFollowedIds = new Set(snap.docs.map(doc => doc.data().ownerId));
      
      // Cleanup unfollowed
      followedSources.forEach((_, ownerId) => {
        if (!currentFollowedIds.has(ownerId)) {
          if (colUnsubscribes.has(ownerId)) {
            colUnsubscribes.get(ownerId)!();
            colUnsubscribes.delete(ownerId);
          }
          followedSources.delete(ownerId);
        }
      });

      // Add newly followed
      snap.docs.forEach(doc => {
        const ownerId = doc.data().ownerId;
        if (!followedSources.has(ownerId)) {
          const sourceMap = new Map<string, ShoppingList>();
          followedSources.set(ownerId, sourceMap);
          
          const qList = query(collection(db, 'lists'), where('ownerId', '==', ownerId));
          const unsub = onSnapshot(qList, (listSnap) => {
            sourceMap.clear();
            listSnap.docs.forEach(listDoc => {
              sourceMap.set(listDoc.id, { id: listDoc.id, ...listDoc.data() } as ShoppingList);
            });
            notify();
          });
          
          colUnsubscribes.set(ownerId, unsub);
        }
      });
      notify();
    }));

    return () => {
      unsubscribes.forEach(u => u());
      colUnsubscribes.forEach(u => u());
    };
  },

  createList: async (userId: string, name: string, color: string) => {
    if (isFirebaseConfigured) {
      const consumption = await userService.consumeCoin(userId);
      if (!consumption.success) {
        throw new Error(consumption.error || 'Failed to consume coin');
      }

      const newList: Omit<ShoppingList, 'id'> = {
        name,
        ownerId: userId,
        color,
        icon: '🛒',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sharedUsers: [],
        totalItems: 0,
        boughtItems: 0
      };

      const docRef = await addDoc(collection(db, 'lists'), newList);
      return docRef.id;
    }
    return null;
  },

  deleteList: async (listId: string) => {
    if (isFirebaseConfigured) {
      await deleteDoc(doc(db, 'lists', listId));
      const items = await getDocs(collection(db, 'lists', listId, 'items'));
      const batch = writeBatch(db);
      items.forEach(itemDoc => batch.delete(itemDoc.ref));
      await batch.commit();

      const shares = await getDocs(query(collection(db, 'shares'), where('listId', '==', listId)));
      const shareBatch = writeBatch(db);
      shares.forEach(shareDoc => shareBatch.delete(shareDoc.ref));
      await shareBatch.commit();
    }
  },

  updateListIcon: async (listId: string, icon: string, userId: string) => {
    if (isFirebaseConfigured) {
      await updateDoc(doc(db, 'lists', listId), { 
        icon, 
        lastUpdatedBy: userId,
        updatedAt: Date.now() 
      });
    }
  },

  // Items
  subscribeToItems: (listId: string, callback: (items: ListItem[]) => void) => {
    if (!isFirebaseConfigured || !listId) return () => { };

    const q = query(
      collection(db, 'lists', listId, 'items'),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ListItem));
      callback(items);
    });
  },

  syncListChanges: async (
    listId: string, 
    userId: string, 
    itemsToAdd: Omit<ListItem, 'id'>[], 
    itemsToUpdate: ListItem[], 
    itemsToDelete: string[],
    totalDiff: number = 0,
    boughtDiff: number = 0
  ) => {
    if (isFirebaseConfigured && listId && userId) {
      const consumption = await userService.consumeCoin(userId);
      if (!consumption.success) {
        throw new Error(consumption.error || 'Failed to consume coin');
      }

      const batch = writeBatch(db);
      const listRef = doc(db, 'lists', listId);

      // 1. Process Additions
      itemsToAdd.forEach(item => {
        const itemRef = doc(collection(db, 'lists', listId, 'items'));
        batch.set(itemRef, cleanObject({ ...item, createdAt: Date.now() }));

        // Track suggestion (best effort, batch.set doesn't support increment directly in set usually without more logic, but we can do it after)
      });

      // 2. Process Updates
      itemsToUpdate.forEach(item => {
        const itemRef = doc(db, 'lists', listId, 'items', item.id);
        const { id, ...data } = item;
        batch.update(itemRef, data);
      });

      // 3. Process Deletions
      itemsToDelete.forEach(itemId => {
        const itemRef = doc(db, 'lists', listId, 'items', itemId);
        batch.delete(itemRef);
      });

      // 4. Update list metadata
      batch.update(listRef, { 
        updatedAt: Date.now(),
        lastUpdatedBy: userId,
        totalItems: increment(totalDiff),
        boughtItems: increment(boughtDiff)
      });

      await batch.commit();

      return true;
    }
    return false;
  },

  // Legacy individual methods kept for simple standalone operations if needed, 
  // but we will primarily use syncListChanges in the UI.
  addItem: async (listId: string, name: string, quantity: string, userId: string) => {
    // Kept for backward compatibility but UI will move to local-first batching
    return null; 
  },

  toggleItem: async (listId: string, itemId: string, isBought: boolean) => {
    // UI will batch this
  },

  deleteItem: async (listId: string, itemId: string) => {
    // UI will batch this
  },

  // Sharing
  createShareLink: async (listId: string, permission: Permission, type: 'list' | 'collection' = 'list') => {
    if (!isFirebaseConfigured) return;
    const docRef = await addDoc(collection(db, 'shares'), {
      listId,
      type,
      permission,
      isActive: true,
      createdAt: Date.now()
    });
    return docRef.id;
  },

  joinList: async (listId: string, userId: string) => {
    if (!isFirebaseConfigured) return;
    await updateDoc(doc(db, 'lists', listId), {
      sharedUsers: arrayUnion(userId)
    });
  },

  joinCollection: async (ownerId: string, followerId: string) => {
    if (!isFirebaseConfigured) return;
    const docId = `${followerId}_${ownerId}`;
    await setDoc(doc(db, 'followed_collections', docId), {
      followerId,
      ownerId,
      createdAt: Date.now()
    });
  },

  subscribeToShares: (listId: string, callback: (shares: ShareLink[]) => void) => {
    if (!isFirebaseConfigured) return () => { };
    const q = query(collection(db, 'shares'), where('listId', '==', listId));
    return onSnapshot(q, (snapshot) => {
      const shares = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShareLink));
      callback(shares);
    });
  },

  toggleShareActive: async (shareId: string, isActive: boolean) => {
    if (isFirebaseConfigured) {
      await updateDoc(doc(db, 'shares', shareId), { isActive });
    }
  },

  deleteShare: async (shareId: string) => {
    if (isFirebaseConfigured) {
      await deleteDoc(doc(db, 'shares', shareId));
    }
  },

  getShare: async (shareId: string) => {
    if (!isFirebaseConfigured) return null;
    const shareDoc = await getDoc(doc(db, 'shares', shareId));
    if (!shareDoc.exists()) return null;
    return { id: shareDoc.id, ...shareDoc.data() } as ShareLink;
  },

  getList: async (listId: string) => {
    if (!isFirebaseConfigured) return null;
    const listDoc = await getDoc(doc(db, 'lists', listId));
    if (!listDoc.exists()) return null;
    return { id: listDoc.id, ...listDoc.data() } as ShoppingList;
  },

  subscribeToList: (listId: string, callback: (list: ShoppingList | null) => void) => {
    if (!isFirebaseConfigured) return () => { };
    return onSnapshot(doc(db, 'lists', listId), (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as ShoppingList);
      } else {
        callback(null);
      }
    });
  },

  markListAsViewed: (listId: string) => {
    localStorage.setItem(`list_last_viewed_${listId}`, Date.now().toString());
  },

  getLastViewedAt: (listId: string): number => {
    const val = localStorage.getItem(`list_last_viewed_${listId}`);
    return val ? parseInt(val, 10) : 0;
  }
};
