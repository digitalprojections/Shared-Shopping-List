import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  MapPin, 
  ShoppingBag, 
  Star, 
  Search, 
  Filter, 
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Map as MapIcon,
  Store as StoreIcon,
  Clock,
  ArrowRight,
  Heart,
  Settings
} from 'lucide-react';
import { Store, AppUser } from '../types';
import { storeService } from '../services/storeService';
import { userService } from '../services/userService';
import { auth } from '../lib/firebase';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { STORE_CATEGORIES } from '../constants/categories';

interface DiscoverStoresProps {
  onClose: () => void;
  onSelectStore: (storeId: string) => void;
  onShowMerchantDashboard: () => void;
  currentUser: any; // User | null
  appUser: AppUser | null;
}

export const DiscoverStores: React.FC<DiscoverStoresProps> = ({ 
  onClose, 
  onSelectStore, 
  onShowMerchantDashboard,
  currentUser, 
  appUser 
}) => {
  const { t } = useTranslation();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const categoryOptions = [
    { key: 'all', label: t('merchant.categories.all'), value: 'All' },
    ...STORE_CATEGORIES.map(cat => ({
      key: cat.key,
      label: t(`merchant.categories.${cat.key}`),
      value: cat.value
    }))
  ];

  useEffect(() => {
    const unsubscribe = storeService.subscribeToAllStores((data) => {
      // Filter for active stores
      setStores(data.filter(s => s.status === 'active'));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Use appUser from props instead of internal subscription

  const handleToggleFollow = async (e: React.MouseEvent, storeId: string) => {
    e.stopPropagation(); // Don't navigate to store page
    if (!currentUser) {
      alert(t('auth.login_required'));
      return;
    }

    const isFollowing = appUser?.followedStores?.includes(storeId);
    try {
      if (isFollowing) {
        await storeService.unfollowStore(storeId, currentUser.uid);
      } else {
        await storeService.followStore(storeId, currentUser.uid);
      }
    } catch (error) {
      console.error("Failed to toggle follow:", error);
    }
  };

  const filteredStores = stores.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="bg-stone-50 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-8 pb-3 sm:pb-4 shrink-0 space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
               <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl sm:2xl flex items-center justify-center shadow-lg shadow-stone-200">
                  <MapIcon className="w-5 h-5 sm:w-6 sm:h-6 text-stone-900" />
               </div>
               <div>
                 <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">{t('discover_stores.title')}</h2>
                 <p className="text-stone-400 text-[10px] sm:text-sm font-medium">{t('discover_stores.subtitle')}</p>
               </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 sm:p-3 hover:bg-white rounded-full transition-all border border-transparent hover:border-stone-100"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-stone-400" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4">
            {/* Search Bar */}
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-stone-300 transition-colors group-focus-within:text-stone-900" />
              <input
                type="text"
                placeholder={t('discover_stores.search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 sm:py-4 bg-white border border-stone-100 rounded-2xl sm:3xl focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 outline-none transition-all font-medium text-xs sm:text-sm text-stone-900 shadow-sm shadow-stone-100"
              />
            </div>

            {/* Category Dropdown */}
            <div className="relative sm:w-56 shrink-0">
              <button
                onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                className="w-full flex items-center justify-between pl-11 pr-4 py-3 sm:py-4 bg-white border border-stone-100 rounded-2xl sm:3xl hover:border-stone-200 transition-all font-bold text-[10px] sm:text-xs text-stone-900 shadow-sm shadow-stone-100 group whitespace-nowrap"
              >
                <Filter className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 group-hover:text-stone-900 transition-colors" />
                <span className="truncate pr-2">
                  {categoryOptions.find(c => c.value === activeCategory)?.label}
                </span>
                <ChevronDown className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-300 transition-transform duration-300 shrink-0", isCategoryOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isCategoryOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-[130]" 
                      onClick={() => setIsCategoryOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute top-full left-0 right-0 mt-2 p-1.5 sm:p-2 bg-white border border-stone-100 rounded-2xl sm:rounded-[2rem] shadow-2xl z-[140] overflow-hidden"
                    >
                      <div className="max-h-60 overflow-y-auto no-scrollbar">
                        {categoryOptions.map(cat => (
                          <button
                            key={cat.key}
                            onClick={() => {
                              setActiveCategory(cat.value);
                              setIsCategoryOpen(false);
                            }}
                            className={cn(
                              "w-full text-left px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl sm:2xl text-[9px] sm:text-[10px] uppercase tracking-widest font-black transition-all",
                              activeCategory === cat.value 
                                ? "bg-stone-900 text-white" 
                                : "text-stone-400 hover:text-stone-900 hover:bg-stone-50"
                            )}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-8 pt-3 sm:pt-4 space-y-4 sm:space-y-6 no-scrollbar">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-stone-100 border-t-stone-900 rounded-full animate-spin" />
                <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest">{t('discover_stores.loading')}</p>
             </div>
          ) : filteredStores.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-stone-100 rounded-[2.5rem] bg-white">
              <div className="w-16 h-16 bg-stone-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <StoreIcon className="w-8 h-8 text-stone-100" />
              </div>
              <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">{t('discover_stores.no_results')}</p>
            </div>
          ) : (
            <div className="grid gap-4 w-full">
              {filteredStores.map(store => {
                const isOwnStore = currentUser && store.ownerId === currentUser.uid;
                
                return (
                  <motion.div
                    key={store.id}
                    layout
                    onClick={() => onSelectStore(store.id)}
                    className={cn(
                      "p-3.5 sm:p-5 bg-white border rounded-2xl sm:rounded-[2.2rem] shadow-sm hover:shadow-2xl hover:shadow-stone-200/50 transition-all cursor-pointer group flex items-center justify-between gap-3 sm:gap-6 w-full overflow-hidden",
                      isOwnStore ? "border-emerald-500 bg-emerald-50/10 shadow-lg shadow-emerald-500/5" : "border-stone-50"
                    )}
                  >
                  <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1">
                    <div className={cn(
                      "w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-[1.5rem] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 duration-500",
                      store.category === 'Grocery' ? "bg-emerald-50 text-emerald-600" :
                      store.category === 'Pharmacy' ? "bg-rose-50 text-rose-600" :
                      store.category === 'Apparel' ? "bg-indigo-50 text-indigo-600" :
                      "bg-stone-50 text-stone-600"
                    )}>
                      <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-black text-stone-900 text-base sm:text-lg truncate tracking-tight">{store.name}</h4>
                        <div className="flex items-center gap-1.5">
                          {isOwnStore && (
                            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg">
                              {t('common.your_store', 'Your Store')}
                            </span>
                          )}
                          {store.isVerified && (
                            <div className="p-0.5 bg-emerald-500 rounded-full shrink-0">
                               <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 sm:gap-3 text-[10px] sm:text-xs font-bold text-stone-400">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                          <span>{store.averageRating?.toFixed(1) || '0.0'}</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1 text-indigo-500">
                          <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          <span>{t('store_front.followers_count', { count: store.followersCount || 0 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {isOwnStore ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowMerchantDashboard();
                        }}
                        className="h-10 sm:h-12 px-4 sm:px-6 bg-emerald-500 text-white rounded-xl sm:2xl flex items-center gap-2 font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                      >
                        <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>{t('merchant.settings', 'Edit Page')}</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleToggleFollow(e, store.id)}
                        className={cn(
                          "w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:2xl flex items-center justify-center transition-all",
                          appUser?.followedStores?.includes(store.id)
                            ? "bg-rose-50 text-rose-600 shadow-sm"
                            : "bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                        )}
                      >
                        <Heart className={cn("w-4 h-4 sm:w-5 sm:h-5 transition-all", appUser?.followedStores?.includes(store.id) && "fill-current scale-110")} />
                      </button>
                    )}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-stone-50 rounded-xl sm:2xl flex items-center justify-center group-hover:bg-stone-900 group-hover:text-white transition-all">
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 translate-x-0 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              )})}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-white border-t border-stone-100 flex items-center gap-2.5 sm:gap-3 px-6 sm:px-8 shrink-0">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-300" />
          <p className="text-[9px] sm:text-[10px] font-black text-stone-300 uppercase tracking-widest leading-none">
            {t('discover_stores.footer')}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
