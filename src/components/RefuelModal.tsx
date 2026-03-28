import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Fuel, 
  ShoppingBag, 
  ChevronRight, 
  ShieldCheck, 
  Zap,
  PlayCircle,
  Clock,
  Gift,
  AlertTriangle
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { iapService } from '../services/iapService';
import { adService } from '../services/adService';
import { couponService } from '../services/couponService';
import { PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { cn } from '../lib/utils';
import { Capacitor } from '@capacitor/core';
import { FuelGauge } from './FuelGauge';

interface RefuelModalProps {
  onClose: () => void;
  currentFuel: number;
}

export const RefuelModal: React.FC<RefuelModalProps> = ({ onClose, currentFuel }) => {
  const { t } = useTranslation();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // 'ad', 'gift', or package identifier
  const [extraRewards, setExtraRewards] = useState(() => localStorage.getItem('refuel_extra_rewards') === 'true');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'buy' | 'free'>('buy');

  useEffect(() => {
    const fetchPackages = async () => {
      setLoading(true);
      try {
        const packs = await iapService.getPackages();
        setPackages(packs);
      } catch (err) {
        console.error('Store: Failed to fetch packages', err);
        setError(t('store.no_packages'));
      } finally {
        setLoading(false);
      }
    };

    if (Capacitor.isNativePlatform()) {
      fetchPackages();
    } else {
      setLoading(false);
    }
  }, [t]);

  const handlePurchase = async (pack: PurchasesPackage) => {
    if (actionLoading) return;
    
    setActionLoading(pack.product.identifier);
    setError(null);
    
    try {
      const result = await iapService.purchasePackage(pack);
      if (result.success) {
        setSuccess(true);
        setTimeout(onClose, 2500);
      } else if (result.error !== 'CANCELLED') {
        setError(result.error || t('store.failed'));
      }
    } catch (err) {
      setError(t('store.failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleWatchAd = async () => {
    if (actionLoading) return;
    setActionLoading('ad');
    setError(null);
    try {
      const result = await adService.showRewardedAd(extraRewards);
      if (result.success) {
        setSuccess(true);
        setTimeout(onClose, 2500);
      } else {
        setError(result.error || t('fuel.ad_failed'));
      }
    } catch (err) {
      setError(t('fuel.ad_failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleClaimGift = async () => {
    if (actionLoading) return;
    setActionLoading('gift');
    setError(null);
    try {
      const result = await couponService.claimFreeFuelGift();
      if (result.success) {
        setSuccess(true);
        setTimeout(onClose, 2500);
      } else {
        setError(result.message || t('fuel.gift_failed'));
      }
    } catch (err) {
      setError(t('fuel.gift_failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const getPackageIcon = (identifier: string) => {
    if (identifier.includes('1000')) return <Zap className="w-6 h-6" />;
    return <Fuel className="w-6 h-6" />;
  };

  const getPackageColor = (identifier: string) => {
    if (identifier.includes('1000')) return "from-violet-500 to-indigo-600 shadow-violet-200";
    if (identifier.includes('500')) return "from-emerald-500 to-teal-600 shadow-emerald-200";
    return "from-amber-400 to-orange-500 shadow-amber-100";
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-lg"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="bg-stone-50 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border-t sm:border border-stone-100"
      >
        {/* Header */}
        <div className="p-6 sm:p-8 pb-4 flex items-center justify-between sticky top-0 bg-stone-50/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-stone-100 shrink-0">
              <Fuel className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">{t('fuel.refuel_title')}</h2>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{t('fuel.refuel_subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-stone-100"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-10 pt-2 custom-scrollbar">
          {/* Current Fuel Status */}
          <div className="mb-8">
            <FuelGauge level={currentFuel} showLabel={true} className="w-full !p-5 !bg-white !rounded-3xl" />
          </div>

          {/* Tabs */}
          <div className="flex p-1.5 bg-stone-100 rounded-2xl mb-8">
            <button
              onClick={() => setActiveTab('buy')}
              className={cn(
                "flex-1 py-3 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2",
                activeTab === 'buy' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
              )}
            >
              <ShoppingBag className="w-4 h-4" />
              {t('fuel.tab_buy')}
            </button>
            <button
              onClick={() => setActiveTab('free')}
              className={cn(
                "flex-1 py-3 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2",
                activeTab === 'free' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
              )}
            >
              <Gift className="w-4 h-4" />
              {t('fuel.tab_free')}
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex items-center gap-3"
            >
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 p-8 bg-emerald-500 rounded-[2.5rem] text-white text-center shadow-xl shadow-emerald-500/20"
            >
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-1">{t('fuel.success')}</h3>
              <p className="text-emerald-50 text-sm opacity-80">{t('fuel.success_subtitle')}</p>
            </motion.div>
          )}

          {activeTab === 'buy' ? (
            <div className="space-y-4">
              {!Capacitor.isNativePlatform() ? (
                <div className="py-12 text-center space-y-4 bg-white rounded-3xl border border-stone-100 p-8">
                  <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto">
                    <Zap className="w-8 h-8 text-stone-300" />
                  </div>
                  <div className="max-w-[240px] mx-auto">
                    <p className="text-stone-900 font-bold">{t('store.mobile_only')}</p>
                    <p className="text-stone-400 text-sm mt-1">{t('store.mobile_only_subtitle')}</p>
                  </div>
                </div>
              ) : loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 bg-stone-100 rounded-3xl animate-pulse" />
                  ))}
                </div>
              ) : (
                packages.map((pack) => (
                  <motion.button
                    key={pack.identifier}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePurchase(pack)}
                    disabled={!!actionLoading || success}
                    className={cn(
                      "w-full flex items-center justify-between p-5 rounded-3xl border-2 transition-all relative group overflow-hidden",
                      actionLoading === pack.product.identifier 
                        ? "bg-stone-50 border-stone-100" 
                        : "bg-white border-stone-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-stone-200/50 shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-5 min-w-0 flex-1">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 transition-transform bg-gradient-to-br",
                        getPackageColor(pack.product.identifier)
                      )}>
                        {React.cloneElement(getPackageIcon(pack.product.identifier) as React.ReactElement, { 
                          className: "w-7 h-7 shrink-0" 
                        })}
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-stone-900 leading-tight tabular-nums">
                            {iapService.getFuelForProduct(pack.product.identifier)}
                          </span>
                          <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest bg-stone-100 px-1.5 py-0.5 rounded-md">UNITS</span>
                        </div>
                        <p className="text-xs font-bold text-stone-400 mt-0.5 line-clamp-1 truncate">{pack.product.description || pack.product.title}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className="text-lg font-black text-emerald-600 tabular-nums">
                        {pack.product.priceString}
                      </span>
                      <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-sm">
                        {actionLoading === pack.product.identifier ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                            <RefreshCw className="w-5 h-5" />
                          </motion.div>
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Watch Ad */}
              <div className="bg-amber-50/50 rounded-3xl p-6 border border-amber-100/50 mb-2">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-stone-900 leading-tight">{t('fuel.extra_rewards', 'Extra Rewards')}</h4>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{t('fuel.beta_feature', 'Beta Feature')}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const newValue = !extraRewards;
                      setExtraRewards(newValue);
                      localStorage.setItem('refuel_extra_rewards', String(newValue));
                    }}
                    className={`w-12 h-6 rounded-full transition-colors relative ${extraRewards ? 'bg-amber-500' : 'bg-stone-200'}`}
                  >
                    <motion.div 
                      animate={{ x: extraRewards ? 26 : 4 }}
                      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                    />
                  </button>
                </div>
                <p className="text-xs text-stone-600 leading-relaxed font-medium">
                  {t('fuel.extra_rewards_desc', 'Enable to receive double fuel units (+10 instead of +5) by watching a high-value Premium Ad.')}
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleWatchAd}
                disabled={!!actionLoading || success}
                className="w-full flex items-center justify-between p-6 rounded-3xl bg-white border-2 border-amber-100 hover:border-amber-200 hover:shadow-xl hover:shadow-amber-100/50 shadow-sm transition-all group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-100 shrink-0">
                    <PlayCircle className="w-8 h-8" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-lg font-black text-stone-900 leading-tight">
                      {extraRewards ? t('fuel.watch_premium_ad', 'Watch Premium Ad') : t('fuel.watch_ad')}
                    </h4>
                    <p className="text-xs font-bold text-stone-400 mt-0.5">{t('fuel.ad_reward_desc')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-xs font-black uppercase tracking-widest border border-amber-100">
                    +{extraRewards ? '10' : '5'} {t('fuel.units_short')}
                  </div>
                  <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white transition-colors shadow-sm">
                    {actionLoading === 'ad' ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <RefreshCw className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </div>
                </div>
              </motion.button>

              {/* Free Gift */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleClaimGift}
                disabled={!!actionLoading || success}
                className="w-full flex items-center justify-between p-6 rounded-3xl bg-white border-2 border-stone-100 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-100/50 shadow-sm transition-all group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-100 shrink-0">
                    <Gift className="w-8 h-8" />
                  </div>
                  <div className="text-left">
                    <h4 className="text-lg font-black text-stone-900 leading-tight">{t('fuel.claim_gift')}</h4>
                    <p className="text-xs font-bold text-stone-400 mt-0.5">{t('fuel.gift_desc')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="px-3 py-1.5 bg-violet-50 text-violet-600 rounded-xl text-xs font-black uppercase tracking-widest border border-violet-100">
                    +100 {t('fuel.units_short')}
                  </div>
                  <div className="w-10 h-10 bg-stone-50 rounded-xl flex items-center justify-center group-hover:bg-violet-500 group-hover:text-white transition-colors shadow-sm">
                    {actionLoading === 'gift' ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <RefreshCw className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </div>
                </div>
              </motion.button>
              
              <div className="p-6 bg-stone-100 rounded-3xl mt-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-stone-600 leading-relaxed">
                      {t('fuel.cooldown_notice')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-8 pb-8 pt-0 text-center">
          <div className="flex items-center justify-center gap-2 text-[10px] font-black text-stone-300 uppercase tracking-[0.2em] mt-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t('store.secure_payment')}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Add missing lucide-react import
const RefreshCw = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);
