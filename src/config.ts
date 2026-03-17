export const APP_CONFIG = {
  // Application URLs
  PROD_URL: 'https://created.link/listshare/',
  BASE_PATH: '/listshare/',

  // AdMob Configuration
  ADMOB: {
    APP_ID_ANDROID: 'ca-app-pub-3838820812386239~9298923713',
    REWARDED_ID_REAL: 'ca-app-pub-3838820812386239/1441303359',
    REWARDED_ID_TEST: 'ca-app-pub-3940256099942544/5224354917',
  },

  // RevenueCat / IAP Configuration
  REVENUE_CAT: {
    GOOGLE_API_KEY: 'goog_FjBsfIBUnQhNAtgCZilIWEZohrf', 
    APPLE_API_KEY: 'test_uBTacnjuHZqnHAGsjjloxsJhMCm',
  },

  // Metadata
  APP_NAME: 'ListShare',
  SUPPORT_EMAIL: 'support@created.link',

  // Rate Limiting & Cooldowns
  RATE_LIMITS: {
    COUPON_REDEEM_COOLDOWN: 10000,
  },

  // User Defaults and Settings
  USER: {
    DEFAULT_AVATAR_SIZE: '=s96-c',
    ANONYMOUS_AVATAR_SEED: 'ListShare-Guest',
  }
};

export const isDev = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;
