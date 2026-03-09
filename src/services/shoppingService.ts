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
  writeBatch
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { localDB } from '../lib/db';
import { ShoppingList, ListItem, ShareLink, Permission } from '../types';

export const shoppingService = {
  // Lists
  subscribeToLists: (userId: string, callback: (lists: ShoppingList[]) => void) => {
    // 1. Initial load from local DB
    localDB.lists.where('ownerId').equals(userId).sortBy('updatedAt').then(lists => {
      callback(lists.reverse());
    });

    if (!isFirebaseConfigured) return () => {};

    // 2. Listen to Firebase and sync to local
    const q = query(
      collection(db, 'lists'), 
      where('ownerId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    
    return onSnapshot(q, async (snapshot) => {
      const remoteLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShoppingList));
      
      // Update local DB
      await localDB.lists.bulkPut(remoteLists);
      
      // Clean up local lists that were deleted remotely
      const remoteIds = remoteLists.map(l => l.id);
      const localLists = await localDB.lists.where('ownerId').equals(userId).toArray();
      const toDelete = localLists.filter(l => !remoteIds.includes(l.id)).map(l => l.id);
      if (toDelete.length > 0) await localDB.lists.bulkDelete(toDelete);

      callback(remoteLists);
    });
  },

  createList: async (userId: string, name: string, color: string) => {
    const newList: Omit<ShoppingList, 'id'> = {
      name,
      ownerId: userId,
      color,
      createdAt: Date.now(),
      updatedAt: Date.now()
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
  subscribeToItems: (listId: string, callback: (items: ListItem[]) => void) => {
    // 1. Initial load from local DB
    localDB.items.where('listId').equals(listId).sortBy('createdAt').then(items => {
      callback(items);
    });

    if (!isFirebaseConfigured) return () => {};

    // 2. Listen to Firebase and sync to local
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

      callback(remoteItems);
    });
  },

  addItem: async (listId: string, name: string, quantity: string) => {
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
  createShareLink: async (listId: string, permission: Permission) => {
    if (!isFirebaseConfigured) return;
    const docRef = await addDoc(collection(db, 'shares'), {
      listId,
      permission,
      isActive: true,
      createdAt: Date.now()
    });
    return docRef.id;
  },

  subscribeToShares: (listId: string, callback: (shares: ShareLink[]) => void) => {
    if (!isFirebaseConfigured) return () => {};
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
