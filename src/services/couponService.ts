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
import { Coupon, AppUser } from '../types';

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
        const userDoc = await transaction.get(userRef);
        
        if (!couponDoc.exists()) {
          throw new Error('Invalid coupon code');
        }
        
        const couponData = couponDoc.data() as Coupon;
        if (couponData.isConsumed) {
          throw new Error('This coupon has already been used');
        }
        
        const userData = userDoc.data() as AppUser;
        const now = Date.now();

        // Anti-abuse: 10-second cooldown for coupon redemption
        if (userData?.lastActionAt && (now - userData.lastActionAt < 10000)) {
          throw new Error('Please wait 10 seconds between coupon redemptions');
        }

        const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days
        
        const newBatch = {
          id: Math.random().toString(36).substring(7),
          amount: couponData.coinsAmount,
          remaining: couponData.coinsAmount,
          createdAt: now,
          expiresAt: expiresAt
        };

        const currentBatches = userData?.coinBatches || [];
        const updatedBatches = [...currentBatches, newBatch];
        
        // Recalculate total balance from valid batches
        const validBatches = updatedBatches.filter(b => b.expiresAt > now);
        const totalBalance = validBatches.reduce((sum, b) => sum + b.remaining, 0);

        // Update coupon
        transaction.update(couponRef, {
          isConsumed: true,
          consumedBy: userId,
          consumedAt: now
        });
        
        // Update user
        transaction.update(userRef, {
          coinBatches: updatedBatches,
          coinBalance: totalBalance,
          lastActionAt: now
        });
        
        return couponData.coinsAmount;
      });
      
      return { success: true, message: `Successfully redeemed ${result} coins!`, coins: result };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to redeem coupon' };
    }
  }
};
