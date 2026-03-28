import { AdMob, AdMobRewardItem, RewardAdOptions, RewardAdPluginEvents, RewardInterstitialAdPluginEvents, AdMobRewardInterstitialItem, RewardInterstitialAdOptions } from '@capacitor-community/admob';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { APP_CONFIG, isDev, isProduction } from '../config';

const REWARDED_AD_ID = isDev 
  ? APP_CONFIG.ADMOB.REWARDED_ID_TEST 
  : APP_CONFIG.ADMOB.REWARDED_ID_REAL;

const INTERSTITIAL_REWARDED_ID = isDev
  ? APP_CONFIG.ADMOB.REWARDED_ID_TEST // Use standard rewarded test ID for dev
  : APP_CONFIG.ADMOB.INTERSTITIAL_REWARDED_ID_REAL;

export const adService = {
  initialize: async () => {
    console.log(`AdMob: Initializing in ${import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
    console.log(`AdMob: Using ${import.meta.env.DEV ? 'TEST' : 'REAL'} Ad Unit ID`);
    await AdMob.initialize();
  },

  showRewardedAd: async (isPremium: boolean = false): Promise<{ success: boolean; error?: string }> => {
    try {
      const adId = isPremium ? INTERSTITIAL_REWARDED_ID : REWARDED_AD_ID;
      console.log(`AdMob: Showing ${isPremium ? 'Premium (Interstitial Rewarded)' : 'Standard (Rewarded)'} Ad. Unit ID: ${adId}`);
      
      const options: RewardAdOptions | RewardInterstitialAdOptions = {
        adId: adId,
      };

      if (isPremium) {
        await AdMob.prepareRewardInterstitialAd(options as RewardInterstitialAdOptions);
      } else {
        await AdMob.prepareRewardVideoAd(options as RewardAdOptions);
      }
      
      return new Promise(async (resolve) => {
        let rewardReceived = false;
        let rewardAmount = 1;

        const rewardedEvent = isPremium ? RewardInterstitialAdPluginEvents.Rewarded : RewardAdPluginEvents.Rewarded;
        const dismissedEvent = isPremium ? RewardInterstitialAdPluginEvents.Dismissed : RewardAdPluginEvents.Dismissed;
        const failedEvent = isPremium ? RewardInterstitialAdPluginEvents.FailedToLoad : RewardAdPluginEvents.FailedToLoad;

        const rewardListener = await AdMob.addListener(rewardedEvent as any, (reward: AdMobRewardItem | AdMobRewardInterstitialItem) => {
          rewardReceived = true;
          rewardAmount = reward.amount || 1;
          console.log('Reward received:', reward);
        });

        const dismissListener = await AdMob.addListener(dismissedEvent as any, async () => {
          rewardListener.remove();
          dismissListener.remove();
          
          if (rewardReceived) {
            try {
              const grantRewardedFuel = httpsCallable(functions, 'grantRewardedFuel');
              const result = await grantRewardedFuel({ amount: rewardAmount });
              resolve(result.data as { success: boolean; error?: string });
            } catch (err: any) {
              resolve({ success: false, error: err.message || 'Failed to grant fuel reward' });
            }
          } else {
            resolve({ success: false, error: 'Ad dismissed before completion' });
          }
        });

        const failedListener = await AdMob.addListener(failedEvent as any, (err) => {
          rewardListener.remove();
          dismissListener.remove();
          failedListener.remove();
          resolve({ success: false, error: 'Failed to load ad' });
        });

        const showMethod = isPremium ? AdMob.showRewardInterstitialAd() : AdMob.showRewardVideoAd();
        
        showMethod.catch(err => {
          rewardListener.remove();
          dismissListener.remove();
          failedListener.remove();
          resolve({ success: false, error: 'Failed to show ad' });
        });
      });
    } catch (error: any) {
      console.error('Error showing rewarded ad:', error);
      return { success: false, error: error.message || 'An unknown error occurred' };
    }
  }
};
