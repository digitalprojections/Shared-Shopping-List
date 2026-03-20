import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Store as StoreIcon, 
  Plus, 
  MapPin, 
  Settings, 
  Trash2, 
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  ArrowLeft,
  Search,
  LayoutDashboard,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { Store } from '../types';
import { storeService } from '../services/storeService';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { MerchantRegistrationModal } from './MerchantRegistrationModal';
import { ProductManager } from './ProductManager';

interface MerchantDashboardProps {
  userId: string;
  onClose: () => void;
}

export const MerchantDashboard: React.FC<MerchantDashboardProps> = ({ userId, onClose }) => {
  const { t } = useTranslation();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [managingInventoryStore, setManagingInventoryStore] = useState<Store | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = storeService.subscribeToMyStores(userId, (data) => {
      setStores(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  const handleDelete = async (storeId: string) => {
    if (!window.confirm(t('merchant.delete_confirm_q'))) return;
    setProcessingId(storeId);
    try {
      await storeService.deleteStore(storeId);
    } catch (error) {
      console.error("Error deleting store:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredStores = stores.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-stone-50 flex flex-col overflow-hidden"
    >
      {/* Premium Navigation Header */}
      <header className="bg-stone-900 text-white shrink-0 px-6 py-4 sm:px-10 sm:py-6 shadow-2xl z-10 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={onClose}
            className="p-3 hover:bg-white/10 rounded-2xl transition-all active:scale-90 group"
          >
            <ArrowLeft className="w-6 h-6 text-white/70 group-hover:text-white group-hover:-translate-x-1 transition-all" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                {t('merchant.hub')}
                <span className="hidden sm:inline-block px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] uppercase font-black rounded-lg border border-emerald-500/30">{t('common.business', 'Business')}</span>
              </h1>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">{t('merchant.dashboard_subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center bg-white/5 rounded-2xl px-4 py-2 border border-white/10 focus-within:border-emerald-500/50 transition-all">
            <Search className="w-4 h-4 text-white/30" />
            <input 
              type="text"
              placeholder={t('merchant.search_stores')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-white px-3 w-48 placeholder:text-white/20"
            />
          </div>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-400 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">{t('merchant.add_location')}</span>
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b border-stone-100 flex items-center gap-8 px-10 py-4 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-stone-50 rounded-lg flex items-center justify-center">
            <StoreIcon className="w-4 h-4 text-stone-400" />
          </div>
          <div>
            <p className="text-[10px] font-black text-stone-300 uppercase leading-none mb-1">{t('merchant.total_stores')}</p>
            <p className="text-lg font-black text-stone-900 leading-none">{stores.length}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="text-[10px] font-black text-stone-300 uppercase leading-none mb-1">{t('merchant.active')}</p>
            <p className="text-lg font-black text-stone-900 leading-none">{stores.filter(s => s.status === 'active').length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] font-black text-stone-300 uppercase leading-none mb-1">{t('merchant.pending')}</p>
            <p className="text-lg font-black text-stone-900 leading-none">{stores.filter(s => s.status === 'pending').length}</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 no-scrollbar bg-stone-50/50">
        <div className="w-full space-y-10">
          
          <AnimatePresence mode="popLayout text-stone-900">
            {loading ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-32 space-y-4"
              >
                <div className="w-12 h-12 border-4 border-stone-200 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-stone-400 font-black uppercase tracking-[0.2em] text-xs">{t('merchant.loading_stores')}</p>
              </motion.div>
            ) : filteredStores.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-32 text-center space-y-8 bg-white rounded-[3rem] border border-stone-100 shadow-sm px-10"
              >
                <div className="w-24 h-24 bg-stone-50 rounded-[2rem] flex items-center justify-center shadow-inner relative">
                  <StoreIcon className="w-12 h-12 text-stone-200" />
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-lg border border-stone-50 flex items-center justify-center italic font-serif text-stone-300">?</div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-black text-stone-900 tracking-tight">{t('merchant.no_stores_found')}</h3>
                  <p className="text-stone-500 max-w-sm mx-auto font-medium">
                    {searchQuery ? t('merchant.no_stores_search_desc') : t('merchant.no_stores_desc')}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-3 px-10 py-5 bg-stone-900 text-white font-black rounded-3xl hover:bg-emerald-600 transition-all active:scale-95 shadow-2xl shadow-stone-200 group"
                >
                  <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                  <span>{searchQuery ? t('common.clear_search') : t('merchant.register_business_btn')}</span>
                </button>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-8">
                {filteredStores.map((store, index) => (
                  <motion.div
                    key={store.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group bg-white rounded-[2.5rem] border border-stone-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-900/5 transition-all flex flex-col overflow-hidden h-full relative"
                  >
                    {/* Badge Overlay */}
                    <div className="absolute top-6 left-6 z-10 flex flex-wrap gap-2">
                      <div className={cn(
                        "px-3 py-1.5 rounded-xl flex items-center gap-2 backdrop-blur-md shadow-sm border",
                        store.status === 'active' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                        store.status === 'pending' ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                        "bg-rose-500/10 text-rose-600 border-rose-500/20"
                      )}>
                        {store.status === 'active' ? <ShieldCheck className="w-3.5 h-3.5" /> : 
                         store.status === 'pending' ? <Clock className="w-3.5 h-3.5" /> : 
                         <XCircle className="w-3.5 h-3.5" />}
                        <span className="text-[10px] font-black uppercase tracking-wider leading-none">
                          {store.status === 'active' ? t('merchant.verified') : t(`merchant.status.${store.status}`)}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDelete(store.id)}
                      className="absolute top-6 right-6 z-10 p-3 bg-white/80 backdrop-blur-sm rounded-xl text-stone-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>

                    {/* Placeholder Hero */}
                    <div className="h-32 bg-stone-50 flex items-center justify-center border-b border-stone-50 overflow-hidden relative">
                       <StoreIcon className="w-16 h-16 text-stone-100 group-hover:scale-110 transition-transform duration-700" />
                       <div className="absolute bottom-4 left-6 px-3 py-1 bg-white/90 rounded-full text-[9px] font-black text-stone-400 uppercase tracking-widest border border-stone-100/50">{t(`merchant.categories.${store.category.toLowerCase()}`)}</div>
                    </div>

                    <div className="p-8 flex-1 flex flex-col">
                      <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                          <h4 className="text-xl font-black text-stone-900 tracking-tight leading-tight group-hover:text-emerald-600 transition-colors">{store.name}</h4>
                          <div className="flex items-center gap-1.5 text-stone-400 text-xs font-bold">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="truncate">{store.location?.address || t('merchant.address_tbd')}</span>
                          </div>
                        </div>
                        
                        <p className="text-stone-500 text-sm leading-relaxed line-clamp-3 font-medium">
                          {store.description || t('merchant.default_desc')}
                        </p>
                      </div>

                      <div className="pt-8 flex items-center gap-3 mt-auto">
                        <button
                          onClick={() => {
                            if (store) {
                              setEditingStore(store);
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-stone-50 text-stone-600 font-black rounded-2xl hover:bg-stone-100 transition-all active:scale-95 text-sm"
                        >
                          <Settings className="w-5 h-5" />
                          <span>{store.status === 'active' ? t('merchant.settings') : t('merchant.edit_app')}</span>
                        </button>
                        
                        {store.status === 'active' && (
                          <button
                            onClick={() => {
                              if (store) {
                                setManagingInventoryStore(store);
                              }
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-400 transition-all active:scale-95 text-sm shadow-xl shadow-emerald-500/10"
                          >
                            <Package className="w-5 h-5" />
                            <span>{t('merchant.inventory')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="bg-white border-t border-stone-100 p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] max-w-[240px]">
            {t('merchant.branding_p')}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-xs font-bold text-stone-400 hover:text-stone-900 transition-colors uppercase tracking-widest flex items-center gap-2">
            {t('merchant.docs_link')} <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>

      {/* Overlays */}
      <AnimatePresence>
        {showAddModal && (
          <MerchantRegistrationModal 
            userId={userId} 
            onClose={() => setShowAddModal(false)} 
            onSuccess={() => {}} 
          />
        )}
        {editingStore && (
          <MerchantRegistrationModal 
            userId={userId} 
            initialStore={editingStore}
            onClose={() => setEditingStore(null)} 
            onSuccess={() => {}} 
          />
        )}
        {managingInventoryStore && (
          <ProductManager
            store={managingInventoryStore}
            onClose={() => setManagingInventoryStore(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
