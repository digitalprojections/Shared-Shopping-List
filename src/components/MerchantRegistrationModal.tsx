import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, Store as StoreIcon, Send, CheckCircle2 } from 'lucide-react';
import { storeService } from '../services/storeService';
import { useTranslation } from 'react-i18next';

interface MerchantRegistrationModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = ['Grocery', 'Halaal', 'Organic', 'Electronics', 'Home', 'Pets', 'Pharma', 'Fashion', 'Beauty', 'Sports'];

export const MerchantRegistrationModal: React.FC<MerchantRegistrationModalProps> = ({ userId, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Grocery');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setStatus('submitting');
    try {
      await storeService.applyForMerchant(userId, {
        name: name.trim(),
        category,
        description: description.trim()
      });
      setStatus('success');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error applying for merchant:", error);
      setStatus('idle');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
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
              <h2 className="text-2xl font-bold text-stone-900">{t('merchant.register_title', 'Register as Store')}</h2>
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
              <h3 className="text-xl font-bold text-stone-900">{t('merchant.success_title', 'Application Sent!')}</h3>
              <p className="text-stone-500">{t('merchant.success_desc', 'An admin will review your store shortly.')}</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="text-stone-500 text-sm leading-relaxed">
                {t('merchant.apply_desc', 'Join our ecosystem! Once approved, your store will be visible to all users nearby.')}
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
                    {t('merchant.store_name', 'Store Name')}
                  </label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-5 py-4 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                    placeholder="e.g. Sunny Supermarket"
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

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {status === 'submitting' ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                <span>{t('merchant.apply_button', 'Submit Application')}</span>
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
