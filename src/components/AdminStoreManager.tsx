import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Store as StoreIcon, 
  Check, 
  XCircle, 
  MapPin, 
  User as UserIcon,
  Search,
  AlertCircle,
  Shield,
  Trash2,
  Settings
} from 'lucide-react';
import { Store } from '../types';
import { storeService } from '../services/storeService';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { MerchantRegistrationModal } from './MerchantRegistrationModal';

interface AdminStoreManagerProps {
  onClose: () => void;
}

export const AdminStoreManager: React.FC<AdminStoreManagerProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'stale'>('pending');
  const [stores, setStores] = useState<Store[]>([]);
  const [staleImages, setStaleImages] = useState<{ path: string; url: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'stale') {
      handleRefreshStale();
      return () => {};
    }
    
    setLoading(true);
    let unsubscribe: () => void;
    
    if (activeTab === 'pending') {
      unsubscribe = storeService.subscribeToPendingStores((data) => {
        setStores(data);
        setLoading(false);
      });
    } else {
      unsubscribe = storeService.subscribeToAllStores((data) => {
        setStores(data);
        setLoading(false);
      });
    }
    
    return () => unsubscribe();
  }, [activeTab]);

  const handleRefreshStale = async () => {
    setLoading(true);
    try {
      const images = await storeService.findStaleImages();
      setStaleImages(images);
    } catch (error) {
      console.error("Error finding stale images:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStale = async (path: string) => {
    if (!window.confirm(t('admin.delete_stale_confirm', 'Are you sure you want to delete this stale image?'))) return;
    setProcessingId(path);
    try {
      await storeService.deleteStorageObject(path);
      setStaleImages(prev => prev.filter(img => img.path !== path));
    } catch (error) {
      console.error("Error deleting stale image:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteAllStale = async () => {
    if (!window.confirm(t('admin.delete_all_stale_confirm', 'Delete ALL stale images?'))) return;
    setLoading(true);
    try {
      for (const img of staleImages) {
        await storeService.deleteStorageObject(img.path);
      }
      setStaleImages([]);
    } catch (error) {
      console.error("Error deleting all stale images:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (store: Store) => {
    setProcessingId(store.id);
    try {
      await storeService.approveStore(store.id, store.ownerId);
    } catch (error) {
      console.error("Error approving store:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (storeId: string) => {
    setProcessingId(storeId);
    try {
      await storeService.rejectStore(storeId);
    } catch (error) {
      console.error("Error rejecting store:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (storeId: string) => {
    if (!window.confirm(t('admin.delete_confirm'))) return;
    setProcessingId(storeId);
    try {
      await storeService.deleteStore(storeId);
    } catch (error) {
      console.error("Error deleting store:", error);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 border-b border-stone-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                {t('admin.manage_stores', 'Store Management')}
              </h2>
              <p className="text-stone-400 text-sm font-medium">{t('admin.moderate_subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-8 pt-4 flex gap-8 border-b border-stone-100 shrink-0">
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              "pb-4 text-sm font-bold transition-all relative",
              activeTab === 'pending' ? "text-amber-600" : "text-stone-400 hover:text-stone-600"
            )}
          >
            {t('admin.pending_tab')}
            {activeTab === 'pending' && (
              <motion.div layoutId="admintab" className="absolute bottom-0 left-0 right-0 h-1 bg-amber-600 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "pb-4 text-sm font-bold transition-all relative",
              activeTab === 'all' ? "text-stone-900" : "text-stone-400 hover:text-stone-600"
            )}
          >
            {t('admin.all_stores_tab')}
            {activeTab === 'all' && (
              <motion.div layoutId="admintab" className="absolute bottom-0 left-0 right-0 h-1 bg-stone-900 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('stale')}
            className={cn(
              "pb-4 text-sm font-bold transition-all relative",
              activeTab === 'stale' ? "text-rose-600" : "text-stone-400 hover:text-stone-600"
            )}
          >
            {t('admin.stale_images_tab', 'Stale Images')}
            {activeTab === 'stale' && (
              <motion.div layoutId="admintab" className="absolute bottom-0 left-0 right-0 h-1 bg-rose-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-stone-100 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">{t('admin.syncing')}</p>
            </div>
          ) : activeTab === 'stale' ? (
            staleImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-stone-50 rounded-[2rem] border-2 border-dashed border-stone-100">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                  <Check className="w-8 h-8 text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-stone-900">{t('admin.no_stale_data', 'System Clean!')}</h3>
                  <p className="text-stone-400 text-sm">{t('admin.no_stale_desc', 'No stale images found in storage.')}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-rose-50 p-4 rounded-3xl border border-rose-100 mb-4">
                  <div>
                    <h4 className="text-rose-900 font-black text-sm uppercase tracking-widest">{staleImages.length} {t('admin.stale_count', 'Stale Files')}</h4>
                    <p className="text-rose-600 text-xs font-bold">{t('admin.stale_hint', 'These files occupy space but are not linked to any store or product.')}</p>
                  </div>
                  <button 
                    onClick={handleDeleteAllStale}
                    className="px-6 py-2 bg-rose-600 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 active:scale-95 transition-all"
                  >
                    {t('admin.delete_all_stale', 'Flush All')}
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {staleImages.map(img => (
                    <motion.div
                      layout
                      key={img.path}
                      className="group bg-white rounded-3xl border border-stone-100 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
                    >
                      <div className="aspect-square bg-stone-50 relative overflow-hidden">
                        <img src={img.url} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Trash2 
                            className="w-8 h-8 text-white cursor-pointer hover:scale-125 transition-transform" 
                            onClick={() => handleDeleteStale(img.path)}
                          />
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-[9px] font-mono text-stone-400 truncate">{img.path}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          ) : stores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-stone-50 rounded-[2rem] border-2 border-dashed border-stone-100">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-stone-900">{t('admin.nothing_here')}</h3>
                <p className="text-stone-400 text-sm">{t('admin.no_stores_found')}</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {stores.map(store => (
                <motion.div
                  key={store.id}
                  layout
                  className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full",
                        store.status === 'active' ? "bg-emerald-50 text-emerald-600" :
                        store.status === 'pending' ? "bg-amber-50 text-amber-600" :
                        "bg-rose-50 text-rose-600"
                      )}>
                        {t(`merchant.status.${store.status}`)}
                      </span>
                      <span className="px-3 py-1 bg-stone-50 text-stone-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                        {t(`merchant.categories.${store.category.toLowerCase()}`)}
                      </span>
                      <span className="text-[10px] text-stone-300 font-mono">{t('admin.id_label')}: {store.id}</span>
                    </div>
                    
                    <div>
                      <h4 className="text-lg font-bold text-stone-900">{store.name}</h4>
                      <p className="text-stone-500 text-sm leading-relaxed truncate max-w-md">{store.description || t('admin.no_description')}</p>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-1">
                      <div className="flex items-center gap-1.5 text-stone-400 text-xs font-bold">
                        <UserIcon className="w-3.5 h-3.5" />
                        <span>{t('admin.owner_label', { id: store.ownerId.slice(0, 8) })}...</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-stone-400 text-xs font-bold">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{t('admin.local_store')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {store.status === 'pending' && (
                      <>
                        <button
                          disabled={!!processingId}
                          onClick={() => setEditingStore(store)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-stone-600 font-bold hover:bg-stone-50 rounded-2xl transition-all disabled:opacity-50"
                        >
                          <Settings className="w-5 h-5" />
                          <span>{t('admin.edit')}</span>
                        </button>
                        <button
                          disabled={!!processingId}
                          onClick={() => handleReject(store.id)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-rose-600 font-bold hover:bg-rose-50 rounded-2xl transition-all disabled:opacity-50"
                        >
                          <XCircle className="w-5 h-5" />
                          <span>{t('admin.reject')}</span>
                        </button>
                        <button
                          disabled={!!processingId}
                          onClick={() => handleApprove(store)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {processingId === store.id ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Check className="w-5 h-5" />
                          )}
                          <span>{t('admin.approve')}</span>
                        </button>
                      </>
                    )}
                    
                    {store.status !== 'pending' && (
                      <>
                        <button
                          disabled={!!processingId}
                          onClick={() => setEditingStore(store)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-stone-50 text-stone-600 font-bold hover:bg-stone-100 rounded-2xl transition-all disabled:opacity-50"
                        >
                          <Settings className="w-5 h-5" />
                          <span>{t('admin.edit')}</span>
                        </button>
                        <button
                          disabled={!!processingId}
                          onClick={() => handleDelete(store.id)}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-rose-600 font-bold hover:bg-rose-50 rounded-2xl transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-5 h-5" />
                          <span>{t('admin.delete')}</span>
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="p-6 bg-stone-50 border-t border-stone-100 flex items-center gap-3 px-8 shrink-0">
          <AlertCircle className="w-4 h-4 text-stone-400" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
            {t('admin.footer_info')}
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {editingStore && (
          <MerchantRegistrationModal 
            userId={editingStore.ownerId}
            initialStore={editingStore}
            onClose={() => setEditingStore(null)}
            onSuccess={() => {}}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
