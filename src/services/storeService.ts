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
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { Store, StoreProduct } from '../types';

export const storeService = {
  // Store Management
  applyForMerchant: async (ownerId: string, storeData: Partial<Store>) => {
    if (!isFirebaseConfigured || !db) {
      console.error("[StoreService] Firebase not configured correctly.");
      throw new Error("Unable to connect to registration service. Please check your internet connection and try again.");
    }
    
    const store: Omit<Store, 'id'> = {
      ownerId,
      name: storeData.name || 'New Store',
      description: storeData.description || '',
      category: storeData.category || 'Grocery',
      location: storeData.location,
      isVerified: false,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      followersCount: 0
    };

    try {
      console.log("[StoreService] Attempting to create store application:", store);
      const docRef = await addDoc(collection(db, 'stores'), store);
      console.log("[StoreService] Store application created with ID:", docRef.id);
      return docRef;
    } catch (error: any) {
      console.error("[StoreService] Failed to create store document:", error);
      throw error;
    }
  },

  getStoreByOwner: async (ownerId: string): Promise<Store | null> => {
    if (!isFirebaseConfigured) return null;
    const q = query(collection(db, 'stores'), where('ownerId', '==', ownerId), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Store;
  },

  updateStore: async (storeId: string, data: Partial<Store>) => {
    if (!isFirebaseConfigured) return;
    const storeRef = doc(db, 'stores', storeId);
    await updateDoc(storeRef, {
      ...data,
      updatedAt: Date.now()
    });
  },

  // Products
  addProduct: async (storeId: string, productData: Partial<StoreProduct>) => {
    if (!isFirebaseConfigured) return;
    const product: Omit<StoreProduct, 'id'> = {
      storeId,
      name: productData.name || 'New Product',
      description: productData.description || '',
      price: productData.price || 0,
      currency: productData.currency || 'USD',
      inStock: productData.inStock ?? true,
      category: productData.category || 'General',
      likesCount: 0,
      saleStart: productData.saleStart,
      saleEnd: productData.saleEnd,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    return await addDoc(collection(db, 'store_products'), product);
  },

  updateProduct: async (productId: string, data: Partial<StoreProduct>) => {
    if (!isFirebaseConfigured) return;
    const productRef = doc(db, 'store_products', productId);
    await updateDoc(productRef, {
      ...data,
      updatedAt: Date.now()
    });
  },

  deleteProduct: async (productId: string) => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(db, 'store_products', productId));
  },

  subscribeToStoreProducts: (storeId: string, callback: (products: StoreProduct[]) => void) => {
    if (!isFirebaseConfigured) return () => {};
    const q = query(
      collection(db, 'store_products'), 
      where('storeId', '==', storeId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreProduct));
      callback(products);
    });
  },

  // Discovery
  getAllActiveStores: async (): Promise<Store[]> => {
    if (!isFirebaseConfigured) return [];
    const q = query(
      collection(db, 'stores'), 
      where('status', '==', 'active'),
      orderBy('followersCount', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
  },

  // Admin Methods
  subscribeToPendingStores: (callback: (stores: Store[]) => void) => {
    if (!isFirebaseConfigured) return () => {};
    const q = query(
      collection(db, 'stores'), 
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const stores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
      callback(stores);
    });
  },

  approveStore: async (storeId: string, ownerId: string) => {
    if (!isFirebaseConfigured) return;
    const storeRef = doc(db, 'stores', storeId);
    const userRef = doc(db, 'users', ownerId);
    
    // Use a batch to update both store and user
    const batch = writeBatch(db);
    batch.update(storeRef, { 
      status: 'active', 
      isVerified: true,
      updatedAt: Date.now() 
    });
    batch.update(userRef, { isMerchant: true });
    
    await batch.commit();
  },

  rejectStore: async (storeId: string) => {
    if (!isFirebaseConfigured) return;
    const storeRef = doc(db, 'stores', storeId);
    await updateDoc(storeRef, { 
      status: 'rejected',
      updatedAt: Date.now()
    });
  }
};
