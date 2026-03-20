import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ShoppingBag, Store as StoreIcon, Send, CheckCircle2, LocateFixed, Clock, Trash2 } from 'lucide-react';
import { storeService } from '../services/storeService';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { STORE_CATEGORIES } from '../constants/categories';

import { Store, DAYS_OF_WEEK, DayKey, DailySchedule } from '../types';

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
  const [openingDate, setOpeningDate] = useState(initialStore?.createdAt ? new Date(initialStore.createdAt).toISOString().split('T')[0] : '');
  const [contactPhone, setContactPhone] = useState(initialStore?.contactPhone || '');
  const [website, setWebsite] = useState(initialStore?.website || '');
  const [themeColor, setThemeColor] = useState(initialStore?.themeColor || 'Emerald');
  const [mapLink, setMapLink] = useState('');
  const [lat, setLat] = useState<number>(initialStore?.location?.lat || 0);
  const [lng, setLng] = useState<number>(initialStore?.location?.lng || 0);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | 'unknown'>('unknown');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  // Structured Working Hours
  const [schedules, setSchedules] = useState<Record<DayKey, DailySchedule>>(() => {
    const defaultSchedule = DAYS_OF_WEEK.reduce((acc, day) => ({
      ...acc,
      [day]: { isOpen: true, open: '08:00', close: '20:00' }
    }), {} as Record<DayKey, DailySchedule>);

    if (!initialStore?.workingHours) return defaultSchedule;

    try {
      // Try to parse if it was saved as JSON in some version, 
      // otherwise we just return default to start fresh with the new standard
      if (initialStore.workingHours.startsWith('{')) {
        return JSON.parse(initialStore.workingHours);
      }
    } catch (e) {
      console.warn("Failed to parse working hours JSON:", e);
    }
    return defaultSchedule;
  });

  const handleDayChange = (day: DayKey, updates: Partial<DailySchedule>) => {
    setSchedules(prev => ({
      ...prev,
      [day]: { ...prev[day], ...updates }
    }));
  };

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError(t('merchant.location_error', 'Geolocation is not supported by your browser'));
      return;
    }

    setIsDetectingLocation(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLat(latitude);
        setLng(longitude);
        console.log("[MerchantRegistration] Detected coordinates:", latitude, longitude);

        // Try reverse geocoding to auto-fill address
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          if (data && data.display_name && !address) {
             setAddress(data.display_name);
             console.log("[MerchantRegistration] Reverse geocoded address:", data.display_name);
          }
        } catch (e) {
          console.warn("[MerchantRegistration] Reverse geocoding failed (optional step):", e);
        }

        setIsDetectingLocation(false);
      },
      (err) => {
        console.error("[MerchantRegistration] Geolocation error code:", err.code, "message:", err.message);
        let errorMsg = t('merchant.location_error', 'Failed to detect location.');
        if (err.code === 1) errorMsg = t('merchant.location_denied', 'Permission denied. Please enable location access in your browser settings.');
        if (err.code === 3) errorMsg = t('merchant.location_timeout', 'Location request timed out. Please try again.');
        
        setError(errorMsg);
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Parse Google Maps link
  const parseMapLink = (link: string) => {
    setMapLink(link);
    if (!link) return;

    try {
      // Improved regex to find coordinates in various Google Maps URL formats
      const patterns = [
        /@(-?\d+\.\d+),(-?\d+\.\d+)/,                           // Standard @lat,lng
        /place\/.*?\/@(-?\d+\.\d+),(-?\d+\.\d+)/,              // Place URL
        /q=(-?\d+\.\d+),(-?\d+\.\d+)/,                         // Query param q=lat,lng
        /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,                        // Link param ll=lat,lng
        /cbll=(-?\d+\.\d+),(-?\d+\.\d+)/,                      // Streetview cbll=lat,lng
        /search\/(-?\d+\.\d+),(-?\d+\.\d+)/,                   // Search path
        /\?q=[-+\d.]*,([-+\d.]*)/,                             // Query with name and lat,lng
      ];

      for (const pattern of patterns) {
        const match = link.match(pattern);
        if (match) {
          const foundLat = parseFloat(match[1]);
          const foundLng = parseFloat(match[2]);
          if (!isNaN(foundLat) && !isNaN(foundLng)) {
            setLat(foundLat);
            setLng(foundLng);
            console.log("[MerchantRegistration] Parsed coordinates:", foundLat, foundLng);
            return;
          }
        }
      }
    } catch (e) {
      console.error("[MerchantRegistration] Failed to parse map link:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[MerchantRegistration] Submit attempt:", { name, address, lat, lng });

    // Name is always required. 
    // Address is strictly required unless we have coordinates, in which case we provide a fallback.
    if (!name.trim()) {
      setError(t('merchant.name_required', 'Store name is required'));
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    if (!address.trim() && !lat) {
      setError(t('merchant.location_required', 'Store address or location coordinates are required'));
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setStatus('submitting');
    setError(null);

    // Serialize working hours to a readable string for displays, 
    // but we could also store it as JSON string if we want strict standardization.
    // For now, let's create a readable summary but keep the JSON structure internally if needed.
    const workingHoursString = JSON.stringify(schedules);

    const storeData = {
      name: name.trim(),
      location: {
        lat,
        lng,
        address: address.trim()
      },
      category,
      description: description.trim(),
      workingHours: workingHoursString,
      contactPhone: contactPhone.trim(),
      website: website.trim(),
      themeColor,
      createdAt: openingDate ? new Date(openingDate).getTime() : Date.now()
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
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 pb-4 shrink-0 border-b border-stone-50">
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
        </div>

        <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
          {status === 'success' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 text-center space-y-4"
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
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto no-scrollbar p-8 pt-6 space-y-6">
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 mb-4"
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
                      {t('merchant.map_link', 'Map Location Link (Google Maps)')}
                    </label>
                    <div className="flex gap-2">
                       <input
                        type="text"
                        value={mapLink}
                        onChange={(e) => parseMapLink(e.target.value)}
                        className="flex-1 px-5 py-4 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                        placeholder="Paste Google Maps link..."
                      />
                      <button
                        type="button"
                        onClick={detectLocation}
                        disabled={isDetectingLocation}
                        className={cn(
                          "px-5 rounded-2xl border-2 transition-all flex items-center justify-center gap-2",
                          isDetectingLocation 
                            ? "bg-stone-50 border-stone-100 text-stone-400" 
                            : "bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100 active:scale-95"
                        )}
                        title={t('merchant.use_my_location')}
                      >
                        {isDetectingLocation ? (
                          <div className="w-5 h-5 border-2 border-stone-200 border-t-stone-400 rounded-full animate-spin" />
                        ) : (
                          <LocateFixed className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <div className="flex gap-2 px-1">
                      <p className="text-[10px] text-stone-400">
                        {t('merchant.map_link_help', 'Paste link or use GPS to set coordinates')}
                      </p>
                      {lat !== 0 && (
                         <p className="text-[10px] text-emerald-500 font-bold ml-auto">
                           ✓ {lat.toFixed(4)}, {lng.toFixed(4)}
                         </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                        {t('merchant.opening_date', 'Opening Date')}
                      </label>
                      <input
                        type="date"
                        value={openingDate}
                        onChange={(e) => setOpeningDate(e.target.value)}
                        className="w-full px-5 py-4 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                      />
                    </div>
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

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1 flex items-center gap-2">
                       <Clock className="w-4 h-4" />
                       {t('merchant.working_hours')}
                    </label>
                    <div className="bg-stone-50 rounded-[2rem] p-4 border border-stone-100 space-y-3">
                      {DAYS_OF_WEEK.map((day) => (
                        <div key={day} className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => handleDayChange(day, { isOpen: !schedules[day].isOpen })}
                            className={cn(
                              "w-24 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center",
                              schedules[day].isOpen ? "bg-emerald-500 text-white shadow-lg shadow-emerald-100" : "bg-white text-stone-300 border border-stone-100"
                            )}
                          >
                            {t(`merchant.weekdays.${day}`).substring(0, 3)}
                          </button>
                          
                          {schedules[day].isOpen ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="time"
                                value={schedules[day].open}
                                onChange={(e) => handleDayChange(day, { open: e.target.value })}
                                className="flex-1 px-3 py-2 bg-white border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-all"
                              />
                              <span className="text-stone-300 font-bold">→</span>
                              <input
                                type="time"
                                value={schedules[day].close}
                                onChange={(e) => handleDayChange(day, { close: e.target.value })}
                                className="flex-1 px-3 py-2 bg-white border border-stone-100 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 transition-all"
                              />
                            </div>
                          ) : (
                            <div className="flex-1 text-center py-2 px-4 bg-stone-100/50 rounded-xl text-[10px] font-bold text-stone-300 uppercase tracking-widest leading-none flex items-center justify-center">
                              {t('merchant.closed')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">
                        {t('merchant.contact_phone')}
                      </label>
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="w-full px-5 py-4 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                        placeholder={t('merchant.contact_phone_placeholder')}
                      />
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
              </div>

              <div className="px-8 py-6 border-t border-stone-50 bg-white shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
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
              </div>
            </form>
          )}
        </div>

      </motion.div>
    </motion.div>
  );
};
