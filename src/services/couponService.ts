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
  generateCoupon: async (fuelAmount: number): Promise<string | null> => {
    if (!isFirebaseConfigured) return null;
    
    // Generate a code like SHOP-XXXX-YYYY
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    const genPart = () => Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    const code = `SHOP-${genPart()}-${genPart()}`;
    
    const couponRef = doc(db, 'coupons', code);
    const coupon: Omit<Coupon, 'id'> = {
      code,
      fuelAmount,
      isConsumed: false,
      consumedBy: null,
      createdAt: Date.now()
    };
    
    await setDoc(couponRef, coupon);
    return code;
  },

  redeemFuelCoupon: async (userId: string, code: string): Promise<{ success: boolean; message: string; fuel?: number }> => {
    if (!isFirebaseConfigured) return { success: false, message: 'Firebase not configured' };
    
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../lib/firebase');
      
      const redeemFuelCouponFn = httpsCallable<{ code: string }, { success: boolean; message: string; fuel: number }>(functions, 'redeemFuelCoupon');
      const result = await redeemFuelCouponFn({ code });
      
      return { 
        success: result.data.success, 
        message: result.data.message, 
        fuel: result.data.fuel 
      };
    } catch (error: any) {
      console.error("Error redeeming coupon:", error);
      return { 
        success: false, 
        message: error.message || 'Failed to redeem coupon' 
      };
    }
  },

  claimFreeFuelGift: async (): Promise<{ success: boolean; message: string; fuel?: number }> => {
    if (!isFirebaseConfigured) return { success: false, message: 'Firebase not configured' };
    
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../lib/firebase');
      
      const claimFn = httpsCallable<void, { success: boolean; message: string; fuel: number }>(functions, 'claimFreeFuelGift');
      const result = await claimFn();
      
      return { 
        success: result.data.success, 
        message: result.data.message, 
        fuel: result.data.fuel 
      };
    } catch (error: any) {
      console.error("Error claiming free gift:", error);
      return { 
        success: false, 
        message: error.message || 'Failed to claim free gift' 
      };
    }
  }
};
