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
  writeBatch,
  setDoc,
  arrayUnion,
  arrayRemove,
  increment,
  runTransaction
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, isFirebaseConfigured, auth, cleanObject, storage } from '../lib/firebase';
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
      location: storeData.location || null,
      workingHours: storeData.workingHours || '',
      contactPhone: storeData.contactPhone || '',
      website: storeData.website || '',
      themeColor: storeData.themeColor || '',
      bannerUrl: storeData.bannerUrl || '',
      logoUrl: storeData.logoUrl || '',
      isVerified: false,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      followersCount: 0
    };

    try {
      // Diagnostic: Check Auth status immediately before write
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("You must be logged in to submit an application. Please try signing in again.");
      }
      
      console.log("[StoreService] Validating collection reference...");
      const colRef = collection(db, 'stores');
      
      console.log("[StoreService] Writing as user:", currentUser.uid);
      
      // Use setDoc with a manually generated ID to see if it bypasses the hang
      const newDocRef = doc(colRef);
      console.log("[StoreService] Prepared ID:", newDocRef.id, "Data:", store);
      
      await setDoc(newDocRef, {
        ...store,
        ownerId: ownerId // Ensure we don't lose the ownerId
      });
      
      console.log("[StoreService] Store application created successfully with ID:", newDocRef.id);
      return newDocRef;
    } catch (error) {
      console.error("[StoreService] Failed to create store document:", error);
      throw error;
    }
  },

  getStoreByOwner: async (ownerId: string): Promise<Store | null> => {
    if (!isFirebaseConfigured || !ownerId) return null;
    const q = query(collection(db, 'stores'), where('ownerId', '==', ownerId), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Store;
  },

  updateStore: async (storeId: string, data: Partial<Store>) => {
    if (!isFirebaseConfigured) return;
    const storeRef = doc(db, 'stores', storeId);
    await updateDoc(storeRef, cleanObject({
      ...data,
      updatedAt: Date.now()
    }));
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
      saleStart: productData.saleStart ?? null,
      saleEnd: productData.saleEnd ?? null,
      imageUrl: productData.imageUrl || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    return await addDoc(collection(db, 'store_products'), product);
  },

  updateProduct: async (productId: string, data: Partial<StoreProduct>) => {
    if (!isFirebaseConfigured) return;
    const productRef = doc(db, 'store_products', productId);
    await updateDoc(productRef, cleanObject({
      ...data,
      updatedAt: Date.now()
    }));
  },

  deleteProduct: async (productId: string, imageUrl?: string) => {
    if (!isFirebaseConfigured) return;
    
    // 1. Delete image from storage if it exists
    if (imageUrl && storage) {
      try {
        // Firebase Storage URLs contain the full path between /o/ and ?alt=
        // Example: .../o/images%2FstoreId%2FfileName.jpg?alt=media...
        const decodedUrl = decodeURIComponent(imageUrl);
        const pathMatch = decodedUrl.match(/\/o\/(.*?)\?/);
        const pathPart = pathMatch ? pathMatch[1] : null;
        
        if (pathPart) {
          const imageRef = ref(storage, pathPart);
          await deleteObject(imageRef);
          console.log("[StoreService] Product image deleted from storage:", pathPart);
        }
      } catch (error) {
        console.error("[StoreService] Failed to delete product image:", error);
      }
    }

    await deleteDoc(doc(db, 'store_products', productId));
  },

  subscribeToStoreProducts: (storeId: string, callback: (products: StoreProduct[]) => void) => {
    if (!isFirebaseConfigured || !storeId) return () => {};
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

  uploadProductImage: async (storeId: string, file: File) => {
    if (!isFirebaseConfigured || !storage) return null;
    const fileName = `${Date.now()}_${file.name}`;
    const storageRef = ref(storage, `images/${storeId}/${fileName}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
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

  getStoreById: async (storeId: string): Promise<Store | null> => {
    if (!isFirebaseConfigured || !storeId) return null;
    const storeRef = doc(db, 'stores', storeId);
    const snap = await getDoc(storeRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Store;
  },

  followStore: async (storeId: string, userId: string) => {
    if (!isFirebaseConfigured) return;
    const storeRef = doc(db, 'stores', storeId);
    const userRef = doc(db, 'users', userId);
    
    const batch = writeBatch(db);
    batch.update(storeRef, {
      followers: arrayUnion(userId),
      followersCount: increment(1)
    });
    batch.set(userRef, {
      followedStores: arrayUnion(storeId)
    }, { merge: true });
    await batch.commit();
  },

  unfollowStore: async (storeId: string, userId: string) => {
    if (!isFirebaseConfigured) return;
    const storeRef = doc(db, 'stores', storeId);
    const userRef = doc(db, 'users', userId);
    
    const batch = writeBatch(db);
    batch.update(storeRef, {
      followers: arrayRemove(userId),
      followersCount: increment(-1)
    });
    batch.set(userRef, {
      followedStores: arrayRemove(storeId)
    }, { merge: true });
    await batch.commit();
  },

  rateStore: async (storeId: string, userId: string, rating: number) => {
    if (!isFirebaseConfigured || !db) return;
    
    const storeRef = doc(db, 'stores', storeId);
    const ratingRef = doc(db, 'stores', storeId, 'ratings', userId);
    
    await runTransaction(db, async (transaction) => {
      const ratingDoc = await transaction.get(ratingRef);
      const storeDoc = await transaction.get(storeRef);
      
      if (!storeDoc.exists()) throw new Error("Store does not exist!");
      
      const storeData = storeDoc.data() as Store;
      const oldRating = ratingDoc.exists() ? ratingDoc.data().rating : 0;
      
      let newCount = storeData.ratingCount || 0;
      let newSum = (storeData.averageRating || 0) * newCount;
      
      if (ratingDoc.exists()) {
        // Update existing rating
        newSum = newSum - oldRating + rating;
      } else {
        // Add new rating
        newCount += 1;
        newSum += rating;
      }
      
      const newAverage = newSum / newCount;
      
      transaction.set(ratingRef, {
        userId,
        rating,
        updatedAt: Date.now()
      });
      
      transaction.update(storeRef, {
        averageRating: newAverage,
        ratingCount: newCount,
        updatedAt: Date.now()
      });
    });
  },

  getUserRating: async (storeId: string, userId: string): Promise<number | null> => {
    if (!isFirebaseConfigured || !userId) return null;
    const ratingRef = doc(db, 'stores', storeId, 'ratings', userId);
    const ratingDoc = await getDoc(ratingRef);
    return ratingDoc.exists() ? ratingDoc.data().rating : null;
  },

  subscribeToMyStores: (ownerId: string, callback: (stores: Store[]) => void) => {
    if (!isFirebaseConfigured || !ownerId) return () => {};
    const q = query(
      collection(db, 'stores'), 
      where('ownerId', '==', ownerId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const stores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
      callback(stores);
    });
  },

  subscribeToAllStores: (callback: (stores: Store[]) => void) => {
    if (!isFirebaseConfigured) return () => {};
    const q = query(
      collection(db, 'stores'), 
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const stores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
      callback(stores);
    });
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
  },

  deleteStore: async (storeId: string) => {
    if (!isFirebaseConfigured) return;
    
    // 1. Get store data
    const storeRef = doc(db, 'stores', storeId);
    const storeSnap = await getDoc(storeRef);
    const storeData = storeSnap.data();
    
    if (storeData) {
      // 2. Cleanup banners/logos
      const bannerUrl = storeData.bannerUrl;
      const logoUrl = storeData.logoUrl;
      
      const cleanupImage = async (url: string) => {
        if (!url || !storage) return;
        try {
          const decodedUrl = decodeURIComponent(url);
          const pathMatch = decodedUrl.match(/\/o\/(.*?)\?/);
          const pathPart = pathMatch ? pathMatch[1] : null;
          if (pathPart) {
            await deleteObject(ref(storage, pathPart));
          }
        } catch (e) { console.warn("Failed to delete store image", url, e); }
      };
      
      await cleanupImage(bannerUrl);
      await cleanupImage(logoUrl);
    }
    
    // 3. Delete all products for this store
    const productsSnap = await getDocs(
      query(collection(db, 'store_products'), where('storeId', '==', storeId))
    );
    
    for (const prodDoc of productsSnap.docs) {
      const prodData = prodDoc.data();
      await storeService.deleteProduct(prodDoc.id, prodData.imageUrl);
    }
    
    // 4. Delete store doc
    await deleteDoc(storeRef);
  },

  // Stale Data Management
  listAllStorageImages: async () => {
    if (!isFirebaseConfigured || !storage) return [];
    
    const allFiles: { path: string; url: string }[] = [];
    
    const listRecursive = async (folderRef: any) => {
      const result = await folderRef.listAll();
      
      // Get URLs for all files in this folder
      for (const item of result.items) {
        const url = await getDownloadURL(item);
        allFiles.push({ path: item.fullPath, url });
      }
      
      // Recurse into subfolders
      for (const folder of result.prefixes) {
        await listRecursive(folder);
      }
    };

    try {
      const rootRef = ref(storage, 'images');
      await listRecursive(rootRef);
      return allFiles;
    } catch (error) {
      console.error("[StoreService] Error listing storage images:", error);
      return [];
    }
  },

  findStaleImages: async () => {
    if (!isFirebaseConfigured) return [];
    
    // 1. Get all images from Storage
    const storageImages = await storeService.listAllStorageImages();
    if (storageImages.length === 0) return [];

    // 2. Get all referenced image URLs from Firestore
    const referencedUrls = new Set<string>();
    
    // Check products
    const productsSnap = await getDocs(collection(db, 'store_products'));
    productsSnap.forEach(doc => {
      const data = doc.data();
      if (data.imageUrl) referencedUrls.add(data.imageUrl);
    });
    
    // Check stores (banners and logos)
    const storesSnap = await getDocs(collection(db, 'stores'));
    storesSnap.forEach(doc => {
      const data = doc.data();
      if (data.bannerUrl) referencedUrls.add(data.bannerUrl);
      if (data.logoUrl) referencedUrls.add(data.logoUrl);
    });

    // 3. Find images in storage that are NOT in referencedUrls
    const staleImages = storageImages.filter(img => !referencedUrls.has(img.url));
    
    return staleImages;
  },

  deleteStorageObject: async (path: string) => {
    if (!isFirebaseConfigured || !storage) return;
    const objectRef = ref(storage, path);
    await deleteObject(objectRef);
  }
};


