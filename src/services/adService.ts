import { AdMob, AdMobRewardItem, RewardAdOptions, RewardAdPluginEvents } from '@capacitor-community/admob';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

const TEST_REWARDED_AD_ID = 'ca-app-pub-3940256099942544/5224354917';
const REAL_REWARDED_AD_ID = 'ca-app-pub-3838820812386239/1441303359';

const REWARDED_AD_ID = import.meta.env.DEV ? TEST_REWARDED_AD_ID : REAL_REWARDED_AD_ID;

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

        const rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: AdMobRewardItem) => {
          rewardReceived = true;
          console.log('Reward received:', reward);
        });

        const dismissListener = await AdMob.addListener(RewardAdPluginEvents.Dismissed, async () => {
          rewardListener.remove();
          dismissListener.remove();
          
          if (rewardReceived) {
            try {
              const grantRewardedCoin = httpsCallable(functions, 'grantRewardedCoin');
              const result = await grantRewardedCoin();
              resolve(result.data as { success: boolean; error?: string });
            } catch (err: any) {
              resolve({ success: false, error: err.message || 'Failed to grant reward' });
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
