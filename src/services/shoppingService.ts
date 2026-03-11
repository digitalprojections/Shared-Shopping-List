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
import { db, isFirebaseConfigured } from '../lib/firebase';
import { localDB } from '../lib/db';
import { ShoppingList, ListItem, ShareLink, Permission } from '../types';
import { userService } from './userService';

// Module-level sync state to persist across source updates
let syncTimeout: any = null;
const ownedSource = new Map<string, ShoppingList>();
const sharedSource = new Map<string, ShoppingList>();
const followedSources = new Map<string, Map<string, ShoppingList>>();

const commitSync = async () => {
  const mergedMap = new Map<string, ShoppingList>();
  
  // Merge results from all sources: Followed < Shared < Owned (priority)
  followedSources.forEach(source => {
    source.forEach((list, id) => mergedMap.set(id, list));
  });
  sharedSource.forEach((list, id) => mergedMap.set(id, list));
  ownedSource.forEach((list, id) => mergedMap.set(id, list));

  const finalLists = Array.from(mergedMap.values());
  const finalIds = finalLists.map(l => l.id);

  // Transactional bulk update
  await localDB.lists.bulkPut(finalLists);
  
  // Handled targeted deletions: remove local lists not present in any Firestore query
  const localIds = await localDB.lists.toCollection().primaryKeys() as string[];
  const toDelete = localIds.filter(id => !finalIds.includes(id as string));
  if (toDelete.length > 0) {
    await localDB.lists.bulkDelete(toDelete);
  }
};

const debouncedSync = () => {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    commitSync().catch(err => console.error("[Sync] Error during commit:", err));
  }, 200);
};

export const shoppingService = {
  // Lists
  subscribeToLists: (userId: string) => {
    // Clear state on new subscription
    ownedSource.clear();
    sharedSource.clear();
    followedSources.clear();

    if (!isFirebaseConfigured) return () => { };

    const unsubscribes: (() => void)[] = [];

    // Query 1: Owned lists
    const qOwned = query(collection(db, 'lists'), where('ownerId', '==', userId));
    unsubscribes.push(onSnapshot(qOwned, (snapshot) => {
      ownedSource.clear();
      snapshot.docs.forEach(doc => {
        ownedSource.set(doc.id, { id: doc.id, ...doc.data() } as ShoppingList);
      });
      debouncedSync();
    }, (err) => console.error("Firestore error (Owned Lists):", err)));

    // Query 2: Directly shared lists
    const qShared = query(collection(db, 'lists'), where('sharedUsers', 'array-contains', userId));
    unsubscribes.push(onSnapshot(qShared, (snapshot) => {
      sharedSource.clear();
      snapshot.docs.forEach(doc => {
        sharedSource.set(doc.id, { id: doc.id, ...doc.data() } as ShoppingList);
      });
      debouncedSync();
    }, (err) => console.error("Firestore error (Shared Lists):", err)));

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
            debouncedSync();
          }, (err) => console.error(`Firestore error (Followed Collection ${ownerId}):`, err));
          
          colUnsubscribes.set(ownerId, unsub);
        }
      });
      debouncedSync();
    }, (err) => console.error("Firestore error (Followed Collections):", err)));

    return () => {
      unsubscribes.forEach(u => u());
      colUnsubscribes.forEach(u => u());
    };
  },

  createList: async (userId: string, name: string, color: string) => {
    const newList: Omit<ShoppingList, 'id'> = {
      name,
      ownerId: userId,
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sharedUsers: []
    };

    if (isFirebaseConfigured) {
      const docRef = await addDoc(collection(db, 'lists'), newList);
      await localDB.lists.put({ id: docRef.id, ...newList });
      return docRef.id;
    } else {
      const id = Math.random().toString(36).substring(7);
      await localDB.lists.put({ id, ...newList });
      return id;
    }
  },

  deleteList: async (listId: string) => {
    await localDB.lists.delete(listId);
    await localDB.items.where('listId').equals(listId).delete();

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

  // Items
  subscribeToItems: (listId: string) => {
    if (!isFirebaseConfigured) return () => { };

    // Listen to Firebase and sync to local
    const q = query(
      collection(db, 'lists', listId, 'items'),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(q, async (snapshot) => {
      const remoteItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ListItem));

      // Update local DB
      const itemsWithListId = remoteItems.map(item => ({ ...item, listId }));
      await localDB.items.bulkPut(itemsWithListId);

      // Clean up local items
      const remoteIds = remoteItems.map(i => i.id);
      const localItems = await localDB.items.where('listId').equals(listId).toArray();
      const toDelete = localItems.filter(i => !remoteIds.includes(i.id)).map(i => i.id);
      if (toDelete.length > 0) await localDB.items.bulkDelete(toDelete);
    });
  },

  addItem: async (listId: string, name: string, quantity: string, userId: string) => {
    // Consume coin first
    if (isFirebaseConfigured) {
      const consumption = await userService.consumeCoin(userId);
      if (!consumption.success) {
        throw new Error(consumption.error || 'Failed to consume coin');
      }
    }

    const newItem: Omit<ListItem, 'id'> = {
      name,
      quantity,
      isBought: false,
      createdAt: Date.now()
    };

    if (isFirebaseConfigured) {
      const docRef = await addDoc(collection(db, 'lists', listId, 'items'), newItem);
      await localDB.items.put({ id: docRef.id, listId, ...newItem });
      await updateDoc(doc(db, 'lists', listId), { updatedAt: Date.now() });

      // Track suggestion
      const suggestionId = name.toLowerCase().trim();
      const suggestionRef = doc(db, 'suggestions', suggestionId);
      await setDoc(suggestionRef, {
        name: name.trim(),
        count: increment(1)
      }, { merge: true });
    } else {
      const id = Math.random().toString(36).substring(7);
      await localDB.items.put({ id, listId, ...newItem });
      await localDB.lists.update(listId, { updatedAt: Date.now() });
    }
  },

  toggleItem: async (listId: string, itemId: string, isBought: boolean) => {
    await localDB.items.update(itemId, { isBought });
    if (isFirebaseConfigured) {
      await updateDoc(doc(db, 'lists', listId, 'items', itemId), { isBought });
    }
  },

  deleteItem: async (listId: string, itemId: string) => {
    await localDB.items.delete(itemId);
    if (isFirebaseConfigured) {
      await deleteDoc(doc(db, 'lists', listId, 'items', itemId));
    }
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
    if (!isFirebaseConfigured) return;
    await updateDoc(doc(db, 'shares', shareId), { isActive });
  },

  deleteShare: async (shareId: string) => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(db, 'shares', shareId));
  },

  getShare: async (shareId: string) => {
    if (!isFirebaseConfigured) return null;
    const shareDoc = await getDoc(doc(db, 'shares', shareId));
    if (!shareDoc.exists()) return null;
    return { id: shareDoc.id, ...shareDoc.data() } as ShareLink;
  },

  getList: async (listId: string) => {
    // Try local first
    const localList = await localDB.lists.get(listId);
    if (localList) return localList;

    if (!isFirebaseConfigured) return null;
    const listDoc = await getDoc(doc(db, 'lists', listId));
    if (!listDoc.exists()) return null;
    const list = { id: listDoc.id, ...listDoc.data() } as ShoppingList;
    await localDB.lists.put(list);
    return list;
  },

  // Suggestions
  getSuggestions: async (input: string) => {
    if (!isFirebaseConfigured || !input || input.length < 2) return [];
    const q = query(
      collection(db, 'suggestions'),
      where('name', '>=', input),
      where('name', '<=', input + '\uf8ff'),
      orderBy('name'),
      orderBy('count', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().name as string);
  }
};
