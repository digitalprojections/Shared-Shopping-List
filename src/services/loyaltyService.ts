import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { LoyaltyCard } from '../types';

export const loyaltyService = {
  subscribeToCards: (userId: string, callback: (cards: LoyaltyCard[]) => void) => {
    if (!isFirebaseConfigured) return () => { };

    const q = query(
      collection(db, 'loyalty_cards'),
      where('ownerId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LoyaltyCard));
      // Sort in memory to avoid requiring a composite index in Firestore
      cards.sort((a, b) => b.createdAt - a.createdAt);
      callback(cards);
    }, (error) => {
      console.error("Error subscribing to loyalty cards:", error);
    });
  },

  addCard: async (card: Omit<LoyaltyCard, 'id' | 'createdAt'>) => {
    if (!isFirebaseConfigured) return null;
    const docRef = await addDoc(collection(db, 'loyalty_cards'), {
      ...card,
      createdAt: Date.now()
    });
    return docRef.id;
  },

  updateCard: async (cardId: string, updates: Partial<LoyaltyCard>) => {
    if (!isFirebaseConfigured) return;
    await updateDoc(doc(db, 'loyalty_cards', cardId), updates);
  },

  deleteCard: async (cardId: string) => {
    if (!isFirebaseConfigured) return;
    await deleteDoc(doc(db, 'loyalty_cards', cardId));
  }
};
