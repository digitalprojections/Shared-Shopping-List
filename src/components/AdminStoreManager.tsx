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
  AlertCircle
} from 'lucide-react';
import { Store } from '../types';
import { storeService } from '../services/storeService';
import { useTranslation } from 'react-i18next';

interface AdminStoreManagerProps {
  onClose: () => void;
}

export const AdminStoreManager: React.FC<AdminStoreManagerProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [pendingStores, setPendingStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = storeService.subscribeToPendingStores((stores) => {
      setPendingStores(stores);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
              <StoreIcon className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                {t('admin.manage_submissions', 'Manage Submissions')}
              </h2>
              <p className="text-stone-400 text-sm font-medium">Review and verify new store requests</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-stone-100 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Loading Applications...</p>
            </div>
          ) : pendingStores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-stone-50 rounded-[2rem] border-2 border-dashed border-stone-100">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-stone-900">All caught up!</h3>
                <p className="text-stone-400 text-sm">No pending store applications at the moment.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingStores.map(store => (
                <motion.div
                  key={store.id}
                  layout
                  className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded-full">
                        {store.category}
                      </span>
                      <span className="text-[10px] text-stone-300 font-mono">ID: {store.id}</span>
                    </div>
                    
                    <div>
                      <h4 className="text-lg font-bold text-stone-900">{store.name}</h4>
                      <p className="text-stone-500 text-sm leading-relaxed">{store.description || 'No description provided.'}</p>
                    </div>

                    <div className="flex flex-wrap gap-4 pt-1">
                      <div className="flex items-center gap-1.5 text-stone-400 text-xs font-bold">
                        <UserIcon className="w-3.5 h-3.5" />
                        <span>Owner: {store.ownerId.slice(0, 8)}...</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-stone-400 text-xs font-bold">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Local Store</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      disabled={!!processingId}
                      onClick={() => handleReject(store.id)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 text-rose-600 font-bold hover:bg-rose-50 rounded-2xl transition-all disabled:opacity-50"
                    >
                      <XCircle className="w-5 h-5" />
                      <span>Reject</span>
                    </button>
                    <button
                      disabled={!!processingId}
                      onClick={() => handleApprove(store)}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {processingId === store.id ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Check className="w-5 h-5" />
                      )}
                      <span>Approve Store</span>
                    </button>
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
            Approving a store will grant the user Merchant status and notify them.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
