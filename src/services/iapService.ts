import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { APP_CONFIG } from '../config';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export const iapService = {
  initialize: async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('IAP: Not a native platform, skipping RevenueCat initialization.');
      return;
    }

    try {
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      const apiKey = Capacitor.getPlatform() === 'android' 
        ? APP_CONFIG.REVENUE_CAT.GOOGLE_API_KEY 
        : APP_CONFIG.REVENUE_CAT.APPLE_API_KEY;
      
      await Purchases.configure({ apiKey });
      console.log('IAP: RevenueCat configured successfully.');
    } catch (e) {
      console.error('IAP: Error configuring RevenueCat:', e);
    }
  },

  getPackages: async (): Promise<PurchasesPackage[]> => {
    if (!Capacitor.isNativePlatform()) return [];

    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        return offerings.current.availablePackages;
      }
    } catch (e) {
      console.error('IAP: Error fetching offerings:', e);
    }
    return [];
  },

  purchasePackage: async (pack: PurchasesPackage): Promise<{ success: boolean; error?: string }> => {
    if (!Capacitor.isNativePlatform()) {
      return { success: false, error: 'In-app purchases are only available on mobile.' };
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pack });
      
      // For consumables (coins), we don't need to check entitlements.
      // If purchasePackage returns without error, the payment was successful.
      
      // Call backend to update coins
      const grantPurchaseCoins = httpsCallable(functions, 'grantPurchaseCoins');
      await grantPurchaseCoins({
        productId: pack.product.identifier,
        purchaseToken: customerInfo.originalAppUserId 
      });

      return { success: true };
    } catch (e: any) {
      if (e.userCancelled) {
        return { success: false, error: 'CANCELLED' };
      }
      console.error('IAP: Purchase error:', e);
      return { success: false, error: e.message || 'Error processing purchase' };
    }
  },

  getCoinsForProduct: (identifier: string): number => {
    // Mapping product IDs to coin amounts
    if (identifier.includes('coins_50')) return 50;
    if (identifier.includes('coins_200')) return 200;
    if (identifier.includes('coins_500')) return 500;
    if (identifier.includes('coins_1200')) return 1200;
    return 0; // Default fallback
  }
};
