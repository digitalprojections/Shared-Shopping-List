import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, Store as StoreIcon, Send, CheckCircle2 } from 'lucide-react';
import { storeService } from '../services/storeService';
import { useTranslation } from 'react-i18next';
import { Store } from '../types';

interface MerchantRegistrationModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
  initialStore?: Store;
}

const CATEGORIES = ['Grocery', 'Halaal', 'Organic', 'Electronics', 'Home', 'Pets', 'Pharma', 'Fashion', 'Beauty', 'Sports'];

export const MerchantRegistrationModal: React.FC<MerchantRegistrationModalProps> = ({ 
  userId, 
  onClose, 
  onSuccess,
  initialStore 
}) => {
  const { t } = useTranslation();
  const isEditing = !!initialStore;
  
  const [name, setName] = useState(initialStore?.name || '');
  const [address, setAddress] = useState(initialStore?.location?.address || '');
  const [category, setCategory] = useState(initialStore?.category || 'Grocery');
  const [description, setDescription] = useState(initialStore?.description || '');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setStatus('submitting');
    setError(null);

    const storeData = {
      name: name.trim(),
      location: {
        lat: initialStore?.location?.lat || 0,
        lng: initialStore?.location?.lng || 0,
        address: address.trim()
      },
      category,
      description: description.trim()
    };

    try {
      console.log(isEditing ? "[MerchantRegistration] Updating store:" : "[MerchantRegistration] Submitting application for user:", userId);
      
      if (isEditing && initialStore) {
        await storeService.updateStore(initialStore.id, storeData);
      } else {
        await storeService.applyForMerchant(userId, storeData);
      }

      console.log("[MerchantRegistration] Success!");
      setStatus('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("[MerchantRegistration] Operation Failed:", err);
      setStatus('idle');
      setError(err?.message || (isEditing ? t('merchant.error_updating', 'Failed to update store. Please try again.') : t('merchant.error_submitting', 'Failed to submit application. Please try again.')));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <StoreIcon className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-stone-900">
                {isEditing ? t('merchant.edit_title', 'Edit Store Details') : t('merchant.register_title', 'Register as Store')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-stone-400" />
            </button>
          </div>

          {status === 'success' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-12 text-center space-y-4"
            >
              <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-xl font-bold text-stone-900">
                {isEditing ? t('merchant.update_success_title', 'Store Updated!') : t('merchant.success_title', 'Application Sent!')}
              </h3>
              <p className="text-stone-500">
                {isEditing ? t('merchant.update_success_desc', 'Your changes have been saved successfully.') : t('merchant.success_desc', 'An admin will review your store shortly.')}
              </p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3"
                >
                  <div className="w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-sm font-medium text-rose-600">{error}</p>
                </motion.div>
              )}

              <p className="text-stone-500 text-sm leading-relaxed">
                {isEditing ? t('merchant.edit_desc', 'Update your store information to keep your customers informed.') : t('merchant.apply_desc', 'Join our ecosystem! Once approved, your store will be visible to all users nearby.')}
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
                    {t('merchant.store_name', 'Store Name')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full px-5 py-4 bg-stone-50 border-2 rounded-2xl outline-none transition-all font-medium ${
                      shake && !name.trim() ? 'border-rose-300 animate-shake' : 'border-transparent focus:border-emerald-500 focus:bg-white'
                    }`}
                    placeholder={t('merchant.store_name_placeholder', 'e.g. Sunny Supermarket')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
                    {t('merchant.store_address', 'Store Address')}
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={`w-full px-5 py-4 bg-stone-50 border-2 rounded-2xl outline-none transition-all font-medium ${
                      shake && !address.trim() ? 'border-rose-300 animate-shake' : 'border-transparent focus:border-emerald-500 focus:bg-white'
                    }`}
                    placeholder={t('merchant.store_address_placeholder', 'Street, City, Country')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
                    {t('merchant.category', 'Category')}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-5 py-4 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-medium appearance-none"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
                    {t('merchant.description', 'Description (Optional)')}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-5 py-4 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-medium resize-none h-24"
                    placeholder="Tell users what you sell..."
                  />
                </div>
              </div>

              <motion.button
                animate={shake ? { x: [-5, 5, -5, 5, 0] } : {}}
                transition={{ duration: 0.4 }}
                type="submit"
                disabled={status === 'submitting'}
                className="w-full group flex items-center justify-center gap-3 px-8 py-5 bg-emerald-600 text-white font-black rounded-3xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                {status === 'submitting' ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                )}
                <span>{isEditing ? t('merchant.save_changes', 'Save Changes') : t('merchant.apply_button', 'Submit Application')}</span>
              </motion.button>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
