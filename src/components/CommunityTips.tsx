import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Lightbulb, Share2, X } from 'lucide-react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

interface CommunityTipsProps {
  onClose?: () => void;
}

export const CommunityTips: React.FC<CommunityTipsProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const tips = [
    t('tips.tip_stores'),
    t('tips.tip_orders'),
    t('tips.tip_merchants'),
    t('tips.tip_community'),
    t('tips.appeal')
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 8000); // Cycle every 8 seconds
    return () => clearInterval(timer);
  }, [tips.length]);

  const handleShare = async () => {
    try {
      await Share.share({
        title: 'Shared-Shopping-List',
        text: t('tips.appeal'),
        url: 'https://shoppinglist.created.link/listshare', // Replace with actual app link if available
        dialogTitle: t('tips.spread_word'),
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-2xl shadow-indigo-100/20 group"
    >
      {/* Decorative background gradient */}
      <div className="absolute top-0 right-0 -mr-12 -mt-12 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
      <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />

      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-indigo-500" />
        </div>

        <div className="flex-1 min-h-[64px]">
          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">
            {t('tips.did_you_know')}
          </h4>

          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentTipIndex}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-stone-600 font-medium text-sm leading-relaxed pr-8"
              >
                {tips[currentTipIndex]}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-stone-100/50 flex items-center justify-between">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-200 active:scale-95 transition-all hover:bg-indigo-700"
        >
          <Share2 className="w-3.5 h-3.5" />
          {t('tips.share_button')}
        </button>

        {onClose && (
          <button
            onClick={onClose}
            className="text-stone-300 hover:text-stone-400 transition-colors"
          >
            <span className="text-[10px] font-black uppercase tracking-widest">dismiss</span>
          </button>
        )}
      </div>
    </motion.div>
  );
};
