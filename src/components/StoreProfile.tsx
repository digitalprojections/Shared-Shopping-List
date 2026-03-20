import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  MapPin, 
  ShoppingBag, 
  Heart, 
  Share2, 
  ExternalLink,
  CheckCircle2,
  Clock,
  Info
} from 'lucide-react';
import { Store, StoreProduct } from '../types';
import { storeService } from '../services/storeService';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { StoreWorkingHours } from './StoreWorkingHours';

interface StoreProfileProps {
  store: Store;
  onBack: () => void;
}

export const StoreProfile: React.FC<StoreProfileProps> = ({ store, onBack }) => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = storeService.subscribeToStoreProducts(store.id, (data) => {
      setProducts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [store.id]);

  return (
    <div className="flex flex-col min-h-full bg-stone-50 overflow-y-auto no-scrollbar pb-24">
      {/* Header / Hero */}
      <div className="relative h-48 sm:h-64 bg-emerald-600 shrink-0">
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        
        <button
          onClick={onBack}
          className="absolute top-6 left-6 p-3 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-2xl transition-all active:scale-95 z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button
          className="absolute top-6 right-6 p-3 bg-white/20 backdrop-blur-md hover:bg-white/30 text-white rounded-2xl transition-all active:scale-95 z-10"
        >
          <Share2 className="w-6 h-6" />
        </button>

        <div className="absolute -bottom-12 left-6 right-6 flex items-end gap-4">
          <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-[2rem] shadow-xl flex items-center justify-center p-2 ring-4 ring-white shrink-0 overflow-hidden">
            <div className="w-full h-full bg-emerald-50 rounded-[1.5rem] flex items-center justify-center">
              <ShoppingBag className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-600" />
            </div>
          </div>
          <div className="pb-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl sm:text-3xl font-black text-stone-900 truncate">
                {store.name}
              </h1>
              {store.isVerified && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-stone-500 font-medium text-sm">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{store.location?.address || t('merchant.local_store')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-16 px-6 space-y-8">
        {/* Info & Description */}
        <section className="space-y-4">
          <div className="flex gap-4 p-4 bg-white rounded-3xl border border-stone-100 shadow-sm">
            <div className="flex-1 text-center border-r border-stone-50">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">{t('store_profile.category_label')}</p>
              <p className="font-bold text-stone-800">{t(`merchant.categories.${store.category.toLowerCase()}`)}</p>
            </div>
            <div className="flex-1 text-center border-r border-stone-50">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">{t('store_profile.followers_label')}</p>
              <p className="font-bold text-stone-800">{store.followersCount || 0}</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">{t('store_profile.status_label')}</p>
              <p className={cn(
                "font-bold",
                store.status === 'active' ? "text-emerald-600" : "text-amber-500"
              )}>
                {store.status === 'active' ? t('store_profile.status_open') : t('store_profile.status_pending')}
              </p>
            </div>
          </div>
          
          <div className="p-6 bg-white rounded-3xl border border-stone-100 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold text-stone-400 uppercase tracking-widest mb-3">
              <Info className="w-4 h-4" />
              {t('store_profile.about_title')}
            </h3>
            <p className="text-stone-600 leading-relaxed">
              {store.description || t('store_profile.no_description')}
            </p>
          </div>

          <StoreWorkingHours workingHours={store.workingHours} />
        </section>

        {/* Products Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black text-stone-900 tracking-tight">{t('store_profile.products_in_stock')}</h2>
            <span className="text-xs font-bold text-stone-400 bg-stone-100 px-3 py-1 rounded-full">{t('store_profile.item_count', { count: products.length })}</span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="aspect-[4/5] bg-stone-200 animate-pulse rounded-[2rem]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-stone-100">
              <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-8 h-8 text-stone-200" />
              </div>
              <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">{t('store_profile.no_products')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {products.map(product => (
                <motion.div
                  key={product.id}
                  layoutId={product.id}
                  className="group bg-white rounded-[2rem] border border-stone-100 shadow-sm overflow-hidden hover:shadow-xl hover:shadow-emerald-900/5 transition-all"
                >
                  <div className="aspect-square bg-stone-50 flex items-center justify-center relative overflow-hidden">
                    <ShoppingBag className="w-10 h-10 text-stone-100 group-hover:scale-110 transition-transform duration-500" />
                    
                    {!product.inStock && (
                      <div className="absolute inset-0 bg-stone-900/10 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="px-3 py-1 bg-white/90 rounded-full text-[10px] font-black uppercase text-stone-400 tracking-widest">{t('store_profile.out_of_stock')}</span>
                      </div>
                    )}

                    {product.saleEnd && product.saleEnd > Date.now() && (
                      <div className="absolute top-3 left-3 px-2 py-1 bg-rose-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-sm">
                        {t('store_profile.sale_badge')}
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 space-y-1">
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest truncate">{product.category || t('merchant.categories.general')}</p>
                    <h4 className="font-bold text-stone-900 truncate">{product.name}</h4>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm font-black text-emerald-600">{t('common.currency_symbol')} {product.price}</span>
                      <button className="p-2 hover:bg-rose-50 text-stone-300 hover:text-rose-500 rounded-xl transition-colors">
                        <Heart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
