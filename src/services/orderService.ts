import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  orderBy,
  getDoc,
  arrayUnion,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, isFirebaseConfigured, auth, cleanObject, functions } from '../lib/firebase';
import { Order, OrderStatus, ChatMessage } from '../types';

export const orderService = {
  createOrder: async (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'chat'>) => {
    if (!isFirebaseConfigured || !db) return null;
    
    // Sanitize order data to remove undefined fields which Firestore doesn't like
    const sanitizedItems = orderData.items.map(item => cleanObject(item));
    
    const order = cleanObject({
      ...orderData,
      items: sanitizedItems,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chat: []
    });
    
    return await addDoc(collection(db, 'orders'), order);
  },

  updateOrderStatus: async (orderId: string, status: OrderStatus, deliveryTime?: string) => {
    if (!isFirebaseConfigured || !functions) return;
    try {
      const processOrder = httpsCallable(functions, 'processOrder');
      await processOrder({ orderId, status, deliveryTime });
    } catch (error) {
      console.error("Error updating order status:", error);
      throw error;
    }
  },

  sendChatMessage: async (orderId: string, senderId: string, text: string) => {
    if (!isFirebaseConfigured) return;
    const orderRef = doc(db, 'orders', orderId);
    const message: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId,
      text,
      createdAt: Date.now()
    };
    await updateDoc(orderRef, {
      chat: arrayUnion(message),
      updatedAt: Date.now()
    });
  },

  getOrderById: async (orderId: string): Promise<Order | null> => {
    if (!isFirebaseConfigured || !orderId) return null;
    const orderRef = doc(db, 'orders', orderId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Order;
  },

  subscribeToUserOrders: (userId: string, callback: (orders: Order[]) => void, onError?: (error: any) => void) => {
    if (!isFirebaseConfigured || !userId) return () => {};
    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      callback(orders);
    }, onError);
  },

  subscribeToStoreOrders: (storeId: string, callback: (orders: Order[]) => void, onError?: (error: any) => void) => {
    if (!isFirebaseConfigured || !storeId) return () => {};
    const q = query(
      collection(db, 'orders'),
      where('storeId', '==', storeId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      callback(orders);
    }, onError);
  },

  subscribeToOrder: (orderId: string, callback: (order: Order) => void, onError?: (error: any) => void) => {
    if (!isFirebaseConfigured || !orderId) return () => {};
    const orderRef = doc(db, 'orders', orderId);
    return onSnapshot(orderRef, (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() } as Order);
      }
    }, onError);
  },

  subscribeToStoresOrders: (storeIds: string[], callback: (orders: Order[]) => void, onError?: (error: any) => void) => {
    if (!isFirebaseConfigured || !storeIds || storeIds.length === 0) return () => {};
    // Firestore 'in' query supports up to 10 items
    const q = query(
      collection(db, 'orders'),
      where('storeId', 'in', storeIds.slice(0, 10)),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      callback(orders);
    }, onError);
  }
};
