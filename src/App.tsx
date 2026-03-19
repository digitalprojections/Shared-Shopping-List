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
  Coins,
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
  CreditCard
} from 'lucide-react';
import { adService } from './services/adService';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
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
import { couponService } from './services/couponService';
import { useTranslation, Trans } from 'react-i18next';
import './i18n'; // Import i18n configuration
import { ShoppingList, ListItem, ShareLink, Permission, AppUser, CoinBatch, LoyaltyCard } from './types';
import { cn, forceClearCache } from './lib/utils';
import { EmojiPicker } from './components/EmojiPicker';
import { Onboarding } from './components/Onboarding';
import { MerchantRegistrationModal } from './components/MerchantRegistrationModal';
import { MerchantDashboard } from './components/MerchantDashboard';
import { AdminStoreManager } from './components/AdminStoreManager';
import { CoinStoreModal } from './components/CoinStoreModal';
import { LoyaltyCardsModal } from './components/LoyaltyCardsModal';
import { LoyaltyCardsRow } from './components/LoyaltyCardsRow';
import { DiscoverStores } from './components/DiscoverStores';
import { StorePage } from './components/StorePage';
import { StoreProduct } from './types';
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
  const { t, i18n } = useTranslation();
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
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showCoinHistoryModal, setShowCoinHistoryModal] = useState(false);
  const shareProcessed = useRef(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showMerchantModal, setShowMerchantModal] = useState(false);
  const [showMerchantDashboard, setShowMerchantDashboard] = useState(false);
  const [showAdminManager, setShowAdminManager] = useState(false);
  const [showDiscoverStores, setShowDiscoverStores] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedLoyaltyCard, setSelectedLoyaltyCard] = useState<LoyaltyCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- Version Control & Auto-Update Logic ---
  useEffect(() => {
    const checkVersion = async () => {
      const lastVersion = localStorage.getItem('app_version');
      const currentVersion = APP_CONFIG.VERSION;

      if (lastVersion && lastVersion !== currentVersion) {
        console.log(`[VersionControl] Update detected: ${lastVersion} -> ${currentVersion}`);
        // Perform soft reset (clear caches/SW, reload, but keep localStorage data)
        await forceClearCache({ clearStorage: false, reload: true });
        localStorage.setItem('app_version', currentVersion);
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
    if (!user || !Capacitor.isNativePlatform()) return;

    const setupNotifications = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.log("Push notifications permission not granted");
          return;
        }

        await PushNotifications.register();

        PushNotifications.addListener('registration', (token) => {
          console.log('Push registration success, token: ' + token.value);
          userService.updateFcmToken(user.uid, token.value);
        });

        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Error on registration: ' + JSON.stringify(error));
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received: ' + JSON.stringify(notification));
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Push action performed: ' + JSON.stringify(action));
          const listId = action.notification.data?.listId;
          if (listId) {
            setActiveListId(listId);
            setSharedListId(listId);
          }
        });
      } catch (e) {
        console.error("Error setting up push notifications:", e);
      }
    };

    setupNotifications();

    return () => {
      PushNotifications.removeAllListeners();
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
      setLoading(false);
    }, (err) => {
      console.error("Auth state change error:", err);
      // Only show error if we don't have a cached session or it's a hard failure
      if (!localStorage.getItem('ss_cached_user')) {
        setError("Firebase connection failed. Check your network.");
      }
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
    }, 6000);

    return () => {
      unsubscribe();
      if (idTokenUnsubscribe) idTokenUnsubscribe.remove();
      clearTimeout(safetyTimeout);
    };
  }, []);

  useEffect(() => {
    if (user) {
      return userService.subscribeToUserProfile(user.uid, setAppUser);
    } else {
      setAppUser(null);
    }
  }, [user]);

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
          setError("You must sign in with a real account to join shared lists.");
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
          setError("Could not join shared list. Please check your configuration.");
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

  const handleAnonymously = async () => {
    try {
      console.log("Starting Anonymous Login...");
      setLoading(true);
      const timeout = setTimeout(() => {
        setLoading(false);
      }, 10000);

      await signInAnonymously(auth);
      clearTimeout(timeout);
      setLoading(false);
    } catch (err: any) {
      console.error("Anonymous login error:", err);
      if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
        setError("Firebase Auth is not enabled. Please enable 'Anonymous' sign-in in your Firebase Console.");
      } else {
        setError(err.message);
      }
      setLoading(false);
    }
  };

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

          if (user && user.isAnonymous) {
            console.log("Linking native credential to anonymous user...");
            await linkWithCredential(user, credential);
          } else {
            console.log("Signing in with native credential...");
            await signInWithCredential(auth, credential);
          }
        }
      } else {
        // Web flow
        if (user && user.isAnonymous) {
          console.log("Linking anonymous user with Google (Web)...");
          await linkWithPopup(user, googleProvider);
        } else {
          console.log("Signing in with Google (Web)...");
          await signInWithPopup(auth, googleProvider);
        }
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      if (err.code === 'auth/credential-already-in-use') {
        await signOut(auth);
        setError("That Google account already has a ListShare profile. We've logged you out of your temporary guest session. Please click 'Sign in with Google' again to access your main account.");
      } else if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled' || err.code === '12501') {
        // Ignored (User cancelled)
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
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
          setError(result.error || 'Failed to delete account');
        }
      }
    } catch (err: any) {
      console.error("Delete account error:", err);
      setError(err.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
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

  if (!isFirebaseConfigured || error || (!user && !loading)) {
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
              onClick={handleAnonymously}
              className="w-full py-4 text-stone-400 font-bold hover:text-stone-600 transition-colors text-sm"
            >
              {t('app.continue_guest')}
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

  const handleAddProductToList = async (product: StoreProduct) => {
    if (!activeListId) {
      alert("Please select a shopping list first!");
      return;
    }
    try {
      await shoppingService.syncListChanges(activeListId, user!.uid, [{
        name: product.name,
        emoji: '🛒',
        quantity: "1",
        unit: 'pcs',
        isBought: false,
        price: product.price,
        category: product.category || 'Store Item',
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
            {appUser && (
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 px-0.5">
                <CoinDisplay
                  balance={appUser.coinBalance}
                  onClick={() => setShowCoinHistoryModal(true)}
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
                    onClick={() => setShowStoreModal(true)}
                    className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl transition-colors shadow-sm shrink-0"
                    title="Buy Coins"
                  >
                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden md:inline">{t('store.title')}</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowRedeemModal(true)}
                    className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl transition-colors shadow-sm shrink-0"
                    title="Redeem Coupon"
                  >
                    <Ticket className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden md:inline">Redeem</span>
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
                        {user?.isAnonymous ? t('app.continue_guest') : t('user_menu.profile')}
                      </p>
                      <p className="text-sm font-bold text-stone-900 truncate">
                        {user?.displayName || user?.email || 'Anonymous Traveler'}
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

                    {!user?.isAnonymous && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowMerchantDashboard(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors text-left font-bold"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        {appUser?.isMerchant ? t('user_menu.manage_stores', 'Manage My Stores') : t('user_menu.register_store', 'Register as Store')}
                      </button>
                    )}

                    {appUser?.isAdmin && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowAdminManager(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors text-left font-bold"
                      >
                        <Shield className="w-4 h-4" />
                        {t('user_menu.manage_submissions', 'Manage Submissions')}
                      </button>
                    )}

                    <button
                      onClick={async () => {
                        const confirmed = window.confirm(t('user_menu.clear_cache_confirm', 'This will log you out and refresh the app to fix any issues. Continue?'));
                        if (confirmed) {
                          setShowUserMenu(false);
                          await forceClearCache();
                        }
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50 transition-colors text-left"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {t('user_menu.clear_cache', 'Fix App / Clear Cache')}
                    </button>

                    {!user?.isAnonymous && (
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
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {user && (
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

      <main className="scroll-container px-4 pt-6 pb-8 md:px-8">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {!activeListId ? (
              <Dashboard
                userId={user?.uid || ''}
                onSelectList={handleSelectList}
                user={user!}
                appUser={appUser}
                lists={lists}
                installPrompt={installPrompt}
                onInstall={handleInstallApp}
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
        {showCoinHistoryModal && appUser && (
          <CoinHistoryModal
            batches={appUser.coinBatches || []}
            onClose={() => setShowCoinHistoryModal(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showStoreModal && (
          <CoinStoreModal
            onClose={() => setShowStoreModal(false)}
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

function CoinDisplay({ balance, onClick }: { balance: number, onClick?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={onClick ? { scale: 1.05, backgroundColor: '#fffbeb' } : {}}
      whileTap={onClick ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-3 sm:py-1.5 border rounded-full shadow-sm transition-colors",
        onClick ? "cursor-pointer bg-white border-amber-200 hover:border-amber-400" : "bg-amber-50 border-amber-100"
      )}
    >
      <Coins className="w-4 h-4 text-amber-600" />
      <span className="text-sm font-bold text-amber-900">{balance}</span>
    </motion.div>
  );
}

function CoinHistoryModal({ batches, onClose }: { batches: CoinBatch[], onClose: () => void }) {
  const { t } = useTranslation();
  const now = Date.now();
  const sortedBatches = [...batches].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-lg space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
              <Coins className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900">{t('coins.history_title')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {sortedBatches.length > 0 ? (
            <div className="grid gap-3">
              {sortedBatches.map((batch) => {
                const isExpired = batch.expiresAt <= now;
                return (
                  <div
                    key={batch.id}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all flex items-center justify-between",
                      isExpired
                        ? "bg-stone-50 border-stone-100 opacity-60"
                        : "bg-white border-amber-100 shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        isExpired ? "bg-stone-200" : "bg-amber-100"
                      )}>
                        {isExpired ? <Clock className="w-5 h-5 text-stone-400" /> : <Coins className="w-5 h-5 text-amber-600" />}
                      </div>
                      <div>
                        <p className="font-bold text-stone-900">
                          {batch.remaining} / {batch.amount}
                          <span className="ml-2 py-0.5 px-2 bg-stone-100 rounded-md text-[9px] uppercase tracking-tighter text-stone-500">
                            {batch.type}
                          </span>
                        </p>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-0.5">
                          {isExpired ? t('coins.expired') : t('coins.expires')}: {new Date(batch.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {isExpired && (
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 px-2 py-1 rounded-lg">
                        {t('coins.expired')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
                <History className="w-8 h-8 text-stone-300" />
              </div>
              <p className="text-stone-500 font-medium">{t('coins.no_coins')}</p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-stone-400 font-medium pt-2">
          {t('coins.consumed_info')}
        </p>
      </motion.div>
    </motion.div>
  );
}

function InstallAppBanner({ onInstall, onClose }: { onInstall: () => void, onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-emerald-600 p-4 sm:p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-600/20 mb-8 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-colors" />
      <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div className="text-center sm:text-left">
            <h3 className="font-bold text-lg">{t('pwa.install_title', 'Install ListShare')}</h3>
            <p className="text-emerald-50 text-sm opacity-90">
              {t('pwa.install_desc', 'Get the full app experience on your home screen')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onInstall}
            className="flex-1 sm:flex-none px-6 py-3 bg-white text-emerald-600 font-bold rounded-xl shadow-lg hover:bg-emerald-50 transition-all active:scale-95"
          >
            {t('pwa.install_button', 'Install App')}
          </button>
          <button
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Dashboard({
  userId,
  onSelectList,
  user,
  appUser,
  lists,
  installPrompt,
  onInstall
}: {
  userId: string,
  onSelectList: (id: string) => void,
  user: User,
  appUser: AppUser | null,
  lists: ShoppingList[],
  installPrompt: any,
  onInstall: () => void
}) {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [showMerchantModal, setShowMerchantModal] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'yours' | 'shared'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    adService.initialize().catch(console.error);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || isPending) return;

    setIsPending(true);
    try {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const id = await shoppingService.createList(userId, newListName, color);
      setNewListName('');
      setIsCreating(false);
      if (id) onSelectList(id);
    } catch (error: any) {
      alert(error.message || t('dashboard.create_error', 'Failed to create list'));
    } finally {
      setIsPending(false);
    }
  };

  const handleWatchAd = async () => {
    if (isAdLoading) return;
    setIsAdLoading(true);

    // Alternative for Web
    if (!Capacitor.isNativePlatform()) {
      try {
        window.open('https://created.link', '_blank');
        const grantRewardedCoin = httpsCallable(functions, 'grantRewardedCoin');
        const result = await grantRewardedCoin({ amount: 1 });
        const data = result.data as { success: boolean; error?: string };
        if (data.success) {
          alert(t('dashboard.reward_success', 'Reward received! +1 Coin'));
        } else {
          alert(data.error || t('dashboard.reward_fail', 'Failed to get reward. Try again later.'));
        }
      } catch (error) {
        console.error("Error rewarding dev visit:", error);
      } finally {
        setIsAdLoading(false);
      }
      return;
    }

    try {
      const result = await adService.showRewardedAd();
      if (result.success) {
        alert(t('dashboard.reward_success', 'Reward received! +1 Coin'));
      } else {
        alert(result.error || t('dashboard.reward_fail', 'Failed to get reward. Try again later.'));
      }
    } catch (error) {
      console.error("Error showing rewarded ad:", error);
      alert(t('dashboard.ad_error', 'Failed to load or show ad. Please try again later.'));
    } finally {
      setIsAdLoading(false);
    }
  };

  const filteredLists = lists.filter(list => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'yours') return list.ownerId === userId;
    if (activeFilter === 'shared') return list.ownerId !== userId;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <AnimatePresence>
        {installPrompt && showInstallBanner && (
          <InstallAppBanner
            onInstall={onInstall}
            onClose={() => setShowInstallBanner(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">{t('dashboard.title')}</h2>
          <p className="text-stone-500 mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {!user.isAnonymous && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowShare(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-stone-200 text-stone-700 rounded-2xl font-semibold shadow-sm hover:shadow-md transition-all"
            >
              <Share2 className="w-5 h-5" />
              <span className="hidden sm:inline">{t('dashboard.share_collection')}</span>
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreating(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-semibold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">{t('dashboard.create_list')}</span>
            <span className="sm:hidden">{t('dashboard.new_list_short')}</span>
          </motion.button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 bg-stone-100/50 rounded-2xl w-fit">
          {(['all', 'yours', 'shared'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-bold transition-all",
                activeFilter === f
                  ? "bg-white shadow-sm text-emerald-600"
                  : "text-stone-500 hover:text-stone-700"
              )}
            >
              {t(`dashboard.filter_${f}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-100/50 rounded-2xl">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "p-2 rounded-xl transition-all",
              viewMode === 'grid' ? "bg-white shadow-sm text-stone-900" : "text-stone-400 hover:text-stone-600"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "p-2 rounded-xl transition-all",
              viewMode === 'list' ? "bg-white shadow-sm text-stone-900" : "text-stone-400 hover:text-stone-600"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className={cn(
            viewMode === 'grid'
              ? "grid grid-cols-2 md:grid-cols-3 gap-4"
              : "flex flex-col gap-3"
          )}>
            {filteredLists.map((list, index) => (
              <motion.div
                key={list.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ y: viewMode === 'grid' ? -2 : 0, x: viewMode === 'list' ? 4 : 0 }}
                className="group relative"
              >
                <button
                  onClick={() => onSelectList(list.id)}
                  className={cn(
                    "w-full rounded-2xl border-2 transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/50 flex",
                    viewMode === 'grid' ? "flex-col aspect-[16/10] p-4 justify-between text-left" : "items-center p-3 gap-4 text-left",
                    list.color || COLORS[0]
                  )}
                >
                  <div className={cn(
                    "bg-white/40 rounded-xl flex items-center justify-center backdrop-blur-sm hover:bg-white/60 transition-colors cursor-pointer shrink-0",
                    viewMode === 'grid' ? "w-9 h-9" : "w-11 h-11"
                  )}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingListId(list.id);
                    }}
                  >
                    {list.icon ? (
                      <span className={viewMode === 'grid' ? "text-xl" : "text-2xl"}>{list.icon}</span>
                    ) : (
                      <ShoppingBag className={cn(viewMode === 'grid' ? "w-5 h-5" : "w-6 h-6", "opacity-80")} />
                    )}
                  </div>

                  <div className={cn("flex-1 min-w-0", viewMode === 'grid' ? "space-y-1" : "flex items-center justify-between")}>
                    <div>
                      <h3 className={cn(
                        "font-bold leading-tight line-clamp-2",
                        viewMode === 'grid' ? "text-lg" : "text-base"
                      )}>
                        {list.name}
                      </h3>
                      {viewMode === 'list' && (
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-0.5">
                          {new Date(list.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>

                    {viewMode === 'grid' ? (
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                            {new Date(list.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                          {list.totalItems !== undefined && (
                            <span className="text-[10px] font-black tracking-tighter opacity-40 mt-0.5">
                              {list.boughtItems || 0}/{list.totalItems}
                            </span>
                          )}
                        </div>
                        <div className="p-1.5 bg-white/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronLeft className="w-4 h-4 rotate-180" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        {list.totalItems !== undefined && (
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-[10px] font-black tracking-widest opacity-40">
                              {list.boughtItems || 0}/{list.totalItems}
                            </span>
                            <div className="w-12 h-1 bg-stone-900/10 rounded-full mt-1 overflow-hidden">
                              <div
                                className="h-full bg-stone-900/30"
                                style={{ width: `${list.totalItems > 0 ? ((list.boughtItems || 0) / list.totalItems) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="p-2 bg-white/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronLeft className="w-4 h-4 rotate-180" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Update Badge */}
                  {list.updatedAt > shoppingService.getLastViewedAt(list.id) && list.lastUpdatedBy !== userId && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-rose-500 rounded-full border-2 border-white shadow-sm z-10" />
                  )}
                </button>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: lists.length * 0.03 }}
              whileHover={{ y: -2 }}
              className="group"
            >
              <button
                onClick={() => setShowDiscoverStores(true)}
                className="w-full aspect-[16/10] p-4 rounded-3xl border-2 border-indigo-100 bg-indigo-50/20 flex flex-col items-center justify-center text-center gap-2 transition-all hover:bg-indigo-50 hover:border-indigo-200"
              >
                <div className="p-2 bg-indigo-100 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <div>
                  <span className="block font-bold text-stone-900 leading-tight">Nearby Stores</span>
                  <span className="text-xs text-stone-500">Discover local products</span>
                </div>
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: lists.length * 0.03 }}
              whileHover={{ y: -2 }}
              className="group"
            >
              <button
                onClick={handleWatchAd}
                disabled={isAdLoading}
                className="w-full aspect-[16/10] p-4 rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 flex flex-col items-center justify-center text-center gap-2 transition-all hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-50"
              >
                {isAdLoading ? (
                  <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <div className="p-2 bg-emerald-100 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                      {Capacitor.isNativePlatform() ? (
                        <PlayCircle className="w-7 h-7" />
                      ) : (
                        <ExternalLink className="w-7 h-7" />
                      )}
                    </div>
                    <div>
                      <span className="block font-bold text-stone-900 leading-tight">
                        {Capacitor.isNativePlatform()
                          ? t('dashboard.get_free_coins')
                          : t('dashboard.support_dev')}
                      </span>
                      <span className="text-xs text-stone-500">
                        {Capacitor.isNativePlatform()
                          ? t('dashboard.watch_ad')
                          : t('dashboard.visit_apps')}
                      </span>
                    </div>
                  </>
                )}
              </button>
            </motion.div>

            {lists.length === 0 && !isCreating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full py-20 flex flex-col items-center justify-center border-4 border-dashed border-stone-200 rounded-[3rem] bg-stone-50/50"
              >
                <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                  <Plus className="w-10 h-10 text-stone-300" />
                </div>
                <p className="text-stone-400 font-medium text-lg">{t('dashboard.no_lists')}</p>
                <button
                  onClick={() => setIsCreating(true)}
                  className="mt-4 text-emerald-600 font-bold hover:underline"
                >
                  {t('dashboard.create_first')}
                </button>
              </motion.div>
            )}
          </div>
        </div>

        <div className="space-y-6 order-first lg:order-last">
          {appUser?.isAdmin && <CouponGenerator />}
        </div>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
          >
            <motion.form
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onSubmit={handleCreate}
              className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-stone-900">{t('dashboard.new_collection')}</h3>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">{t('dashboard.list_name')}</label>
                <input
                  autoFocus
                  type="text"
                  placeholder={t('dashboard.list_name_placeholder')}
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl border-2 border-stone-100 bg-stone-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-lg font-medium"
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-6 py-4 rounded-2xl text-stone-600 font-bold hover:bg-stone-100 transition-colors"
                >
                  {t('dashboard.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newListName.trim() || isPending}
                  className="flex-1 px-6 py-4 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('dashboard.creating', 'Creating...')}
                    </>
                  ) : (
                    t('dashboard.create')
                  )}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showShare && (
          <ShareModal listId={user?.uid || ''} type="collection" onClose={() => setShowShare(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedLoyaltyCard && (
          <LoyaltyCardsModal
            userId={user!.uid}
            initialId={selectedLoyaltyCard}
            onClose={() => setSelectedLoyaltyCard(null)}
          />
        )}
        {showDiscoverStores && (
          <DiscoverStores
            onClose={() => setShowDiscoverStores(false)}
            onSelectStore={(id) => {
              setSelectedStoreId(id);
              setShowDiscoverStores(false);
            }}
          />
        )}
        {selectedStoreId && (
          <StorePage
            storeId={selectedStoreId}
            onClose={() => setSelectedStoreId(null)}
            onAddProductToList={handleAddProductToList}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ListView({
  listId,
  onBack,
  isShared,
  permission,
  user,
  appUser
}: {
  listId: string,
  onBack: () => void,
  isShared: boolean,
  permission: Permission,
  user: User | null,
  appUser: AppUser | null
}) {
  const { t } = useTranslation();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isThrottled, setIsThrottled] = useState(false);
  const [localDraftItems, setLocalDraftItems] = useState<ListItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const hasUnsyncedChanges = useMemo(() => {
    if (localDraftItems.length !== items.length) return true;

    // Compare items by content, treating temp IDs as potentially matching new real IDs
    return localDraftItems.some((local, idx) => {
      const remote = items[idx];
      if (!remote) return true;

      // If names or quantities differ, it's definitely unsynced
      if (local.name !== remote.name || local.quantity !== remote.quantity || local.isBought !== remote.isBought) return true;

      // If both have real IDs and they differ, it's unsynced
      if (!local.id.startsWith('temp-') && !remote.id.startsWith('temp-') && local.id !== remote.id) return true;

      return false;
    });
  }, [localDraftItems, items]);

  useEffect(() => {
    if (!listId) return;
    return shoppingService.subscribeToList(listId, setList);
  }, [listId]);

  useEffect(() => {
    if (!listId) return;

    // Track if we've already done the initial load for this listId
    let initialLoadDone = false;

    return shoppingService.subscribeToItems(listId, (remoteItems) => {
      setItems(prevItems => {
        setLocalDraftItems(prevDraft => {
          if (!initialLoadDone) {
            const savedDraft = localStorage.getItem(`list_draft_${listId}`);
            initialLoadDone = true;
            if (savedDraft) {
              try {
                return JSON.parse(savedDraft);
              } catch (e) {
                return remoteItems;
              }
            }
            return remoteItems;
          }

          // Merge Logic: Preserve user's pending changes while adopting remote updates
          // 1. Identify which items the user has modified locally relative to prevItems
          const localModifications = prevDraft.filter(l => {
            if (l.id.startsWith('temp-')) return false; // Handled separately
            const remoteBefore = prevItems.find(r => r.id === l.id);
            return remoteBefore && (remoteBefore.name !== l.name || remoteBefore.quantity !== l.quantity || remoteBefore.isBought !== l.isBought);
          });

          const localDeletions = prevItems.filter(r => !prevDraft.find(l => l.id === r.id)).map(r => r.id);
          const localAdditions = prevDraft.filter(l => l.id.startsWith('temp-'));

          // 2. Build the new draft starting from the NEW remoteItems
          let nextDraft = remoteItems.map(remote => {
            // If the user was in the middle of editing THIS specific item, keep their version
            const dirtyLocal = localModifications.find(l => l.id === remote.id);
            if (dirtyLocal) return dirtyLocal;

            // Otherwise, adopt the remote version (gets updates from others)
            return remote;
          });

          // 3. Keep local deletions (if the item still exists remotely, removing it stays pending)
          nextDraft = nextDraft.filter(item => !localDeletions.includes(item.id));

          // 4. Re-add local additions, but FILTER OUT ones that just got synced
          // If a remote item matches a temp item's content exactly, we assume it's the same item.
          const unsyncedAdditions = localAdditions.filter(local => {
            const alreadySynced = remoteItems.find(remote =>
              remote.name === local.name &&
              remote.quantity === local.quantity &&
              !remote.id.startsWith('temp-')
            );
            return !alreadySynced;
          });

          return [...nextDraft, ...unsyncedAdditions];
        });

        return remoteItems;
      });
    });
  }, [listId]);

  // Persist draft to localStorage whenever localDraftItems changes
  useEffect(() => {
    if (!listId) return;

    // If draft is identical to remote, clear localStorage
    const isClean = localDraftItems.length === items.length &&
      JSON.stringify(localDraftItems) === JSON.stringify(items);

    if (isClean || localDraftItems.length === 0) {
      localStorage.removeItem(`list_draft_${listId}`);
    } else {
      localStorage.setItem(`list_draft_${listId}`, JSON.stringify(localDraftItems));
    }
  }, [localDraftItems, listId, items]);

  useEffect(() => {
    if (isThrottled) {
      const timer = setTimeout(() => setIsThrottled(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isThrottled]);

  const handleAddItem = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newItemName.trim() || permission === 'read' || !user) return;

    const newItem: ListItem = {
      id: `temp-${Date.now()}`,
      name: newItemName,
      quantity: newItemQty,
      isBought: false,
      createdAt: Date.now()
    };

    setLocalDraftItems(prev => [...prev, newItem]);
    setNewItemName('');
    setNewItemQty('');
    inputRef.current?.focus();
  };

  const hasChanges = localDraftItems.length !== items.length || JSON.stringify(localDraftItems) !== JSON.stringify(items);

  const handleSync = async () => {
    if (!user || !appUser || isSyncing) return;

    if (appUser.coinBalance <= 0) {
      alert(t('list_view.insufficient_coins'));
      return;
    }

    setIsSyncing(true);
    try {
      // Compare localDraftItems with items (remote) to find changes
      const itemsToAdd = localDraftItems.filter(item => item.id.startsWith('temp-')).map(({ id, ...rest }) => rest);

      const itemsToUpdate = localDraftItems.filter(local => {
        const remote = items.find(r => r.id === local.id);
        return remote && (remote.isBought !== local.isBought || remote.name !== local.name || remote.quantity !== local.quantity);
      });

      const itemsToDelete = items.filter(remote => !localDraftItems.find(local => local.id === remote.id)).map(i => i.id);

      if (itemsToAdd.length === 0 && itemsToUpdate.length === 0 && itemsToDelete.length === 0) {
        alert("No changes to sync");
        setIsSyncing(false);
        return;
      }

      const totalDiff = itemsToAdd.length - itemsToDelete.length;
      const boughtBefore = items.filter(i => i.isBought).length;
      const boughtAfter = localDraftItems.filter(i => i.isBought).length;
      const boughtDiff = boughtAfter - boughtBefore;

      await shoppingService.syncListChanges(listId, user.uid, itemsToAdd, itemsToUpdate, itemsToDelete, totalDiff, boughtDiff);

      // Clear local draft and update local state immediately so Sync button disappears
      localStorage.removeItem(`list_draft_${listId}`);
      // Optimistically update 'items' to match localDraftItems so the sync button hides immediately
      const syncedItems = [...localDraftItems];
      setItems(syncedItems);
      setLocalDraftItems(syncedItems);

      // Show success feedback
      alert(t('list_view.sync_success', 'Sync successful! Changes are saved.'));

      // Remote listener will update items and localDraftItems via useEffect
    } catch (error: any) {
      alert(error.message || t('list_view.sync_fail'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInputChange = (val: string) => {
    setNewItemName(val);
  };

  const handleDeleteList = async () => {
    if (window.confirm(t('list_view.delete_confirm'))) {
      await shoppingService.deleteList(listId);
      onBack();
    }
  };

  if (!list) return null;

  const boughtCount = items.filter(i => i.isBought).length;
  const progress = items.length > 0 ? (boughtCount / items.length) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.1, x: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="p-2.5 bg-white hover:bg-stone-100 rounded-xl shadow-sm border border-stone-200 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 bg-white/40 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-sm hover:bg-white/60 transition-colors cursor-pointer flex-shrink-0"
                onClick={() => setShowEmojiPicker(true)}
              >
                {list.icon ? (
                  <span className="text-2xl sm:text-3xl">{list.icon}</span>
                ) : (
                  <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 opacity-80" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-stone-900 truncate">{list.name}</h2>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex-1 h-2 w-32 bg-stone-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                {t('list_view.items_count', { bought: boughtCount, total: items.length })}
              </span>
            </div>
            {isShared && (
              <span className="text-[10px] uppercase tracking-widest font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 self-start sm:self-center mt-2 block w-fit">
                {permission}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {permission === 'edit' && hasUnsyncedChanges ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              <RefreshCw className={cn("w-5 h-5", isSyncing && "animate-spin")} />
              {isSyncing ? t('list_view.syncing') : t('list_view.sync_changes')} (1 🪙)
            </motion.button>
          ) : null}
          {!isShared && !user?.isAnonymous && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowShare(true)}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-stone-200 rounded-2xl font-bold text-stone-700 shadow-sm hover:shadow-md transition-all"
            >
              <Share2 className="w-5 h-5" />
              {t('list_view.share')}
            </motion.button>
          )}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowOptions(!showOptions)}
              className="p-3 bg-white border border-stone-200 rounded-2xl shadow-sm hover:shadow-md transition-all"
            >
              <MoreVertical className="w-6 h-6 text-stone-500" />
            </motion.button>
            <AnimatePresence>
              {showOptions && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-3 w-56 bg-white rounded-[1.5rem] shadow-2xl border border-stone-100 z-50 overflow-hidden"
                  >
                    {hasChanges && (
                      <button
                        onClick={() => {
                          if (window.confirm(t('list_view.discard_confirm', 'Discard all unsynced changes?'))) {
                            setLocalDraftItems(items);
                            localStorage.removeItem(`list_draft_${listId}`);
                            setShowOptions(false);
                          }
                        }}
                        className="w-full px-5 py-4 text-left text-sm font-bold text-amber-600 hover:bg-amber-50 flex items-center gap-3 transition-colors border-b border-stone-50"
                      >
                        <RotateCcw className="w-5 h-5" />
                        {t('list_view.discard_changes', 'Discard Changes')}
                      </button>
                    )}
                    {!isShared && (
                      <button
                        onClick={handleDeleteList}
                        className="w-full px-5 py-4 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors border-b border-stone-50"
                      >
                        <Trash2 className="w-5 h-5" />
                        {t('list_view.delete_collection')}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setShowOptions(false);
                      }}
                      className="w-full px-5 py-4 text-left text-sm font-bold text-stone-600 hover:bg-stone-50 flex items-center gap-3 transition-colors"
                    >
                      <Copy className="w-5 h-5" />
                      {t('list_view.copy_link')}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {permission === 'edit' && (
        <motion.div
          layout
          className="relative group"
        >
          <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                placeholder={t('list_view.add_item_placeholder')}
                value={newItemName}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-full px-5 py-3 rounded-2xl border-2 border-stone-100 bg-white focus:outline-none focus:border-emerald-500 shadow-sm transition-all text-base font-medium"
              />
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={t('list_view.qty_placeholder')}
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                className="w-full sm:w-24 px-5 py-3 rounded-2xl border-2 border-stone-100 bg-white focus:outline-none focus:border-emerald-500 shadow-sm transition-all text-base font-medium"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!newItemName.trim() || isThrottled}
                className="p-3 rounded-2xl bg-emerald-600 text-white disabled:opacity-50 shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center min-w-[3rem]"
              >
                {isThrottled ? <Clock className="w-5 h-5 animate-pulse" /> : <Plus className="w-6 h-6" />}
              </motion.button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence initial={false}>
          {localDraftItems.map((item) => (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={cn(
                "group flex items-center justify-between p-3 rounded-xl border transition-all duration-300",
                item.isBought
                  ? "bg-stone-50 border-transparent opacity-60"
                  : "bg-white border-stone-100 shadow-sm hover:shadow-md hover:border-emerald-100",
                item.id.startsWith('temp-') && "border-emerald-200 border-dashed"
              )}
            >
              <div className="flex items-center gap-4 flex-1">
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  disabled={permission === 'read'}
                  onClick={() => {
                    setLocalDraftItems(prev => prev.map(i =>
                      i.id === item.id ? { ...i, isBought: !i.isBought } : i
                    ));
                  }}
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center transition-all border-2 flex-shrink-0",
                    item.isBought
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "bg-white border-stone-200 text-transparent hover:border-emerald-400"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </motion.button>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-lg font-semibold transition-all",
                    item.isBought && "line-through text-stone-400"
                  )}>
                    {item.name}
                    {item.id.startsWith('temp-') && <span className="ml-2 text-[10px] text-emerald-500 font-black italic">{t('list_view.new_tag')}</span>}
                  </span>
                  {item.quantity && (
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{item.quantity}</span>
                  )}
                </div>
              </div>
              {permission === 'edit' && (
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setLocalDraftItems(prev => prev.filter(i => i.id !== item.id));
                  }}
                  className="p-2 text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-24 h-24 bg-stone-100 rounded-[2.5rem] flex items-center justify-center">
              <ShoppingBag className="w-10 h-10 text-stone-300" />
            </div>
            <div className="space-y-1">
              <p className="text-stone-900 font-bold text-xl">{t('list_view.empty_list')}</p>
              <p className="text-stone-400">{t('list_view.empty_suggest')}</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showEmojiPicker && (
          <EmojiPicker
            currentEmoji={list.icon}
            onSelect={(emoji) => {
              shoppingService.updateListIcon(listId, emoji, user?.uid || '');
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShare && (
          <ShareModal
            listId={listId}
            onClose={() => setShowShare(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ShareModal({ listId, onClose, type = 'list' }: { listId: string, onClose: () => void, type?: 'list' | 'collection' }) {
  const { t } = useTranslation();
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [permission, setPermission] = useState<Permission>('read');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    return shoppingService.subscribeToShares(listId, setShares);
  }, [listId]);

  const handleCreateShare = async () => {
    await shoppingService.createShareLink(listId, permission, type);
  };

  const copyShareLink = (shareId: string) => {
    const platform = Capacitor.getPlatform();

    // In native apps, we use the hardcoded production URL.
    // On web (PWA or development), we use the current browser URL.
    const baseUrl = (platform === 'android' || platform === 'ios')
      ? APP_CONFIG.PROD_URL
      : `${window.location.origin}${window.location.pathname}`;

    const url = `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}?share=${shareId}`;
    console.log('Share Link: Generated URL for platform', platform, url);

    navigator.clipboard.writeText(url);
    setCopiedId(shareId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white p-8 rounded-[3rem] shadow-2xl w-full max-w-lg space-y-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-stone-900">{t('share_modal.title')}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 p-2 bg-stone-100 rounded-[1.5rem]">
            <button
              onClick={() => setPermission('read')}
              className={cn(
                "flex-1 py-3 rounded-2xl text-sm font-bold transition-all",
                permission === 'read' ? "bg-white shadow-md text-emerald-600" : "text-stone-500 hover:text-stone-700"
              )}
            >
              {t('share_modal.read_only')}
            </button>
            <button
              onClick={() => setPermission('edit')}
              className={cn(
                "flex-1 py-3 rounded-2xl text-sm font-bold transition-all",
                permission === 'edit' ? "bg-white shadow-md text-emerald-600" : "text-stone-500 hover:text-stone-700"
              )}
            >
              {t('share_modal.can_edit')}
            </button>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreateShare}
            className="w-full py-5 rounded-[1.5rem] bg-emerald-600 text-white font-bold shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
          >
            <LinkIcon className="w-5 h-5" />
            {t('share_modal.generate_link')}
          </motion.button>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 ml-1">{t('share_modal.active_links')}</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {shares.map((share) => (
              <motion.div
                layout
                key={share.id}
                className="flex items-center justify-between p-5 rounded-[1.5rem] border-2 border-stone-50 bg-stone-50/50"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-widest text-stone-900">{t('share_modal.access_type', { permission: share.permission })}</span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest mt-1",
                    share.isActive ? "text-emerald-500" : "text-stone-400"
                  )}>
                    {share.isActive ? t('share_modal.active') : t('share_modal.deactivated')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyShareLink(share.id)}
                    className="p-3 bg-white hover:bg-stone-100 rounded-xl shadow-sm border border-stone-200 transition-all text-stone-600"
                    title="Copy Link"
                  >
                    {copiedId === share.id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => shoppingService.toggleShareActive(share.id, !share.isActive)}
                    className={cn(
                      "p-3 rounded-xl shadow-sm border transition-all",
                      share.isActive
                        ? "bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100"
                        : "bg-white border-stone-200 text-stone-400 hover:bg-stone-100"
                    )}
                    title={share.isActive ? "Deactivate" : "Activate"}
                  >
                    <CheckCircle2 className={cn("w-4 h-4", !share.isActive && "opacity-20")} />
                  </button>
                  <button
                    onClick={() => shoppingService.deleteShare(share.id)}
                    className="p-3 bg-white hover:bg-rose-50 rounded-xl shadow-sm border border-stone-200 transition-all text-rose-500"
                    title="Delete Link"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
            {shares.length === 0 && (
              <div className="text-center py-8 bg-stone-50 rounded-[1.5rem] border-2 border-dashed border-stone-200">
                <p className="text-sm font-bold text-stone-400">{t('share_modal.no_links')}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RedeemModal({ userId, onClose, appUser }: { userId: string, onClose: () => void, appUser: AppUser | null }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cooldownMs = APP_CONFIG.RATE_LIMITS.COUPON_REDEEM_COOLDOWN;
  const lastAction = appUser?.lastActionAt || 0;
  const remaining = Math.max(0, Math.ceil((cooldownMs - (now - lastAction)) / 1000));
  const isThrottled = remaining > 0;

  const handleCodeChange = (val: string) => {
    // Remove invalid characters and normalize to uppercase
    let cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Limit to 12 alphanumeric characters (SHOP + 8 random)
    cleaned = cleaned.slice(0, 12);

    // Auto-insert hyphens: XXXX-XXXX-XXXX
    let formatted = '';
    if (cleaned.length > 0) formatted += cleaned.slice(0, 4);
    if (cleaned.length > 4) formatted += '-' + cleaned.slice(4, 8);
    if (cleaned.length > 8) formatted += '-' + cleaned.slice(8, 12);

    setCode(formatted);
    setMsg(null);
  };

  const isValidPattern = /^SHOP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !isValidPattern) return;
    setLoading(true);
    setMsg(null);
    const res = await couponService.redeemCoupon(userId, code);
    setLoading(false);
    if (res.success) {
      setMsg({ text: res.message, type: 'success' });
      setCode('');
      setTimeout(onClose, 2000);
    } else {
      setMsg({ text: res.message, type: 'error' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
              <Ticket className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900">{t('redeem_modal.title')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <form onSubmit={handleRedeem} className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400">{t('redeem_modal.code_label')}</label>
              {code.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCode('')}
                  className="text-[10px] font-black uppercase tracking-tighter text-stone-300 hover:text-stone-500 transition-colors"
                >
                  {t('common.clear', 'Clear')}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                autoFocus
                type="text"
                placeholder={t('redeem_modal.code_placeholder')}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                className={cn(
                  "w-full px-6 py-5 rounded-2xl border-2 transition-all font-mono text-xl tracking-wider uppercase",
                  isValidPattern
                    ? "border-emerald-200 bg-emerald-50/30 focus:border-emerald-400 focus:bg-white text-emerald-700"
                    : "border-stone-100 bg-stone-50 focus:border-amber-400 focus:bg-white text-stone-900"
                )}
              />
              <AnimatePresence>
                {isValidPattern && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.5, x: 10 }}
                    className="absolute right-5 top-1/2 -translate-y-1/2"
                  >
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !isValidPattern || isThrottled}
            className={cn(
              "w-full py-5 rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-3",
              isValidPattern
                ? "bg-amber-600 text-white shadow-amber-600/20 hover:bg-amber-700 active:scale-[0.98]"
                : "bg-stone-100 text-stone-400 shadow-none cursor-not-allowed"
            )}
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : isThrottled ? (
              <>
                <Clock className="w-5 h-5" />
                {t('redeem_modal.wait', { time: remaining })}
              </>
            ) : (
              t('redeem_modal.claim')
            )}
          </button>
        </form>

        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={cn(
                "p-4 rounded-xl text-sm font-bold text-center",
                msg.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
              )}
            >
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-stone-400 font-medium pb-2">
          {t('redeem_modal.info')}
        </p>

        {appUser && !appUser.freeCouponClaimed && (
          <div className="pt-4 border-t border-stone-100">
            <FreeGiftCard appUser={appUser} />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function FreeGiftCard({ appUser }: { appUser: AppUser | null }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(appUser?.freeCouponClaimed || false);

  useEffect(() => {
    if (appUser?.freeCouponClaimed) {
      setClaimed(true);
    }
  }, [appUser?.freeCouponClaimed]);

  const handleClaim = async () => {
    if (loading || claimed) return;
    setLoading(true);
    try {
      const result = await couponService.claimFreeWebCoupon();
      if (result.success) {
        setClaimed(true);
      } else {
        alert(result.message);
      }
    } catch (error: any) {
      alert(error.message || 'Error claiming gift');
    } finally {
      setLoading(false);
    }
  };

  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200/50 space-y-4 relative overflow-hidden group">
      <div className="absolute top-0 right-0 -m-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
      <div className="relative flex items-center gap-4">
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
          <Gift className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-lg leading-tight">{t('redeem_modal.free_title')}</h3>
          <p className="text-white/60 text-xs font-medium">{t('redeem_modal.free_desc')}</p>
        </div>
      </div>

      {isNative ? (
        <div className="bg-white/10 p-4 rounded-2xl border border-white/10 text-center">
          <p className="text-sm font-bold text-white/90">
            {t('redeem_modal.mobile_invite')}
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.open('https://created.link', '_blank')}
            className="mt-3 px-4 py-2 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-900/40"
          >
            created.link
          </motion.button>
        </div>
      ) : (
        <button
          onClick={handleClaim}
          disabled={loading || claimed}
          className={cn(
            "w-full py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95",
            claimed
              ? "bg-emerald-500/20 text-emerald-300 cursor-default border border-emerald-500/30"
              : "bg-white text-indigo-600 hover:bg-stone-50 shadow-indigo-900/20"
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>{t('redeem_modal.validating')}</span>
            </div>
          ) : (
            claimed ? t('redeem_modal.free_claimed') : t('redeem_modal.free_claim')
          )}
        </button>
      )}
    </div>
  );
}

function CouponGenerator() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    const code = await couponService.generateCoupon(parseInt(amount));
    setLoading(false);
    setGeneratedCode(code);
  };

  return (
    <div className="bg-stone-900 p-5 rounded-3xl text-white shadow-xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
          <Crown className="w-5 h-5 text-amber-400" />
        </div>
        <h3 className="font-bold">{t('admin.title')}</h3>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {['50', '100', '500', '1000'].map(val => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className={cn(
                "py-2 rounded-lg text-xs font-bold transition-all",
                amount === val ? "bg-amber-500 text-stone-900" : "bg-white/5 hover:bg-white/10"
              )}
            >
              {val} {t('admin.coins')}
            </button>
          ))}
        </div>
        {!generatedCode ? (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-white text-stone-900 font-bold text-sm hover:bg-stone-100 disabled:opacity-50 transition-all"
          >
            {loading ? t('admin.generating') : t('admin.generate_coupon')}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
              <code className="text-amber-400 font-mono text-xs">{generatedCode}</code>
              <button
                onClick={() => navigator.clipboard.writeText(generatedCode)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setGeneratedCode(null)}
              className="w-full py-2 text-xs font-bold text-stone-400 hover:text-white transition-colors"
            >
              {t('admin.generate_another')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
