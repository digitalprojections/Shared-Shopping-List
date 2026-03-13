import React, { useState, useEffect, useRef } from 'react';
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
  PlayCircle
} from 'lucide-react';
import { adService } from './services/adService';
import { motion, AnimatePresence } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, isFirebaseConfigured, googleProvider } from './lib/firebase';
import {
  signInAnonymously,
  onAuthStateChanged,
  User,
  signOut,
  signInWithPopup,
  linkWithPopup,
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
import { ShoppingList, ListItem, ShareLink, Permission, AppUser, CoinBatch } from './types';
import { cn } from './lib/utils';
import { EmojiPicker } from './components/EmojiPicker';

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
        console.log("App: Initializing with cached user");
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
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [showCoinHistoryModal, setShowCoinHistoryModal] = useState(false);
  const shareProcessed = useRef(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [installPrompt, setInstallPrompt] = useState<any>(null);

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
      setError("Firebase connection failed. Check your API keys.");
      setLoading(false);
    });

    getRedirectResult(auth).catch(async (error) => {
      if (error.code === 'auth/credential-already-in-use') {
        console.log("Account already exists. Logging out of anonymous session.");
        await signOut(auth);
        setError("That Google account already has a ShopShare profile. We've logged you out of your temporary guest session. Please click 'Sign in with Google' again to access your main account.");
      } else {
        console.error("Redirect error:", error);
        if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
          setError(error.message);
        }
      }
    });

    // For mobile: if we have a cached user but Firebase is taking its time,
    // we already showed the dashboard. If we DON'T have a user,
    // we wait a much shorter time before showing the welcome screen.
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Safety timeout: forcing loading to false");
        setLoading(false);
      }
    }, user ? 8000 : 2000); 

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  useEffect(() => {
    if (user) {
      userService.ensureUserProfile(user.uid);
      return userService.subscribeToUserProfile(user.uid, setAppUser);
    } else {
      setAppUser(null);
    }
  }, [user]);

  useEffect(() => {
    if (user && isFirebaseConfigured) {
      const params = new URLSearchParams(window.location.search);
      const shareId = params.get('share');
      if (shareId) {
        if (user.isAnonymous) {
          setError("You must sign in with a real account to join shared lists.");
          return;
        }
        shoppingService.getShare(shareId).then(async (share) => {
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
        }).catch(err => {
          console.error("Error joining share:", err);
          setError("Could not join shared list. Please check your configuration.");
        });
      }
    }
  }, [user]);

  const handleAnonymously = () => {
    setLoading(true);
    signInAnonymously(auth).catch(err => {
      console.error("Auth error:", err);
      if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
        setError("Firebase Auth is not enabled. Please enable 'Anonymous' sign-in in your Firebase Console.");
      } else {
        setError(err.message);
      }
      setLoading(false);
    });
  };

  const handleGoogleLogin = async () => {
    try {
      console.log("Starting Google Login...");
      setLoading(true);

      // Use native Capacitor authentication on mobile
      if (Capacitor.isNativePlatform()) {
        console.log("Detected native platform, using FirebaseAuthentication plugin");
        const result = await FirebaseAuthentication.signInWithGoogle();
        console.log("Native Google Sign-In Result:", result);

        if (result.credential?.idToken) {
          const credential = GoogleAuthProvider.credential(result.credential.idToken);
          if (user && user.isAnonymous) {
            console.log("Linking anonymous user with native Google credential");
            await linkWithCredential(user, credential);
          } else {
            console.log("Signing in with native Google credential");
            await signInWithCredential(auth, credential);
          }
        } else {
          console.warn("Native login succeeded but no ID token was returned.");
          setLoading(false);
        }
      } else {
        console.log("Detected web platform, using link/signInWithPopup");
        if (user && user.isAnonymous) {
          await linkWithPopup(user, googleProvider);
        } else {
          await signInWithPopup(auth, googleProvider);
        }
      }
    } catch (err: any) {
      console.error("Google login error:", err);
      if (err.code === 'auth/credential-already-in-use') {
        console.log("Account already exists. Logging out of anonymous session.");
        await signOut(auth);
        setError("That Google account already has a ShopShare profile. We've logged you out of your temporary guest session. Please click 'Sign in with Google' again to access your main account.");
      } else if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
        setError("Google Sign-In is not enabled. Please enable 'Google' provider in your Firebase Console.");
      } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        setError(err.message);
      }
      setLoading(false);
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
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ShopShare Logo" className="w-16 h-16 rounded-2xl shadow-lg" />
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

  return (
    <div className="h-full bg-stone-50 flex flex-col font-sans selection:bg-emerald-100">
      <header className="flex-none bg-white/70 backdrop-blur-xl border-b border-stone-200/60 px-4 py-3 md:px-8 safe-top">
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
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/10 overflow-hidden">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="L" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-stone-900 to-stone-600 hidden xs:block">
              ShopShare
            </h1>
          </motion.div>

          <div className="flex items-center gap-1 sm:gap-2">
            {appUser && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <CoinDisplay
                  balance={appUser.coinBalance}
                  onClick={() => setShowCoinHistoryModal(true)}
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowRedeemModal(true)}
                  className="flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl transition-colors shadow-sm"
                  title="Redeem Coupon"
                >
                  <Ticket className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden md:inline">Redeem</span>
                </motion.button>
              </div>
            )}
            {user && !user.isAnonymous && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => signOut(auth)}
                className="flex items-center gap-1.5 px-2 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </motion.button>
            )}
            {user && user.isAnonymous && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={handleGoogleLogin}
                className="hidden sm:flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors border border-emerald-100"
              >
                Link Account
              </motion.button>
            )}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-stone-100 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="scroll-container px-4 pt-2 pb-8 md:px-8">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {!activeListId ? (
              <Dashboard
                userId={user?.uid || ''}
                onSelectList={setActiveListId}
                user={user!}
                appUser={appUser}
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

      <AnimatePresence>
        {showRedeemModal && user && (
          <RedeemModal
            userId={user.uid}
            appUser={appUser}
            onClose={() => setShowRedeemModal(false)}
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
            <h3 className="font-bold text-lg">{t('pwa.install_title', 'Install ShopShare')}</h3>
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
  installPrompt,
  onInstall
}: { 
  userId: string, 
  onSelectList: (id: string) => void, 
  user: User, 
  appUser: AppUser | null,
  installPrompt: any,
  onInstall: () => void
}) {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [lists, setLists] = useState<ShoppingList[]>([]);

  useEffect(() => {
    adService.initialize().catch(console.error);
  }, []);

  useEffect(() => {
    if (!userId) return;
    console.log("Dashboard: Subscribing to lists for user:", userId);
    return shoppingService.subscribeToLists(userId, setLists);
  }, [userId]);

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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {lists.map((list, index) => (
              <motion.div
                key={list.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ y: -2 }}
                className="group relative"
              >
                <button
                  onClick={() => onSelectList(list.id)}
                  className={cn(
                    "w-full aspect-[16/10] p-4 rounded-3xl border-2 flex flex-col justify-between text-left transition-all duration-300 hover:shadow-xl hover:shadow-stone-200/50",
                    list.color || COLORS[0]
                  )}
                >
                  <div className="space-y-1.5">
                    <div
                      className="w-9 h-9 bg-white/40 rounded-xl flex items-center justify-center backdrop-blur-sm hover:bg-white/60 transition-colors cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingListId(list.id);
                      }}
                    >
                      {list.icon ? (
                        <span className="text-xl">{list.icon}</span>
                      ) : (
                        <ShoppingBag className="w-5 h-5 opacity-80" />
                      )}
                    </div>
                    <h3 className="font-bold text-lg leading-tight line-clamp-2">
                      {list.name}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                      {new Date(list.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <div className="p-1.5 bg-white/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronLeft className="w-4 h-4 rotate-180" />
                    </div>
                  </div>
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
                onClick={handleWatchAd}
                disabled={isAdLoading}
                className="w-full aspect-[16/10] p-4 rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 flex flex-col items-center justify-center text-center gap-2 transition-all hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-50"
              >
                {isAdLoading ? (
                  <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <div className="p-2 bg-emerald-100 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                      <PlayCircle className="w-7 h-7" />
                    </div>
                    <div>
                      <span className="block font-bold text-stone-900 leading-tight">
                        {t('dashboard.get_free_coins')}
                      </span>
                      <span className="text-xs text-stone-500">
                        {t('dashboard.watch_ad')}
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

        <div className="space-y-6">
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
          <ShareModal listId={userId} type="collection" onClose={() => setShowShare(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingListId && (
          <EmojiPicker
            currentEmoji={lists.find(l => l.id === editingListId)?.icon}
            onSelect={(emoji) => shoppingService.updateListIcon(editingListId, emoji)}
            onClose={() => setEditingListId(null)}
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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isThrottled, setIsThrottled] = useState(false);
  const [localDraftItems, setLocalDraftItems] = useState<ListItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!listId) return;
    return shoppingService.subscribeToList(listId, setList);
  }, [listId]);

  useEffect(() => {
    if (!listId) return;
    return shoppingService.subscribeToItems(listId, (remoteItems) => {
      // When remote items update, we reset the local draft IF there are no unsynced changes
      // Or we merge? For simplicity, we'll keep remote as the source of truth when not syncing.
      setItems(remoteItems);
      setLocalDraftItems(remoteItems);
    });
  }, [listId]);

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
    setSuggestions([]);
    inputRef.current?.focus();
  };

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

      await shoppingService.syncListChanges(listId, user.uid, itemsToAdd, itemsToUpdate, itemsToDelete);
      // Remote listener will update items and localDraftItems via useEffect
    } catch (error: any) {
      alert(error.message || t('list_view.sync_fail'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInputChange = async (val: string) => {
    setNewItemName(val);
    if (val.length >= 2) {
      const sugs = await shoppingService.getSuggestions(val);
      setSuggestions(sugs);
    } else {
      setSuggestions([]);
    }
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
              {isShared && (
                <span className="text-[10px] uppercase tracking-widest font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                  {permission}
                </span>
              )}
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
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {permission === 'edit' && (localDraftItems.length !== items.length || 
           JSON.stringify(localDraftItems) !== JSON.stringify(items)) ? (
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
                    {!isShared && (
                      <button
                        onClick={handleDeleteList}
                        className="w-full px-5 py-4 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
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
                className="w-full px-5 py-3 rounded-2xl border-2 border-stone-100 bg-white focus:outline-none focus:border-emerald-500 shadow-sm focus:shadow-emerald-500/10 transition-all text-base font-medium"
              />
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-100 rounded-2xl shadow-2xl z-50 overflow-hidden"
                  >
                    {suggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setNewItemName(sug);
                          setSuggestions([]);
                          inputRef.current?.focus();
                        }}
                        className="w-full px-5 py-3 text-left text-base font-medium hover:bg-emerald-50 hover:text-emerald-700 transition-colors border-b border-stone-50 last:border-0"
                      >
                        {sug}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
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
              shoppingService.updateListIcon(listId, emoji);
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
    const url = `${window.location.origin}${window.location.pathname}?share=${shareId}`;
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

  const cooldownMs = 10000;
  const lastAction = appUser?.lastActionAt || 0;
  const remaining = Math.max(0, Math.ceil((cooldownMs - (now - lastAction)) / 1000));
  const isThrottled = remaining > 0;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
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
            <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">{t('redeem_modal.code_label')}</label>
            <input
              autoFocus
              type="text"
              placeholder={t('redeem_modal.code_placeholder')}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-6 py-4 rounded-2xl border-2 border-stone-100 bg-stone-50 focus:outline-none focus:border-amber-400 focus:bg-white transition-all font-mono text-lg"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !code.trim() || isThrottled}
            className="w-full py-5 rounded-2xl bg-amber-600 text-white font-bold shadow-xl shadow-amber-600/20 hover:bg-amber-700 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
          >
            {loading ? t('redeem_modal.validating') : isThrottled ? t('redeem_modal.wait', { time: remaining }) : t('redeem_modal.claim')}
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

        <p className="text-center text-xs text-stone-400 font-medium">
          {t('redeem_modal.info')}
        </p>
      </motion.div>
    </motion.div>
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
