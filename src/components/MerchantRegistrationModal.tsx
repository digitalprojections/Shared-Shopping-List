import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, Store as StoreIcon, Send, CheckCircle2 } from 'lucide-react';
import { storeService } from '../services/storeService';
import { useTranslation } from 'react-i18next';
import { Store } from '../types';
import { cn } from '../lib/utils';
import { STORE_CATEGORIES } from '../constants/categories';

interface MerchantRegistrationModalProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
  initialStore?: Store;
}

export const MerchantRegistrationModal: React.FC<MerchantRegistrationModalProps> = ({ 
  userId, 
  onClose, 
  onSuccess,
  initialStore 
}) => {
  const { t } = useTranslation();
  const isEditing = !!initialStore;
  
  const categoryOptions = STORE_CATEGORIES.map(cat => ({
    key: cat.key,
    label: t(`merchant.categories.${cat.key}`),
    value: cat.value
  }));

  const themeOptions = [
    { key: 'emerald', label: t('merchant.themes.emerald'), value: 'Emerald' },
    { key: 'indigo', label: t('merchant.themes.indigo'), value: 'Indigo' },
    { key: 'rose', label: t('merchant.themes.rose'), value: 'Rose' },
    { key: 'amber', label: t('merchant.themes.amber'), value: 'Amber' },
    { key: 'stone', label: t('merchant.themes.stone'), value: 'Stone' }
  ];

  const [name, setName] = useState(initialStore?.name || '');
  const [address, setAddress] = useState(initialStore?.location?.address || '');
  const [category, setCategory] = useState(initialStore?.category || 'Grocery');
  const [description, setDescription] = useState(initialStore?.description || '');
  const [workingHours, setWorkingHours] = useState(initialStore?.workingHours || t('merchant.working_hours_placeholder'));
  const [contactPhone, setContactPhone] = useState(initialStore?.contactPhone || '');
  const [website, setWebsite] = useState(initialStore?.website || '');
  const [themeColor, setThemeColor] = useState(initialStore?.themeColor || 'Emerald');
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
      description: description.trim(),
      workingHours: workingHours.trim(),
      contactPhone: contactPhone.trim(),
      website: website.trim(),
      themeColor
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
                {isEditing ? t('merchant.edit_title') : t('merchant.register_title')}
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
                {isEditing ? t('merchant.update_success_title') : t('merchant.success_title')}
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
                    {categoryOptions.map(c => (
                      <option key={c.key} value={c.value}>{c.label}</option>
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
                    placeholder={t('merchant.desc_placeholder')}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
                      {t('merchant.working_hours')}
                    </label>
                    <input
                      type="text"
                      value={workingHours}
                      onChange={(e) => setWorkingHours(e.target.value)}
                      className="w-full px-5 py-4 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                      placeholder={t('merchant.working_hours_placeholder')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
                      {t('merchant.contact_phone')}
                    </label>
                    <input
                      type="text"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full px-5 py-4 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                      placeholder={t('merchant.contact_phone_placeholder')}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
                    {t('merchant.website_label')}
                  </label>
                  <input
                    type="text"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="w-full px-5 py-4 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                    placeholder={t('merchant.website_placeholder')}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
                    {t('merchant.store_theme')}
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {themeOptions.map(theme => (
                        <button
                          key={theme.key}
                          type="button"
                          onClick={() => setThemeColor(theme.value)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-all border-2",
                            themeColor === theme.value 
                              ? "bg-stone-900 text-white border-stone-900 shadow-lg shadow-stone-200" 
                              : "bg-white text-stone-500 border-stone-100 hover:border-stone-200"
                          )}
                        >
                          {theme.label}
                        </button>
                      ))}
                    </div>
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
