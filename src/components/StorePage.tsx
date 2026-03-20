import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  MapPin, 
  ShoppingBag, 
  Star, 
  Share2, 
  ArrowLeft,
  ChevronRight,
  Plus,
  Check,
  Package,
  Heart,
  MessageCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  Info,
  LayoutGrid,
  List,
  SortAsc,
  History
} from 'lucide-react';
import { Store, StoreProduct, DAYS_OF_WEEK, DayKey, DailySchedule } from '../types';
import { storeService } from '../services/storeService';
import { shoppingService } from '../services/shoppingService';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface StorePageProps {
  storeId: string;
  onClose: () => void;
  onAddProductToList?: (product: StoreProduct, storeName?: string) => void;
  activeListId?: string;
}

export const StorePage: React.FC<StorePageProps> = ({ storeId, onClose, onAddProductToList, activeListId }) => {
  const { t } = useTranslation();
  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [addedItemIds, setAddedItemIds] = useState<Set<string>>(new Set());
  const [existingProductIds, setExistingProductIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'newest' | 'alpha'>('newest');

  useEffect(() => {
    if (!activeListId) {
      setExistingProductIds(new Set());
      return;
    }

    const unsubscribe = shoppingService.subscribeToItems(activeListId, (items) => {
      const ids = new Set(items.map(item => item.productId).filter(id => id !== undefined) as string[]);
      setExistingProductIds(ids);
    });

    return () => unsubscribe();
  }, [activeListId]);

  useEffect(() => {
    const fetchStore = async () => {
      try {
        // We'll add getStoreById to storeService or use a subscription
        const storeRef = await storeService.subscribeToAllStores((all) => {
          const s = all.find(item => item.id === storeId);
          if (s) setStore(s);
          setLoading(false);
        });
        return () => storeRef();
      } catch (error) {
        console.error("Error fetching store:", error);
        setLoading(false);
      }
    };
    fetchStore();
  }, [storeId]);

  useEffect(() => {
    if (store) {
      const unsubscribe = storeService.subscribeToStoreProducts(store.id, (data) => {
        // Apply sorting
        const sorted = [...data].sort((a, b) => {
          if (sortBy === 'alpha') return a.name.localeCompare(b.name);
          return (b.createdAt || 0) - (a.createdAt || 0); // Newest first
        });
        setProducts(sorted);
      });
      return () => unsubscribe();
    }
  }, [store, sortBy]);

  const handleAdd = (product: StoreProduct) => {
    if (onAddProductToList) {
      onAddProductToList(product, store?.name);
      setAddedItemIds(prev => new Set(prev).add(product.id));
      setTimeout(() => {
        setAddedItemIds(prev => {
          const next = new Set(prev);
          next.delete(product.id);
          return next;
        });
      }, 2000);
    }
  };

  const formatWorkingHours = (hours?: string) => {
    if (!hours) return t('store_front.hours_not_available', 'Hours not available');
    
    if (hours.startsWith('{')) {
      try {
        const schedules = JSON.parse(hours) as Record<DayKey, DailySchedule>;
        return DAYS_OF_WEEK
          .map(day => {
            const sched = schedules[day];
            const dayLabel = t(`merchant.weekdays.${day}`).substring(0, 3);
            return sched.isOpen ? `${dayLabel}: ${sched.open}-${sched.close}` : `${dayLabel}: ${t('merchant.closed')}`;
          })
          .join(', ');
      } catch (e) {
        return hours;
      }
    }
    return hours;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[150] bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-stone-100 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!store) return null;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-[150] bg-white flex flex-col overflow-hidden"
    >
      {/* Dynamic Header */}
      <div className="relative h-64 shrink-0 overflow-hidden">
        {/* Banner Mockup */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-br transition-all duration-700",
          store.themeColor === 'Emerald' ? "from-emerald-400 to-teal-600" :
          store.themeColor === 'Indigo' ? "from-indigo-400 to-purple-600" :
          store.themeColor === 'Rose' ? "from-rose-400 to-pink-600" :
          store.themeColor === 'Amber' ? "from-amber-400 to-orange-600" :
          store.themeColor === 'Stone' ? "from-stone-400 to-stone-600" :
          // Fallback to category colors
          store.category === 'Grocery' ? "from-emerald-400 to-teal-600" :
          store.category === 'Pharmacy' ? "from-rose-400 to-pink-600" :
          store.category === 'Apparel' ? "from-indigo-400 to-purple-600" :
          "from-stone-400 to-stone-600"
        )} />
        
        {/* Floating Controls */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20">
          <button
            onClick={onClose}
            className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white/30 transition-all active:scale-90 shadow-xl"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex gap-2">
            <button className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white/30 transition-all active:scale-90 shadow-xl">
              <Share2 className="w-6 h-6" />
            </button>
            <button className="p-3 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white/30 transition-all active:scale-90 shadow-xl">
              <Heart className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Store Brand Info */}
        <div className="absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-white via-white/80 to-transparent">
          <div className="flex items-end gap-6 translate-y-2">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-2xl flex items-center justify-center border-4 border-white overflow-hidden shrink-0">
               <ShoppingBag className={cn(
                 "w-12 h-12",
                 store.category === 'Grocery' ? "text-emerald-500" :
                 store.category === 'Pharmacy' ? "text-rose-500" :
                 "text-stone-300"
               )} />
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-black text-stone-900 tracking-tight">{store.name}</h1>
                {store.isVerified && (
                  <div className="bg-emerald-500 rounded-full p-1" title={t('store_front.verified_badge')}>
                    <Check className="w-3 h-3 text-white stroke-[4px]" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-stone-400 font-bold text-sm">
                 <div className="flex items-center gap-1">
                   <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                   <span className="text-stone-900">4.8</span>
                   <span className="font-medium">(120+)</span>
                 </div>
                 <span>•</span>
                 <div className="flex items-center gap-1 uppercase tracking-widest text-[10px]">
                   {store.category}
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
        <div className="px-8 space-y-8">
          
          {/* Stats Bar */}
          <div className="flex items-center justify-between bg-stone-50 rounded-3xl p-4 border border-stone-100">
            <div className="text-center flex-1 border-r border-stone-200">
              <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-0.5">{t('store_front.followers_label')}</p>
              <p className="text-lg font-black text-stone-900">{store.followersCount}</p>
            </div>
            <div className="text-center flex-1 border-r border-stone-200">
              <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-0.5">{t('store_front.rating_label')}</p>
              <div className="flex items-center justify-center gap-0.5">
                <p className="text-lg font-black text-stone-900">4.8</p>
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              </div>
            </div>
            <div className="text-center flex-1">
               <button 
                 onClick={() => setFollowing(!following)}
                 className={cn(
                   "px-6 py-2 rounded-xl font-bold text-sm transition-all",
                   following ? "bg-stone-200 text-stone-600" : "bg-stone-900 text-white shadow-lg shadow-stone-200"
                 )}
               >
                 {following ? t('store_front.unfollow') : t('store_front.follow')}
               </button>
            </div>
          </div>

          {/* About */}
          <div className="space-y-4">
             <div className="flex items-center justify-between">
               <h3 className="text-xl font-black text-stone-900 tracking-tight">{t('store_front.info_title')}</h3>
               <Info className="w-5 h-5 text-stone-300" />
             </div>
             <div className="grid gap-4">
                <div className="flex items-start gap-3 p-4 bg-stone-50 rounded-2xl">
                  <MapPin className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-stone-700">{t('store_front.location_label')}</p>
                    <p className="text-sm text-stone-500 font-medium">{store.location?.address || '123 Market St, Downtown City'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-stone-50 rounded-2xl">
                  <Clock className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-stone-700">{t('store_front.hours_label')}</p>
                    <p className="text-sm text-stone-500 font-medium">{formatWorkingHours(store.workingHours)}</p>
                  </div>
                </div>
                 {store.contactPhone && (
                   <div className="flex items-start gap-3 p-4 bg-stone-50 rounded-2xl">
                     <MessageCircle className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                     <div>
                       <p className="text-sm font-bold text-stone-700">{t('store_front.contact_label')}</p>
                       <p className="text-sm text-stone-500 font-medium">{store.contactPhone}</p>
                     </div>
                   </div>
                 )}
                 {store.website && (
                   <div className="flex items-start gap-3 p-4 bg-stone-50 rounded-2xl">
                     <ExternalLink className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                     <div>
                       <p className="text-sm font-bold text-stone-700">{t('store_front.website_label')}</p>
                       <a href={store.website} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 font-bold hover:underline">
                         {store.website.replace(/^https?:\/\//, '')}
                       </a>
                     </div>
                   </div>
                 )}
              </div>
             <p className="text-stone-500 text-sm leading-relaxed font-medium px-1">
               {store.description}
             </p>
          </div>

          {/* Products Section */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-2xl font-black text-stone-900 tracking-tight">{t('store_front.products')}</h3>
              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex bg-stone-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={cn("p-2 rounded-lg transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-stone-900" : "text-stone-400")}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-white shadow-sm text-stone-900" : "text-stone-400")}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Sort Toggle */}
                <div className="flex bg-stone-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setSortBy('newest')}
                    className={cn("p-2 rounded-lg transition-all flex items-center gap-1.5 px-3", sortBy === 'newest' ? "bg-white shadow-sm text-stone-900" : "text-stone-400")}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-wider">{t('store_front.sort_newest', 'Newest')}</span>
                  </button>
                  <button 
                    onClick={() => setSortBy('alpha')}
                    className={cn("p-2 rounded-lg transition-all flex items-center gap-1.5 px-3", sortBy === 'alpha' ? "bg-white shadow-sm text-stone-900" : "text-stone-400")}
                  >
                    <SortAsc className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-wider">{t('store_front.sort_alpha', 'A-Z')}</span>
                  </button>
                </div>

                <div className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest h-9 flex items-center">
                  {t('store_front.items_available', { count: products.length })}
                </div>
              </div>
            </div>

            { products.length === 0 ? (
              <div className="py-20 text-center space-y-4 border-2 border-dashed border-stone-100 rounded-[2.5rem]">
                 <Package className="w-12 h-12 text-stone-100 mx-auto" />
                 <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">{t('store_front.no_items')}</p>
              </div>
            ) : (
              <div className={cn(
                "grid gap-6",
                viewMode === 'grid' 
                  ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" 
                  : "grid-cols-1 max-w-3xl mx-auto w-full"
              )}>
                {products.map(product => (
                  <motion.div
                    key={product.id}
                    layout
                    className={cn(
                      "p-5 bg-white border border-stone-100 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:shadow-indigo-50/50 hover:border-indigo-100 transition-all flex gap-4 group",
                      viewMode === 'grid' ? "flex-col" : "flex-row items-center"
                    )}
                  >
                    <div className={cn(
                      "relative bg-stone-50 rounded-[1.8rem] flex items-center justify-center overflow-hidden shrink-0",
                      viewMode === 'grid' ? "aspect-square w-full" : "w-24 h-24"
                    )}>
                       {product.imageUrl ? (
                         <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
                       ) : (
                         <ShoppingBag className="w-10 h-10 text-stone-200 transition-transform group-hover:scale-110 duration-500" />
                       )}
                       {existingProductIds.has(product.id) && (
                         <div className="absolute top-3 right-3 p-1.5 bg-emerald-500 text-white rounded-lg shadow-lg border border-white/20 z-10" title={t('store_front.in_your_list', 'In Your List')}>
                           <Check className="w-3.5 h-3.5 stroke-[4px]" />
                         </div>
                       )}
                       <div className="absolute top-3 left-3 px-2 py-0.5 bg-white/90 backdrop-blur-md rounded-lg shadow-sm border border-stone-100">
                         <span className="text-[10px] font-black text-stone-900">{t('common.currency_symbol')}{product.price.toFixed(2)}</span>
                       </div>
                       {!product.inStock && (
                         <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                            <span className="px-3 py-1 bg-stone-900 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full">
                              {t('store_front.out_of_stock')}
                            </span>
                         </div>
                       )}
                    </div>
                    
                    <div className="flex-1 space-y-1 min-w-0">
                      <h4 className="font-bold text-stone-900 text-sm truncate">{product.name}</h4>
                      <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest truncate">{t(`merchant.categories.${product.category?.toLowerCase() || 'grocery'}`)}</p>
                      {viewMode === 'list' && product.description && (
                        <p className="text-stone-400 text-xs line-clamp-1 mt-1 font-medium">{product.description}</p>
                      )}
                    </div>

                    <button
                      disabled={!product.inStock || addedItemIds.has(product.id) || existingProductIds.has(product.id)}
                      onClick={() => handleAdd(product)}
                      className={cn(
                        "rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 shrink-0 h-12",
                        viewMode === 'grid' ? "w-full py-3" : "px-6 py-3",
                        (addedItemIds.has(product.id) || existingProductIds.has(product.id)) ? "bg-emerald-500 text-white shadow-emerald-100" :
                        product.inStock ? "bg-stone-900 text-white hover:bg-indigo-600 shadow-xl shadow-stone-100" : "bg-stone-100 text-stone-400 cursor-not-allowed"
                      )}
                    >
                      { (addedItemIds.has(product.id) || existingProductIds.has(product.id)) ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[4px]" />
                          <span className={cn(viewMode === 'list' && "hidden sm:inline")}>{t('store_front.in_list', 'In List')}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                          <span className={cn(viewMode === 'list' && "hidden sm:inline")}>{t('store_front.add_to_list')}</span>
                        </>
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* CTA / Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
             <button className="p-6 bg-stone-50 rounded-[2rem] flex flex-col items-center gap-3 border border-stone-100 hover:bg-stone-100 transition-all">
               <div className="p-3 bg-white rounded-2xl shadow-sm">
                 <MessageCircle className="w-6 h-6 text-stone-600" />
               </div>
               <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">{t('store_front.contact')}</span>
             </button>
             <button className="p-6 bg-stone-50 rounded-[2rem] flex flex-col items-center gap-3 border border-stone-100 hover:bg-stone-100 transition-all">
               <div className="p-3 bg-white rounded-2xl shadow-sm">
                 <ShieldCheck className="w-6 h-6 text-stone-600" />
               </div>
               <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">{t('store_front.report_store')}</span>
             </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
