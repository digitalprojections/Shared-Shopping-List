import { AdMob, AdMobRewardItem, RewardAdOptions, RewardAdPluginEvents } from '@capacitor-community/admob';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { APP_CONFIG, isDev } from '../config';

const REWARDED_AD_ID = isDev 
  ? APP_CONFIG.ADMOB.REWARDED_ID_TEST 
  : APP_CONFIG.ADMOB.REWARDED_ID_REAL;

export const adService = {
  initialize: async () => {
    console.log(`AdMob: Initializing in ${import.meta.env.DEV ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
    console.log(`AdMob: Using ${import.meta.env.DEV ? 'TEST' : 'REAL'} Ad Unit ID`);
    await AdMob.initialize();
  },

  showRewardedAd: async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const options: RewardAdOptions = {
        adId: REWARDED_AD_ID,
      };

      await AdMob.prepareRewardVideoAd(options);
      
      return new Promise(async (resolve) => {
        let rewardReceived = false;
        let rewardAmount = 1;

        const rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: AdMobRewardItem) => {
          rewardReceived = true;
          rewardAmount = reward.amount || 1;
          console.log('Reward received:', reward);
        });

        const dismissListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, async () => {
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

        const failedListener = await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (err) => {
          rewardListener.remove();
          dismissListener.remove();
          failedListener.remove();
          resolve({ success: false, error: 'Failed to load ad' });
        });

        AdMob.showRewardVideoAd()
          .catch(err => {
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
