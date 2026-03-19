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
  Package
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

  useEffect(() => {
    const unsubscribe = storeService.subscribeToMyStores(userId, (data) => {
      setStores(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  const handleDelete = async (storeId: string) => {
    if (!window.confirm("Are you sure you want to delete this store? This will also remove its application.")) return;
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
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md"
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
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <StoreIcon className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                {t('merchant.dashboard', 'My Stores')}
              </h2>
              <p className="text-stone-400 text-sm font-medium">Manage your registered stores and applications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
               onClick={() => setShowAddModal(true)}
               className="hidden sm:flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100"
            >
              <Plus className="w-5 h-5" />
              <span>Apply for New Store</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-stone-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-stone-100 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-stone-400 font-bold uppercase tracking-widest text-xs tracking-widest">Loading Your Stores...</p>
            </div>
          ) : stores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 bg-stone-50 rounded-[2rem] border-2 border-dashed border-stone-100 px-6">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm">
                <StoreIcon className="w-10 h-10 text-stone-200" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-stone-900">No stores yet</h3>
                <p className="text-stone-500 max-w-xs mx-auto">You haven't registered any stores. Start your business today!</p>
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-8 py-4 bg-stone-900 text-white font-bold rounded-2xl hover:bg-stone-800 transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" />
                <span>Register Your First Store</span>
              </button>
            </div>
          ) : (
            <div className="grid gap-6">
              {stores.map(store => (
                <motion.div
                  key={store.id}
                  layout
                  className="bg-white p-6 rounded-[2rem] border border-stone-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-4 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className={cn(
                        "px-3 py-1 rounded-full flex items-center gap-1.5",
                        store.status === 'active' ? "bg-emerald-50 text-emerald-600" :
                        store.status === 'pending' ? "bg-amber-50 text-amber-600" :
                        "bg-rose-50 text-rose-600"
                      )}>
                        {store.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : 
                         store.status === 'pending' ? <Clock className="w-3 h-3" /> : 
                         <XCircle className="w-3 h-3" />}
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                          {store.status === 'active' ? 'Verified' : store.status}
                        </span>
                      </div>
                      <span className="px-3 py-1 bg-stone-100 text-stone-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                        {store.category}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="text-xl font-bold text-stone-900">{store.name}</h4>
                      <p className="text-stone-500 text-sm mt-1 leading-relaxed line-clamp-2">{store.description}</p>
                    </div>

                    <div className="flex items-center gap-4 text-stone-400 text-xs font-bold">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Storefront ID: {store.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditingStore(store)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-stone-50 text-stone-600 font-bold hover:bg-stone-100 rounded-2xl transition-all"
                    >
                      <Settings className="w-5 h-5" />
                      <span>{store.status === 'active' ? 'Settings' : 'Edit Application'}</span>
                    </button>
                    
                    {store.status === 'active' && (
                      <button
                        onClick={() => setManagingInventoryStore(store)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-2xl transition-all shadow-lg shadow-indigo-100"
                      >
                        <Package className="w-5 h-5" />
                        <span>Inventory</span>
                      </button>
                    )}
                    
                    <button
                      disabled={!!processingId}
                      onClick={() => handleDelete(store.id)}
                      className="p-3 text-rose-600 hover:bg-rose-50 rounded-2xl transition-all disabled:opacity-50"
                      title="Remove Store"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
              
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-stone-100 rounded-3xl text-stone-400 font-bold hover:border-emerald-200 hover:text-emerald-600 transition-all hover:bg-emerald-50 group"
              >
                <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <span>Add Another Store Location</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-stone-50 border-t border-stone-100 flex items-center gap-3 px-8 shrink-0">
          <AlertCircle className="w-4 h-4 text-stone-400" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
            Pending stores are under review. Once verified, you'll be able to manage inventory and products.
          </p>
        </div>
      </motion.div>

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
