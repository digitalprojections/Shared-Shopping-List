import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL, PurchasesPackage, PRODUCT_CATEGORY } from '@revenuecat/purchases-capacitor';
import { RevenueCatUI } from '@revenuecat/purchases-capacitor-ui';
import { APP_CONFIG } from '../config';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export const iapService = {
  presentPaywall: async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await RevenueCatUI.presentPaywall();
    } catch (e) {
      console.error('IAP: Error showing paywall:', e);
    }
  },
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
      console.log(`IAP: RevenueCat configured with key: ${apiKey.substring(0, 8)}...`);
      console.log('IAP: RevenueCat configured successfully.');
    } catch (e) {
      console.error('IAP: Error configuring RevenueCat:', e);
    }
  },

  getPackages: async (): Promise<PurchasesPackage[]> => {
    if (!Capacitor.isNativePlatform()) return [];
    
    // These are the technical IDs in Google Play / App Store (keeping for now to avoid breaking existing setups)
    const productIds = ['coins_50', 'coins_200', 'coins_500', 'coins_1000', 'coins_1200'];

    try {
      console.log('IAP: (Step 1) Attempting to fetch offerings...');
      const offerings = await Purchases.getOfferings();

      if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
        console.log(`IAP: Found ${offerings.current.availablePackages.length} packages in current offering.`);
        return offerings.current.availablePackages;
      }

      const allOfferings = Object.values(offerings.all);
      if (allOfferings.length > 0) {
        console.log(`IAP: Using fallback offering: ${allOfferings[0].identifier}`);
        return allOfferings[0].availablePackages;
      }

      console.log('IAP: No offerings found. Moving to direct product fetch...');
    } catch (e) {
      console.warn('IAP: getOfferings failed (expected if no offerings set). Trying products fetch...');
    }

    try {
      console.log('IAP: (Step 2) Attempting to fetch products directly:', productIds);
      const { products } = await Purchases.getProducts({
        productIdentifiers: productIds,
        type: PRODUCT_CATEGORY.NON_SUBSCRIPTION
      });

      if (products && products.length > 0) {
        console.log(`IAP: Successfully fetched ${products.length} products directly.`);
        return products.map(p => ({
          identifier: p.identifier,
          packageType: 'CUSTOM' as any,
          product: p,
          presentedOfferingContext: {
            offeringIdentifier: 'direct_products',
            placementIdentifier: null,
            targetingContext: null
          } as any,
          webCheckoutUrl: null
        } as unknown as PurchasesPackage));
      }
      console.warn('IAP: No products found in Google Play for the provided IDs.');
    } catch (e) {
      console.error('IAP: Error in direct product fetch:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
    }

    return [];
  },

  purchasePackage: async (pack: PurchasesPackage): Promise<{ success: boolean; error?: string }> => {
    if (!Capacitor.isNativePlatform()) {
      return { success: false, error: 'In-app purchases are only available on mobile.' };
    }

    try {
      console.log(`IAP: Starting purchase for ${pack.product.identifier}`);

      let customerInfo;
      // If it's a direct product fetch, use purchaseStoreProduct
      // presentedOfferingContext.offeringIdentifier is the non-deprecated way to check this
      if (pack.presentedOfferingContext?.offeringIdentifier === 'direct_products') {
        const result = await Purchases.purchaseStoreProduct({ product: pack.product });
        customerInfo = result.customerInfo;
      } else {
        const result = await Purchases.purchasePackage({ aPackage: pack });
        customerInfo = result.customerInfo;
      }

      console.log('IAP: Purchase successful, calling backend...', customerInfo);

      // Call backend to update fuel
      const grantPurchaseFuel = httpsCallable(functions, 'grantPurchaseFuel');
      await grantPurchaseFuel({
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

  getFuelForProduct: (identifier: string): number => {
    // Explicit mapping for known product IDs
    const FUEL_MAP: Record<string, number> = {
      'coins_50': 50,
      'coins_200': 200,
      'coins_500': 500,
      'coins_1200': 1200
    };

    if (FUEL_MAP[identifier]) return FUEL_MAP[identifier];

    // Dynamic parsing for IDs like "coins_100" (the underlying IAP IDs still use "coins")
    const match = identifier.match(/coins_(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }

    return 0; // Default fallback
  }
};
