import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Share2,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronLeft,
  Copy,
  Link as LinkIcon,
  X,
  MoreVertical,
  LogOut,
  ShoppingBag,
  Fuel,
  Ticket,
  Crown,
  History,
  Clock,
  RefreshCw,
  PlayCircle,
  Shield,
  User as UserIcon,
  ExternalLink,
  LayoutGrid,
  List,
  RotateCcw,
  Gift,
  CreditCard,
  MapIcon,
  MapPin,
  MapPinPlus,
  Package,
  ChevronRight
} from 'lucide-react';
import { adService } from './services/adService';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from './lib/firebase';
import { PushNotifications } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen';
import { Badge } from '@capawesome/capacitor-badge';
import { auth, isFirebaseConfigured, googleProvider, functions } from './lib/firebase';
import { httpsCallable } from 'firebase/functions';
import {
  signInAnonymously,
  onAuthStateChanged,
  User,
  signOut,
  signInWithPopup,
  linkWithPopup,
  signInWithRedirect,
  linkWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential
} from 'firebase/auth';
import { shoppingService } from './services/shoppingService';
import { userService } from './services/userService';
import { storeService } from './services/storeService';
import { getOrderStatusColor } from './lib/orderUtils';
import { couponService } from './services/couponService';
import { useTranslation, Trans } from 'react-i18next';
import './i18n'; // Import i18n configuration
import { ShoppingList, ListItem, ShareLink, Permission, AppUser, FuelBatch, LoyaltyCard } from './types';
import { cn, forceClearCache } from './lib/utils';
import { EmojiPicker } from './components/EmojiPicker';
import { Onboarding } from './components/Onboarding';
import { CommunityTips } from './components/CommunityTips';
import { MerchantRegistrationModal } from './components/MerchantRegistrationModal';
import { MerchantDashboard } from './components/MerchantDashboard';
import { AdminStoreManager } from './components/AdminStoreManager';
import { AdminDatabaseManager } from './components/AdminDatabaseManager';
import { RefuelModal } from './components/RefuelModal';
import { FuelGauge } from './components/FuelGauge';
import { LoyaltyCardsModal } from './components/LoyaltyCardsModal';
import { LoyaltyCardsRow } from './components/LoyaltyCardsRow';
import { DiscoverStores } from './components/DiscoverStores';
import { StorePage } from './components/StorePage';
import { OtherAppsView } from './components/OtherAppsView';
import { UserOrdersView } from './components/UserOrdersView';
import { OrderDetailView } from './components/OrderDetailView';
import { DailyRewardModal } from './components/DailyRewardModal';
import { InstallAppBanner } from './components/InstallAppBanner';
import { FuelHistoryModal } from './components/FuelHistoryModal';
import { RedeemModal } from './components/RedeemModal';
import { Dashboard } from './components/Dashboard';
import { ListView } from './components/ListView';
import { ShareModal } from './components/ShareModal';
import { StoreProduct, Order } from './types';
import { orderService } from './services/orderService';
import { APP_CONFIG } from './config';

// --- Components ---

const COLORS = [
  'bg-rose-100 border-rose-200 text-rose-700',
  'bg-amber-100 border-amber-200 text-amber-700',
  'bg-emerald-100 border-emerald-200 text-emerald-700',
  'bg-sky-100 border-sky-200 text-sky-700',
  'bg-indigo-100 border-indigo-200 text-indigo-700',
  'bg-violet-100 border-violet-200 text-violet-700',
  'bg-fuchsia-100 border-fuchsia-200 text-fuchsia-700',
];

console.log("App.tsx: Module loading", { motion, AnimatePresence });

export default function App() {
  console.log("App: Component rendering");
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('ss_cached_user');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(!localStorage.getItem('ss_cached_user'));
  const [error, setError] = useState<string | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [sharedListId, setSharedListId] = useState<string | null>(null);
  const [sharedPermission, setSharedPermission] = useState<Permission>('read');
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [showRefuelModal, setShowRefuelModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showFuelHistoryModal, setShowFuelHistoryModal] = useState(false);
  const shareProcessed = useRef(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const prevActiveListId = useRef<string | null>(null);

  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showMerchantModal, setShowMerchantModal] = useState(false);
  const [showMerchantDashboard, setShowMerchantDashboard] = useState(false);
  const [showAdminManager, setShowAdminManager] = useState(false);
  const [showAdminDatabaseManager, setShowAdminDatabaseManager] = useState(false);
  const [showDiscoverStores, setShowDiscoverStores] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedLoyaltyCard, setSelectedLoyaltyCard] = useState<LoyaltyCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showOtherApps, setShowOtherApps] = useState(false);
  const [showUserOrdersView, setShowUserOrdersView] = useState(false);
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [salesOrders, setSalesOrders] = useState<Order[]>([]);
  const [merchantStoreIds, setMerchantStoreIds] = useState<string[]>([]);
  const [orderTab, setOrderTab] = useState<'purchases' | 'sales'>('purchases');
  const [selectedOrderDetailId, setSelectedOrderDetailId] = useState<string | null>(null);
  const [isOrderDetailMerchant, setIsOrderDetailMerchant] = useState(false);
  const [showDailyReward, setShowDailyReward] = useState(false);
  const [followedStoreIds, setFollowedStoreIds] = useState<string[]>([]);
  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- Daily Reward Check ---
  useEffect(() => {
    if (!appUser || !user || showDailyReward) return;

    const today = new Date().toISOString().split('T')[0];
    const lastClaimed = appUser.lastDailyRewardDay || appUser.ldrd || '';

    // If not claimed today
    if (lastClaimed !== today) {
      const timer = setTimeout(() => {
        setShowDailyReward(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [appUser?.lastDailyRewardDay, appUser?.ldrd, user?.uid]); 

  // --- Version Control & Auto-Update Logic ---
  useEffect(() => {
    const checkVersion = async () => {
      const lastVersion = localStorage.getItem('app_version');
      const currentVersion = APP_CONFIG.VERSION;

      // Also check native version on mobile for a double-layer of protection
      let nativeBuildId = '';
      if (Capacitor.isNativePlatform()) {
        try {
          const info = await CapApp.getInfo();
          nativeBuildId = `${info.version}(${info.build})`;
          const lastNativeBuildId = localStorage.getItem('app_native_build');

          if (lastNativeBuildId && lastNativeBuildId !== nativeBuildId) {
            console.log(`[VersionControl] Native update detected: ${lastNativeBuildId} -> ${nativeBuildId}`);
            localStorage.setItem('app_native_build', nativeBuildId);
            localStorage.setItem('app_version', currentVersion); // Sync JS version
            await forceClearCache({ clearStorage: false, reload: true });
            return; // Exit after reload
          }
          localStorage.setItem('app_native_build', nativeBuildId);
        } catch (e) {
          console.warn("Failed to get native app info", e);
        }
      }

      // Fallback/Web check using the manual config constant
      if (lastVersion && lastVersion !== currentVersion) {
        console.log(`[VersionControl] JS update detected: ${lastVersion} -> ${currentVersion}`);
        localStorage.setItem('app_version', currentVersion);
        await forceClearCache({ clearStorage: false, reload: true });
      } else if (!lastVersion) {
        localStorage.setItem('app_version', currentVersion);
      }
    };
    checkVersion();
  }, []);

  useEffect(() => {
    import('./services/iapService').then(({ iapService }) => {
      iapService.initialize();
    });
  }, []);

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('ss_onboarding_v2_seen');
  });
  const [initialOnboardingSlide, setInitialOnboardingSlide] = useState(0);

  useEffect(() => {
    if (appUser && (!appUser.preferences || appUser.preferences.length < 3)) {
      if (localStorage.getItem('ss_onboarding_v2_seen')) {
        // If they already saw onboarding but have no preferences, jump to selection
        setInitialOnboardingSlide(5); // The "Your Interests" slide index
      }
      setShowOnboarding(true);
    }
  }, [appUser]);

  const handleOnboardingFinish = () => {
    localStorage.setItem('ss_onboarding_v2_seen', 'true');
    setShowOnboarding(false);
  };

  useEffect(() => {
    // 1. Handle PWA Install Prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      console.log("PWA: install prompt captured");
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 2. Handle Hardware/Browser Back Button
    let backListener: any;
    if (Capacitor.isNativePlatform()) {
      backListener = CapApp.addListener('backButton', () => {
        if (activeListId) {
          setActiveListId(null);
          setSharedListId(null);
          window.history.replaceState({}, '', window.location.pathname);
        } else {
          setShowExitConfirm(true);
        }
      });
    } else {
      // For PWA/Web: manual state management to intercept back
      const handlePopState = (e: PopStateEvent) => {
        // If we are in a list, back should go to dashboard
        if (activeListId) {
          setActiveListId(null);
          setSharedListId(null);
          // Stay on the same URL but reset state
          window.history.pushState({ noBackExits: true }, '');
          return;
        }

        // If we are on dashboard and press back
        setShowExitConfirm(true);
        window.history.pushState({ noBackExits: true }, '');
      };

      // Push initial state if not present
      if (!window.history.state?.noBackExits) {
        window.history.pushState({ noBackExits: true }, '');
      }

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      if (backListener) backListener.remove();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [activeListId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      FirebaseCrashlytics.setEnabled({ enabled: true }).catch(console.error);
      SplashScreen.hide().catch(() => { });
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const setupNotifications = async () => {
      // 1. NATIVE PLATFORM FLOW (Android/iOS)
      if (Capacitor.isNativePlatform()) {
        try {
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }
          if (permStatus.receive !== 'granted') return;

          await PushNotifications.register();

          PushNotifications.addListener('registration', (token) => {
            console.log('Push registration success, token: ' + token.value);
            userService.updateFcmToken(user.uid, token.value, Capacitor.getPlatform() as 'android' | 'ios' | 'web');
          });

          PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            const data = action.notification.data;
            if (data?.listId) {
              setActiveListId(data.listId);
              setSharedListId(data.listId);
              setShowUserOrdersView(false);
            } else if (data?.orderId) {
              setShowUserOrdersView(true);
              // In a real app, you might want to auto-select or highlight the specific order
            }
          });
        } catch (e: any) {
          console.error("Error setting up Native notifications:", JSON.stringify(e));
        }
      }
      // 2. WEB / PWA PLATFORM FLOW (Browser)
      else if ('serviceWorker' in navigator && messaging) {
        try {
          // Note: VAPID key usually required for Web Push. Replace with your actual key from Firebase Console.
          const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

          if (!VAPID_KEY) {
            console.warn("VITE_FIREBASE_VAPID_KEY missing in .env. Web notifications won't work.");
            return;
          }

          const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: await navigator.serviceWorker.ready
          });

          if (token) {
            console.log('Web Push registration success, token:', token);
            userService.updateFcmToken(user.uid, token, 'web');
          }

          // Foreground message handler for Web
          onMessage(messaging, (payload) => {
            console.log('Web foreground message received:', payload);
            // Optionally show a toast or custom UI here
          });
        } catch (e) {
          console.error("Error setting up Web notifications:", e);
        }
      }
    };

    setupNotifications();

    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [user]);

  // Update App Icon Badge
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const unreadCount = lists.filter(l => l.updatedAt > shoppingService.getLastViewedAt(l.id)).length;

    const updateBadge = async () => {
      try {
        if (unreadCount > 0) {
          await Badge.set({ count: unreadCount });
        } else {
          await Badge.clear();
        }
      } catch (e) {
        console.error("Error updating badge:", e);
      }
    };

    updateBadge();
  }, [lists]);

  const handleSelectList = (listId: string) => {
    shoppingService.markListAsViewed(listId);
    setActiveListId(listId);
  };

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log(`PWA: user choice: ${outcome}`);
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.log("Auth State Changed:", u ? "User logged in: " + u.uid : "No user");
      if (u) {
        const minimalUser = {
          uid: u.uid,
          displayName: u.displayName,
          photoURL: u.photoURL,
          isAnonymous: u.isAnonymous
        };
        localStorage.setItem('ss_cached_user', JSON.stringify(minimalUser));
      } else {
        localStorage.removeItem('ss_cached_user');
      }
      setUser(u);
      setIsAuthInitialized(true);
      setLoading(false);
    }, (err) => {
      console.error("Auth state change error:", err);
      // Only show error if we don't have a cached session or it's a hard failure
      if (!localStorage.getItem('ss_cached_user')) {
        setError(t('app.network_error'));
      }
      setIsAuthInitialized(true);
      setLoading(false);
    });

    // Handle IdToken changes for the plugin's internal state
    let idTokenUnsubscribe: any;
    if (Capacitor.isNativePlatform()) {
      FirebaseAuthentication.addListener('idTokenChange', (result) => {
        try {
          if (result && result.token) {
            console.log("Auth: ID Token updated");
          }
        } catch (e) {
          // Ignore - usually happens on logout
        }
      }).then(listener => {
        idTokenUnsubscribe = listener;
      }).catch(() => {
        // Ignore listener attachment failures
      });
    }


    // For mobile: if we have a cached user but Firebase is taking its time,
    // we already showed the dashboard. If we DON'T have a user,
    // we wait a much shorter time before showing the welcome screen.
    // Safety timeout: if neither listener nor redirect has resolved in 6s, 
    // stop loading to show the current state (either cached user or welcome).
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      setIsAuthInitialized(true);
    }, 6000);

    return () => {
      unsubscribe();
      if (idTokenUnsubscribe) idTokenUnsubscribe.remove();
      clearTimeout(safetyTimeout);
    };
  }, []);

  useEffect(() => {
    if (user) {
      const unsubProfile = userService.subscribeToUserProfile(user.uid, setAppUser);
      const unsubFollowing = userService.subscribeToFollowing(user.uid, setFollowedStoreIds);

      return () => {
        unsubProfile();
        unsubFollowing();
      };
    } else {
      setAppUser(null);
      setFollowedStoreIds([]);
    }
  }, [user]);

  // Migration logic for followedStores (one-time)
  useEffect(() => {
    if (appUser && user && appUser.followedStores && appUser.followedStores.length > 0) {
      const migrate = async () => {
        console.log("[Migration] Moving legacy follows to subcollection...");
        for (const storeId of appUser.followedStores!) {
          await storeService.followStore(storeId, user.uid);
        }
        // CF or next update will clear the field
      };
      migrate();
    }
  }, [appUser?.uid, appUser?.followedStores?.length]);

  useEffect(() => {
    if (appUser?.isMerchant && user?.uid) {
      return storeService.subscribeToMyStores(user.uid, (stores) => {
        setMerchantStoreIds(stores.map(s => s.id));
      });
    } else {
      setMerchantStoreIds([]);
    }
  }, [appUser?.isMerchant, user?.uid]);

  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured) {
      setPurchases([]);
      setSalesOrders([]);
      return;
    }

    console.log("App: Subscribing to orders for user:", user.uid);

    // 1. Subscribe to orders as a customer
    const unsubCustomer = orderService.subscribeToUserOrders(user.uid, (orders) => {
      setPurchases(orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled'));
    });

    // 2. Subscribe to orders as a merchant (if applicable)
    let unsubMerchant = () => { };
    const storeIdsToWatch = merchantStoreIds.length > 0 ? merchantStoreIds : (appUser?.ownedStores || []);

    if (appUser?.isMerchant && storeIdsToWatch.length > 0) {
      unsubMerchant = orderService.subscribeToStoresOrders(storeIdsToWatch, (orders) => {
        setSalesOrders(orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled'));
      });
    }

    return () => {
      unsubCustomer();
      unsubMerchant();
    };
  }, [user?.uid, appUser?.isMerchant, appUser?.ownedStores, merchantStoreIds]);

  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured) return;
    console.log("App: Subscribing to lists for user:", user.uid);
    return shoppingService.subscribeToLists(user.uid, setLists);
  }, [user?.uid]);

  useEffect(() => {
    const handleIncomingShare = async (search: string) => {
      const params = new URLSearchParams(search);
      const shareId = params.get('share');
      if (shareId && user && isFirebaseConfigured) {
        if (user.isAnonymous) {
          setError(t('app.join_ref_real_account'));
          return;
        }
        try {
          const share = await shoppingService.getShare(shareId);
          if (share && share.isActive) {
            if (share.type === 'collection') {
              await shoppingService.joinCollection(share.listId, user.uid);
              setActiveListId(null);
            } else {
              await shoppingService.joinList(share.listId, user.uid);
              setSharedListId(share.listId);
              setSharedPermission(share.permission);
              setActiveListId(share.listId);
            }
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (err) {
          console.error("Error joining share:", err);
          setError(t('app.join_ref_fail'));
        }
      }
    };

    if (user && isFirebaseConfigured) {
      handleIncomingShare(window.location.search);

      let urlOpenListener: any;
      if (Capacitor.isNativePlatform()) {
        urlOpenListener = CapApp.addListener('appUrlOpen', (data: any) => {
          console.log('App opened with URL:', data.url);
          const url = new URL(data.url);
          handleIncomingShare(url.search);
        });
      }

      return () => {
        if (urlOpenListener) urlOpenListener.remove();
      };
    }
  }, [user]);

  // --- Automatic Interstitial Rewarded Ads (Premium) ---
  useEffect(() => {
    // Check if navigation occurred between Dashboard (null) and a List (id)
    const isNavigating = (prevActiveListId.current === null && activeListId !== null) || 
                        (prevActiveListId.current !== null && activeListId === null);
    
    if (isNavigating && Capacitor.isNativePlatform()) {
      const isExtraRewardsEnabled = localStorage.getItem('refuel_extra_rewards') === 'true';
      
      if (isExtraRewardsEnabled) {
        const now = Date.now();
        const lastAdTime = parseInt(localStorage.getItem('last_premium_ad_at') || '0');
        const cooldownMs = 5 * 60 * 1000; // 5 minutes

        if (now - lastAdTime >= cooldownMs) {
          console.log("[PremiumAd] Triggering automatic interstitial navigation ad");
          localStorage.setItem('last_premium_ad_at', now.toString());
          adService.showRewardedAd(true).catch(err => {
            console.error("[PremiumAd] Failed to show navigation ad:", err);
          });
        } else {
          const remainingSecs = Math.ceil((cooldownMs - (now - lastAdTime)) / 1000);
          console.log(`[PremiumAd] Cooldown active. Next ad available in ${remainingSecs}s`);
        }
      }
    }
    
    // Update ref for next navigation
    prevActiveListId.current = activeListId;
  }, [activeListId]);


  const handleGoogleLogin = async () => {
    try {
      console.log("Starting Google Login...");
      setLoading(true);

      if (Capacitor.isNativePlatform()) {
        console.log("Using Native Google Sign-In...");
        const result = await FirebaseAuthentication.signInWithGoogle();

        if (result.credential) {
          const credential = GoogleAuthProvider.credential(
            result.credential.idToken,
            result.credential.accessToken
          );

          console.log("Signing in with native credential...");
          await signInWithCredential(auth, credential);
        } else {
          // No credential means cancelled or failed without error
          setLoading(false);
        }
      } else {
        // Web flow
        console.log("Signing in with Google (Web)...");
        await signInWithPopup(auth, googleProvider);
      }
      // Note: We DO NOT set loading(false) here on success.
      // We let onAuthStateChanged handle it to avoid flickering the login screen
      // before the user state is fully updated.
    } catch (err: any) {
      console.error("Google login error:", err);
      setLoading(false);
      if (err.code === 'auth/credential-already-in-use') {
        await signOut(auth);
        setError(t('auth.already_in_use_message'));
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled' || err.code === '12501') {
        // Ignored (User cancelled)
      } else {
        setError(err.message || t('auth.login_failed'));
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || isDeleting) return;
    setIsDeleting(true);
    try {
      const result = await userService.deleteUserAccount(user);
      if (result.success) {
        setShowDeleteConfirm(false);
        setUser(null);
        localStorage.removeItem('ss_cached_user');
      } else {
        if (result.error === 'SEC_ERROR_RECENT_LOGIN') {
          setError(t('delete_account_modal.reauth_required'));
          setShowDeleteConfirm(false);
        } else {
          setError(result.error || t('delete_account_modal.delete_fail'));
        }
      }
    } catch (err: any) {
      console.error("Delete account error:", err);
      setError(err.message || t('delete_account_modal.delete_fail'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
          }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ListShare Logo" className="w-16 h-16 rounded-2xl shadow-lg" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-stone-400 font-medium"
        >
          {t('app.loading')}
        </motion.p>
      </div>
    );
  }

  // Only show the Welcome/Error screen if auth has finished initializing AND there's no user.
  // This prevents the Welcome screen from flickering before onAuthStateChanged fires.
  if (!isFirebaseConfigured || error || (isAuthInitialized && !user && !loading)) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-stone-900 selection:bg-emerald-100">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: 0 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-[3rem] shadow-2xl border border-stone-200 text-center space-y-8"
        >
          <div className={cn(
            "w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner overflow-hidden",
            error ? "bg-rose-50" : "bg-white"
          )}>
            {error ? <X className="w-12 h-12 text-rose-500" /> : <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-full h-full object-cover" />}
          </div>

          <div className="space-y-3">
            <h2 className="text-3xl font-black tracking-tight text-stone-900">
              {error ? t('app.config_error') : t('app.welcome')}
            </h2>
            <p className="text-stone-500 font-medium">
              {error || t('app.subtitle')}
            </p>
          </div>

          <div className="space-y-4 pt-4">
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-stone-100 rounded-2xl font-bold text-stone-700 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335" />
              </svg>
              {t('app.sign_in_google')}
            </motion.button>
            <button
              onClick={() => setError(null)}
              className="w-full py-4 text-stone-400 font-bold hover:text-stone-600 transition-colors text-sm"
            >
              {t('common.cancel')}
            </button>
          </div>

          {error && (
            <div className="text-left space-y-3 pt-6 border-t border-stone-100">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t('app.config_fix')}</h4>
              <ul className="text-xs text-stone-500 space-y-2 font-medium">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <span><Trans i18nKey="app.config_step1" components={{ 1: <b />, 2: <b /> }}>Enable <b>Google</b> & <b>Anonymous</b> in Firebase Auth Console</Trans></span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" />
                  <span><Trans i18nKey="app.config_step2" components={{ 1: <b /> }}>Ensure <b>Firestore</b> rules allow access</Trans></span>
                </li>
              </ul>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  const handleAddProductToList = async (product: StoreProduct, storeName?: string) => {
    let targetListId = activeListId;

    if (!targetListId) {
      if (lists.length > 0) {
        // Auto-select the first available list if none active
        targetListId = lists[0].id;
        setActiveListId(targetListId);
      } else {
        // Create a default list automatically if user has none
        if (!user) return;
        try {
          const newListId = await shoppingService.createList(user.uid, t('dashboard.new_list_short'), '#10b981'); // Emerald color
          if (newListId) {
            targetListId = newListId;
            setActiveListId(newListId);
          } else {
            alert(t('list_view.insufficient_fuel'));
            return;
          }
        } catch (error: any) {
          console.error("Auto-create list failed:", error);
          alert(error.message || t('dashboard.create_error'));
          return;
        }
      }
    }

    try {
      await shoppingService.syncListChanges(targetListId, user!.uid, [{
        name: product.name,
        emoji: '將',
        quantity: "1",
        unit: 'pcs',
        isBought: false,
        price: product.price,
        category: product.category || 'Store Item',
        storeId: product.storeId,
        storeName: storeName,
        productId: product.id,
        createdAt: Date.now()
      }], [], [], 1, 0);
    } catch (error) {
      console.error("Error adding store product to list:", error);
    }
  };

  return (
    <div className="h-full bg-stone-50 flex flex-col font-sans selection:bg-emerald-100 overflow-hidden relative">
      <AnimatePresence>
        {showOnboarding && user && (
          <Onboarding
            userId={user.uid}
            onFinish={handleOnboardingFinish}
            initialSlide={initialOnboardingSlide}
            currentPreferences={appUser?.preferences || []}
          />
        )}
      </AnimatePresence>
      <header className="flex-none bg-white/80 backdrop-blur-md border-b border-stone-200/60 px-4 py-3 md:px-8 safe-top z-40 relative">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => {
              setActiveListId(null);
              setSharedListId(null);
              window.history.replaceState({}, '', window.location.pathname);
            }}
          >
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/10 overflow-hidden shrink-0">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="L" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-stone-900 to-stone-600 hidden xs:block">
              ListShare
            </h1>
          </motion.div>

          <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0 justify-end">
            {user && (
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 px-0.5">
                <FuelGauge
                  level={appUser?.fl || 0}
                  onClick={() => setShowFuelHistoryModal(true)}
                  className="!h-10 !py-1 !px-3"
                  showLabel={false}
                />
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {appUser && !appUser.freeCouponClaimed && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowRedeemModal(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-indigo-600 text-white rounded-xl transition-all shadow-lg shadow-indigo-200 animate-pulse shrink-0"
                      title={t('redeem_modal.free_title')}
                    >
                      <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.button>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowRefuelModal(true)}
                    className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl transition-colors shadow-sm shrink-0"
                    title={t('fuel.tab_buy')}
                  >
                    <Fuel className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden md:inline">{t('fuel.tab_buy')}</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowRedeemModal(true)}
                    className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl transition-colors shadow-sm shrink-0"
                    title={t('fuel.redeem_coupon')}
                  >
                    <Ticket className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden md:inline">{t('fuel.tab_redeem')}</span>
                  </motion.button>
                </div>
              </div>
            )}
            <div className="relative shrink-0 ml-1" ref={menuRef}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-stone-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center cursor-pointer"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL.includes('googleusercontent.com') ? user.photoURL.split('=')[0] + APP_CONFIG.USER.DEFAULT_AVATAR_SIZE : user.photoURL}
                    alt="avatar"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || APP_CONFIG.USER.ANONYMOUS_AVATAR_SEED}`}
                    alt="avatar"
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                )}
              </motion.button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-50 overflow-hidden"
                  >
                    <div className="px-4 py-2 border-b border-stone-100 mb-1">
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                        {t('user_menu.profile')}
                      </p>
                      <p className="text-sm font-bold text-stone-900 truncate">
                        {user?.displayName || user?.email || t('user_menu.anonymous_traveler')}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        signOut(auth);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      {t('app.sign_out')}
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowMerchantDashboard(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors text-left font-bold"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {appUser?.isMerchant ? t('user_menu.manage_stores') : t('user_menu.register_store')}
                    </button>

                    {appUser?.isAdmin && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowAdminManager(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors text-left font-bold"
                      >
                        <Shield className="w-4 h-4" />
                        {t('user_menu.manage_submissions')}
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        const confirmed = window.confirm(t('common.clear_cache_confirm'));
                        if (confirmed) {
                          setShowUserMenu(false);
                          await forceClearCache();
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors text-left"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {t('user_menu.clear_cache')}
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowOtherApps(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors text-left"
                    >
                      <LayoutGrid className="w-4 h-4" />
                      {t('user_menu.other_apps')}
                    </button>

                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors text-left"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('user_menu.delete_account')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {user && !showDiscoverStores && (
        <LoyaltyCardsRow
          userId={user.uid}
          onCardClick={(card) => {
            setSelectedLoyaltyCard(card);
            setShowLoyaltyModal(true);
          }}
          onAddClick={() => {
            setSelectedLoyaltyCard(null);
            setShowLoyaltyModal(true);
          }}
        />
      )}

      <main className={cn(
        "flex-1 min-h-0",
        !showDiscoverStores && "scroll-container px-4 pt-4 pb-8 md:px-8"
      )}>
        <div className={cn(
          "h-full",
          !showDiscoverStores && "max-w-5xl mx-auto"
        )}>
          <AnimatePresence mode="wait">
            {showDiscoverStores ? (
              <DiscoverStores
                onClose={() => setShowDiscoverStores(false)}
                currentUser={user}
                appUser={appUser}
                followedStoreIds={followedStoreIds}
                onSelectStore={(id) => {
                  setSelectedStoreId(id);
                  setShowDiscoverStores(false);
                }}
                onShowMerchantDashboard={() => {
                  setShowDiscoverStores(false);
                  setShowMerchantDashboard(true);
                }}
              />
            ) : !activeListId ? (
              <Dashboard
                userId={user?.uid || ''}
                onSelectList={handleSelectList}
                user={user!}
                appUser={appUser}
                lists={lists}
                installPrompt={installPrompt}
                onInstall={handleInstallApp}
                onShowDiscoverStores={() => setShowDiscoverStores(true)}
                onShowOtherApps={() => setShowOtherApps(true)}
                purchases={purchases}
                salesOrders={salesOrders}
                orderTab={orderTab}
                setOrderTab={setOrderTab}
                onShowOrders={() => {
                  setOrderTab('purchases');
                  setShowUserOrdersView(true);
                }}
                onShowOrderDetail={(id, isMerchant) => {
                  setSelectedOrderDetailId(id);
                  setIsOrderDetailMerchant(isMerchant);
                }}
              />
            ) : (
              <ListView
                listId={activeListId}
                onBack={() => {
                  setActiveListId(null);
                  setSharedListId(null);
                  window.history.replaceState({}, '', window.location.pathname);
                }}
                isShared={!!sharedListId}
                permission={sharedListId ? sharedPermission : 'edit'}
                user={user}
                appUser={appUser}
              />
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="mt-auto py-6 text-center">
        <a
          href={`${import.meta.env.BASE_URL}privacy_policy.html`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-bold text-stone-400 hover:text-stone-600 transition-colors uppercase tracking-widest flex items-center justify-center gap-1.5"
        >
          <Shield className="w-3 h-3" />
          {t('footer.privacy_policy')}
        </a>
      </footer>

      <AnimatePresence>
        {showDailyReward && (
          <DailyRewardModal
            onClose={() => setShowDailyReward(false)}
            onClaimed={(amount) => {
              // Fuel level is updated via Firestore snapshot automatically
              console.log(`Daily reward of ${amount} claimed!`);
            }}
          />
        )}
        {showRedeemModal && user && (
          <RedeemModal
            userId={user.uid}
            appUser={appUser}
            onClose={() => setShowRedeemModal(false)}
          />
        )}
        {showLoyaltyModal && user && (
          <LoyaltyCardsModal
            userId={user.uid}
            initialCard={selectedLoyaltyCard}
            onClose={() => {
              setShowLoyaltyModal(false);
              setSelectedLoyaltyCard(null);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showFuelHistoryModal && appUser && (
          <FuelHistoryModal
            batches={appUser.fuelBatches || []}
            onClose={() => setShowFuelHistoryModal(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showRefuelModal && appUser && (
          <RefuelModal
            currentFuel={appUser.fl || 0}
            onClose={() => setShowRefuelModal(false)}
          />
        )}
        {showMerchantModal && user && (
          <MerchantRegistrationModal
            userId={user.uid}
            onClose={() => setShowMerchantModal(false)}
            onSuccess={() => {
              // We could show a notification here
            }}
          />
        )}
        {showMerchantDashboard && user && (
          <MerchantDashboard
            userId={user.uid}
            onClose={() => setShowMerchantDashboard(false)}
          />
        )}
        {showAdminManager && (
          <AdminStoreManager
            onClose={() => setShowAdminManager(false)}
            onShowAdminDatabaseManager={appUser?.isAdmin ? () => setShowAdminDatabaseManager(true) : undefined}
          />
        )}

        {(appUser?.isAdmin && showAdminDatabaseManager) && (
          <AdminDatabaseManager
            onClose={() => setShowAdminDatabaseManager(false)}
          />
        )}
        {showUserOrdersView && (
          <UserOrdersView
            onClose={() => setShowUserOrdersView(false)}
          />
        )}
        {selectedOrderDetailId && (
          <OrderDetailView
            orderId={selectedOrderDetailId}
            isMerchant={isOrderDetailMerchant}
            onClose={() => {
              setSelectedOrderDetailId(null);
              setIsOrderDetailMerchant(false);
            }}
          />
        )}
        {showOtherApps && (
          <OtherAppsView
            onClose={() => setShowOtherApps(false)}
          />
        )}
        {selectedStoreId && (
          <StorePage
            storeId={selectedStoreId}
            onClose={() => setSelectedStoreId(null)}
            onAddProductToList={handleAddProductToList}
            activeListId={activeListId || undefined}
            currentUser={user}
            appUser={appUser}
            followedStoreIds={followedStoreIds}
          />
        )}
      </AnimatePresence>
      {/* Exit Confirmation Modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-stone-900 mb-2">
                  {t('exit_app_title', 'Exit App?')}
                </h3>
                <p className="text-stone-500 text-sm leading-relaxed">
                  {t('exit_app_confirm', 'Are you sure you want to close the application?')}
                </p>
              </div>
              <div className="p-4 bg-stone-50 flex gap-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-4 text-stone-600 font-bold hover:bg-stone-100 rounded-2xl transition-colors"
                >
                  {t('common_cancel', 'Cancel')}
                </button>
                <button
                  onClick={() => {
                    if (Capacitor.isNativePlatform()) {
                      CapApp.exitApp();
                    } else {
                      window.close(); // Note: browsers often block window.close() unless opened by script
                      setShowExitConfirm(false);
                      // In PWA, we can't really "force exit", but we can clarify that they should just close the tab if they want
                    }
                  }}
                  className="flex-1 py-4 bg-red-500 text-white font-bold hover:bg-red-600 rounded-2xl shadow-lg shadow-red-200 transition-all"
                >
                  {t('common_exit', 'Exit')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl border border-stone-100"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Trash2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-stone-900 mb-3 tracking-tight">
                  {t('delete_account_modal.title')}
                </h3>
                <p className="text-stone-500 font-medium leading-relaxed">
                  {t('delete_account_modal.confirm')}
                </p>
              </div>
              <div className="p-6 bg-stone-50/50 flex flex-col gap-3 border-t border-stone-100">
                <button
                  disabled={isDeleting}
                  onClick={handleDeleteAccount}
                  className="w-full py-4 bg-rose-500 text-white font-black rounded-2xl shadow-lg shadow-rose-200 hover:bg-rose-600 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      {t('delete_account_modal.deleting')}
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      {t('delete_account_modal.button')}
                    </>
                  )}
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-4 text-stone-400 font-bold hover:text-stone-600 transition-colors uppercase tracking-widest text-xs"
                >
                  {t('dashboard.cancel')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

