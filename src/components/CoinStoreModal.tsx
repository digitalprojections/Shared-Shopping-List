import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Coins, 
  ShoppingBag, 
  ChevronRight, 
  ShieldCheck, 
  Zap,
  ShoppingBasket
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { iapService } from '../services/iapService';
import { PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { cn } from '../lib/utils';
import { Capacitor } from '@capacitor/core';

interface CoinStoreModalProps {
  onClose: () => void;
}

export const CoinStoreModal: React.FC<CoinStoreModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchPackages = async () => {
      setLoading(true);
      try {
        const packs = await iapService.getPackages();
        // Sort by price or coin amount if possible
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
    if (purchasingId) return;
    
    setPurchasingId(pack.product.identifier);
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
      setPurchasingId(null);
    }
  };

  const getPackageIcon = (identifier: string) => {
    if (identifier.includes('1000')) return <ShoppingBasket className="w-6 h-6" />;
    if (identifier.includes('500')) return <ShoppingBag className="w-6 h-6" />;
    return <Coins className="w-6 h-6" />;
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/40 backdrop-blur-md"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-stone-50 w-full max-w-lg rounded-t-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 sm:p-8 pb-4 flex items-center justify-between sticky top-0 bg-stone-50/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-stone-100 shrink-0">
              <ShoppingBag className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">{t('store.title')}</h2>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{t('store.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-transparent hover:border-stone-100"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-10 pt-4 custom-scrollbar">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-3 sm:p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-[10px] sm:text-sm font-bold flex items-center gap-3"
            >
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 p-6 sm:p-8 bg-emerald-500 rounded-[2rem] text-white text-center shadow-xl shadow-emerald-500/20"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-1">{t('store.success')}</h3>
              <p className="text-emerald-50 text-[10px] sm:text-sm opacity-80">Coins are now available in your balance.</p>
            </motion.div>
          )}

          {!Capacitor.isNativePlatform() ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-20 h-20 bg-stone-100 rounded-[2rem] flex items-center justify-center mx-auto">
                <Zap className="w-10 h-10 text-stone-300" />
              </div>
              <div className="max-w-[240px] mx-auto">
                <p className="text-stone-900 font-bold">{t('store.mobile_only')}</p>
                <p className="text-stone-400 text-sm mt-1">Please open the app on your Android or iOS device to purchase coins.</p>
              </div>
            </div>
          ) : loading ? (
            <div className="space-y-4 py-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-stone-100 rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : packages.length === 0 ? (
            <div className="py-12 text-center text-stone-400">
              <p className="font-bold">{t('store.no_packages')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em] ml-2 mb-4">
                {t('store.packages')}
              </h3>
              {packages.map((pack) => (
                <motion.button
                  key={pack.identifier}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handlePurchase(pack)}
                  disabled={!!purchasingId || success}
                  className={cn(
                    "w-full flex items-center justify-between p-4 sm:p-5 rounded-3xl border-2 transition-all relative group overflow-hidden",
                    purchasingId === pack.product.identifier 
                      ? "bg-stone-100 border-stone-200" 
                      : "bg-white border-stone-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-stone-200/50"
                  )}
                >
                  <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
                    <div className={cn(
                      "w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 transition-transform bg-gradient-to-br",
                      getPackageColor(pack.product.identifier)
                    )}>
                      {React.cloneElement(getPackageIcon(pack.product.identifier) as React.ReactElement, { 
                        className: "w-6 h-6 sm:w-8 sm:h-8 shrink-0 aspect-square" 
                      })}
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                        <span className="text-lg sm:text-2xl font-black text-stone-900 leading-tight">
                          {iapService.getCoinsForProduct(pack.product.identifier)} 🪙
                        </span>
                        {pack.product.identifier.includes('1000') && (
                          <span className="w-fit px-2 py-0.5 bg-violet-100 text-violet-600 text-[10px] font-black rounded-lg uppercase tracking-wider mt-1 sm:mt-0">Best Value</span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-sm font-bold text-stone-400 mt-0.5 line-clamp-1">{pack.product.description || pack.product.title}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <div className="text-right">
                      <span className="text-base sm:text-xl font-black text-emerald-600 tabular-nums">
                        {pack.product.priceString}
                      </span>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-stone-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                      {purchasingId === pack.product.identifier ? (
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        >
                          <Zap className="w-5 h-5" />
                        </motion.div>
                      ) : (
                        <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-8 pt-0 text-center">
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-stone-300 uppercase tracking-widest mt-4">
            <ShieldCheck className="w-3 h-3" />
            Secure Payment via Google Play / App Store
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
