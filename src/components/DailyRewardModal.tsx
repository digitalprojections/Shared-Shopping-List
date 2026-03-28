import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Fuel, Sparkles, Zap, Gift, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { userService } from '../services/userService';
import { cn } from '../lib/utils';

interface DailyRewardModalProps {
  onClose: () => void;
  onClaimed: (amount: number) => void;
}

export const DailyRewardModal: React.FC<DailyRewardModalProps> = ({ onClose, onClaimed }) => {
  const { t } = useTranslation();
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // sound generation logic
  const playRewardSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playTone = (freq: number, startTime: number, duration: number, volume: number) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      // Arpeggio for a rewarding feel
      const now = audioCtx.currentTime;
      playTone(523.25, now, 0.5, 0.1); // C5
      playTone(659.25, now + 0.1, 0.5, 0.1); // E5
      playTone(783.99, now + 0.2, 0.5, 0.1); // G5
      playTone(1046.50, now + 0.3, 0.8, 0.15); // C6 (Bright finish)
    } catch (e) {
      console.warn("Audio context not supported or blocked", e);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
      playRewardSound();
    }, 500);
    return () => clearTimeout(timer);
  }, [playRewardSound]);

  const handleClaim = async () => {
    if (isClaiming || claimed) return;
    setIsClaiming(true);
    
    try {
      const result = await userService.claimDailyFuelReward();
      if (result.success) {
        setClaimed(true);
        playRewardSound();
        setTimeout(() => {
          onClaimed(result.amount || 1);
          onClose();
        }, 2000);
      } else if (result.alreadyClaimed) {
        onClose();
      }
    } catch (error) {
      console.error("Daily reward claim failed:", error);
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-stone-900/40 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="w-full max-w-sm bg-white rounded-[3rem] shadow-2xl shadow-emerald-500/20 overflow-hidden relative"
      >
        {/* Decorative Background Elements */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-emerald-50 to-transparent pointer-events-none" />

        <div className="relative p-10 flex flex-col items-center text-center">
          {/* Icon Container */}
          <div className="relative mb-8">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-emerald-200 relative z-10"
            >
              <Fuel className="w-12 h-12 text-white" />
            </motion.div>
            
            {/* Sparkles */}
            <motion.div
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
              className="absolute -top-2 -right-2 text-amber-400"
            >
              <Sparkles className="w-8 h-8 fill-current" />
            </motion.div>
            <motion.div
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2, delay: 1.2 }}
              className="absolute bottom-0 -left-4 text-emerald-400"
            >
              <Zap className="w-6 h-6 fill-current" />
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            {!claimed ? (
              <motion.div
                key="initial"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-3xl font-black text-stone-900 tracking-tight mb-2">
                    {t('reward.daily_prize_title')}
                  </h2>
                  <p className="text-stone-500 font-medium px-4">
                    {t('reward.daily_prize_desc')}
                  </p>
                </div>

                <div className="py-6">
                  <div className="inline-flex flex-col items-center justify-center">
                    <div className="text-5xl font-black text-emerald-600 tracking-tighter tabular-nums flex items-baseline gap-1">
                      +1
                      <span className="text-lg text-emerald-400 opacity-60 uppercase tracking-widest">%</span>
                    </div>
                    <span className="text-[10px] font-black text-stone-300 uppercase tracking-[0.3em] mt-1">
                      {t('reward.fuel_reward')}
                    </span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClaim}
                  disabled={isClaiming}
                  className={cn(
                    "w-full py-5 rounded-3xl font-black text-lg shadow-xl transition-all relative overflow-hidden group",
                    "bg-emerald-500 text-white shadow-emerald-200 hover:shadow-emerald-300",
                    isClaiming && "opacity-80 cursor-not-allowed"
                  )}
                >
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    {isClaiming ? (
                      <motion.div 
                        animate={{ rotate: 360 }} 
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      >
                        <Zap className="w-6 h-6" />
                      </motion.div>
                    ) : (
                      <>
                        {t('reward.claim_now')}
                        <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </div>
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="claimed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-10"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.2, 1] }}
                  className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <Gift className="w-10 h-10 text-emerald-600" />
                </motion.div>
                <h3 className="text-2xl font-black text-stone-900 mb-2">
                  {t('reward.claimed_title')}
                </h3>
                <p className="text-emerald-600 font-bold">
                  {t('reward.claimed_desc')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer info */}
        <div className="p-8 pt-0 text-center">
          <button 
            onClick={onClose}
            className="text-stone-300 hover:text-stone-400 text-xs font-black uppercase tracking-[0.25em] transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
