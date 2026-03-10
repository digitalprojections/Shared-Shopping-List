import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  runTransaction,
  serverTimestamp 
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { Coupon } from '../types';

export const couponService = {
  generateCoupon: async (coinsAmount: number): Promise<string | null> => {
    if (!isFirebaseConfigured) return null;
    
    // Generate a code like SHOP-XXXX-YYYY
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    const genPart = () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const code = `SHOP-${genPart()}-${genPart()}`;
    
    const couponRef = doc(db, 'coupons', code);
    const coupon: Omit<Coupon, 'id'> = {
      code,
      coinsAmount,
      isConsumed: false,
      consumedBy: null,
      createdAt: Date.now()
    };
    
    await setDoc(couponRef, coupon);
    return code;
  },

  redeemCoupon: async (userId: string, code: string): Promise<{ success: boolean; message: string; coins?: number }> => {
    if (!isFirebaseConfigured) return { success: false, message: 'Firebase not configured' };
    
    const couponRef = doc(db, 'coupons', code.trim().toUpperCase());
    const userRef = doc(db, 'users', userId);
    
    try {
      const result = await runTransaction(db, async (transaction) => {
        const couponDoc = await transaction.get(couponRef);
        if (!couponDoc.exists()) {
          throw new Error('Invalid coupon code');
        }
        
        const couponData = couponDoc.data() as Coupon;
        if (couponData.isConsumed) {
          throw new Error('This coupon has already been used');
        }
        
        // Update coupon
        transaction.update(couponRef, {
          isConsumed: true,
          consumedBy: userId,
          consumedAt: Date.now()
        });
        
        // Update user balance
        transaction.update(userRef, {
          coinBalance: increment(couponData.coinsAmount)
        });
        
        return couponData.coinsAmount;
      });
      
      return { success: true, message: `Successfully redeemed ${result} coins!`, coins: result };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to redeem coupon' };
    }
  }
};
