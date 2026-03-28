import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface InstallAppBannerProps {
  onInstall: () => void;
  onClose: () => void;
}

export function InstallAppBanner({ onInstall, onClose }: InstallAppBannerProps) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-emerald-600 p-4 sm:p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-600/20 mb-8 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-colors" />
      <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div className="text-center sm:text-left">
            <h3 className="font-bold text-lg">{t('install_banner.title')}</h3>
            <p className="text-emerald-50 text-sm opacity-90">
              {t('install_banner.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={onInstall}
            className="flex-1 sm:flex-none px-6 py-3 bg-white text-emerald-600 font-bold rounded-xl shadow-lg hover:bg-emerald-50 transition-all active:scale-95"
          >
            {t('install_banner.button')}
          </button>
          <button
            onClick={onClose}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            title="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
