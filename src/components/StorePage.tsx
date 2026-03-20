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
  ChevronDown,
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
  History,
  Search
} from 'lucide-react';
import { Store, StoreProduct, ListItem } from '../types';
import { storeService } from '../services/storeService';
import { shoppingService } from '../services/shoppingService';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { StoreWorkingHours } from './StoreWorkingHours';


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

  const renderProductCard = (product: StoreProduct) => {
    const isAdded = addedItemIds.has(product.id) || existingProductIds.has(product.id);
    
    return (
      <motion.div
        key={product.id}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "group bg-stone-50 rounded-[2rem] p-4 sm:p-6 hover:bg-white hover:shadow-2xl hover:shadow-indigo-900/5 transition-all flex h-full relative overflow-hidden ring-1 ring-stone-100 hover:ring-indigo-100",
          viewMode === 'grid' ? "flex-col gap-4" : "flex-row items-center gap-6"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-500/0 group-hover:from-indigo-500/[0.03] group-hover:to-transparent transition-all duration-700" />
        
        <div className={cn(
          "relative rounded-[1.5rem] flex items-center justify-center transition-all bg-white shadow-sm overflow-hidden",
          viewMode === 'grid' ? "w-full aspect-square" : "w-16 h-16 sm:w-20 sm:h-20 shrink-0"
        )}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-stone-50">
              <ShoppingBag className="w-8 h-8 text-stone-200 group-hover:scale-110 transition-transform duration-700" />
            </div>
          )}

          {/* In List Badge Overlay */}
          {existingProductIds.has(product.id) && (
            <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px] flex items-center justify-center z-10 group-hover:backdrop-blur-none transition-all">
              <div className="bg-emerald-500 text-white p-2 rounded-full shadow-lg shadow-emerald-500/20 translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                 <Check className="w-4 h-4 stroke-[4px]" />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2 flex-1 min-w-0 flex flex-col relative z-20">
          <div className="flex-1">
            <h4 className="font-bold text-stone-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-tight">
              {product.name}
            </h4>
            <div className="flex flex-wrap gap-1 mt-1">
              <p className="text-stone-400 text-[9px] font-black uppercase tracking-wider bg-stone-100 px-2 py-0.5 rounded-full inline-block">
                {t(`merchant.categories.${product.category?.toLowerCase() || 'grocery'}`)}
              </p>
              {!product.inStock && (
                <p className="text-rose-500 text-[9px] font-black uppercase tracking-wider bg-rose-50 px-2 py-0.5 rounded-full inline-block">
                  {t('store_front.out_of_stock')}
                </p>
              )}
            </div>
          </div>
          
          <div className={cn(
            "flex items-center justify-between pt-2 border-t border-stone-100 mt-2",
            viewMode === 'list' && "pt-0 border-t-0 mt-0"
          )}>
            <div className="flex flex-col">
              <span className="text-[14px] font-black text-stone-900 leading-none">
                <span className="text-[10px] text-indigo-500 mr-0.5">{t('common.currency_symbol')}</span>
                {product.price.toFixed(2)}
              </span>
            </div>
            
            <button
              disabled={!product.inStock || addedItemIds.has(product.id) || existingProductIds.has(product.id)}
              onClick={() => handleAdd(product)}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 group/btn overflow-hidden",
                existingProductIds.has(product.id)
                  ? "bg-emerald-100 text-emerald-600 shadow-sm"
                  : addedItemIds.has(product.id)
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                  : product.inStock
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                  : "bg-stone-100 text-stone-400 cursor-not-allowed"
              )}
            >
              { (addedItemIds.has(product.id) || existingProductIds.has(product.id)) ? (
                <Check className="w-4 h-4 stroke-[3px]" />
              ) : (
                <Plus className="w-5 h-5 group-hover/btn:scale-125 transition-transform" />
              )}
            </button>
          </div>
        </div>
      </motion.div>
    );
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
                    <StoreWorkingHours workingHours={store.workingHours} t={t} />
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
              <div className="space-y-12">
                {/* Items in list section */}
                {products.some(p => existingProductIds.has(p.id)) && (
                  <div className="bg-emerald-50/50 p-6 sm:p-8 rounded-[3rem] border border-emerald-100/50 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Check className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-stone-900 tracking-tight">{t('store.items_in_list', 'In Your Shopping List')}</h4>
                        <p className="text-emerald-600/60 text-xs font-bold uppercase tracking-widest">
                          {t('store.ready_to_buy', 'Items you added to your list')}
                        </p>
                      </div>
                    </div>
                    
                    <div className={cn(
                      "grid gap-6",
                      viewMode === 'grid' 
                        ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" 
                        : "grid-cols-1 max-w-3xl"
                    )}>
                      {products.filter(p => existingProductIds.has(p.id)).map(product => renderProductCard(product))}
                    </div>
                  </div>
                )}

                {/* Main catalog */}
                <div className="space-y-6">
                  {products.some(p => existingProductIds.has(p.id)) && (
                    <h4 className="text-sm font-black text-stone-400 uppercase tracking-widest px-2">{t('store_front.all_products', 'All Products')}</h4>
                  )}
                  <div className={cn(
                    "grid gap-6",
                    viewMode === 'grid' 
                      ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" 
                      : "grid-cols-1 max-w-3xl mx-auto w-full"
                  )}>
                    {products.map(product => renderProductCard(product))}
                  </div>
                </div>
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
