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
  serverTimestamp,
  getDoc,
  getDocs,
  setDoc,
  increment
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { ShoppingList, ListItem, ShareLink, Permission } from '../types';

export const shoppingService = {
  // Lists
  subscribeToLists: (userId: string, callback: (lists: ShoppingList[]) => void) => {
    if (!isFirebaseConfigured) return () => {};
    const q = query(
      collection(db, 'lists'), 
      where('ownerId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShoppingList));
      callback(lists);
    });
  },

  createList: async (userId: string, name: string, color: string) => {
    if (!isFirebaseConfigured) return;
    return addDoc(collection(db, 'lists'), {
      name,
      ownerId: userId,
      color,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  },

  deleteList: async (listId: string) => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(db, 'lists', listId));
    // Also delete items and shares (ideally in a batch or cloud function, but here we do it simply)
    const items = await getDocs(collection(db, 'lists', listId, 'items'));
    items.forEach(async (itemDoc) => await deleteDoc(itemDoc.ref));
    const shares = await getDocs(query(collection(db, 'shares'), where('listId', '==', listId)));
    shares.forEach(async (shareDoc) => await deleteDoc(shareDoc.ref));
  },

  // Items
  subscribeToItems: (listId: string, callback: (items: ListItem[]) => void) => {
    if (!isFirebaseConfigured) return () => {};
    const q = query(
      collection(db, 'lists', listId, 'items'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ListItem));
      callback(items);
    });
  },

  addItem: async (listId: string, name: string, quantity: string) => {
    if (!isFirebaseConfigured) return;
    await addDoc(collection(db, 'lists', listId, 'items'), {
      name,
      quantity,
      isBought: false,
      createdAt: Date.now()
    });
    
    // Update list timestamp
    await updateDoc(doc(db, 'lists', listId), { updatedAt: Date.now() });

    // Track suggestion (global or per user)
    // For simplicity, we'll just store a global 'suggestions' collection
    const suggestionId = name.toLowerCase().trim();
    const suggestionRef = doc(db, 'suggestions', suggestionId);
    await setDoc(suggestionRef, { 
      name: name.trim(), 
      count: increment(1) 
    }, { merge: true });
  },

  toggleItem: async (listId: string, itemId: string, isBought: boolean) => {
    if (!isFirebaseConfigured) return;
    await updateDoc(doc(db, 'lists', listId, 'items', itemId), { isBought });
  },

  deleteItem: async (listId: string, itemId: string) => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(db, 'lists', listId, 'items', itemId));
  },

  // Sharing
  createShareLink: async (listId: string, permission: Permission) => {
    if (!isFirebaseConfigured) return;
    return addDoc(collection(db, 'shares'), {
      listId,
      permission,
      isActive: true,
      createdAt: Date.now()
    });
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
    if (!isFirebaseConfigured) return null;
    const listDoc = await getDoc(doc(db, 'lists', listId));
    if (!listDoc.exists()) return null;
    return { id: listDoc.id, ...listDoc.data() } as ShoppingList;
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
