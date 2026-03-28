import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Ticket, X, CheckCircle2, RefreshCw, Clock, Gift } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { couponService } from '../services/couponService';
import { Capacitor } from '@capacitor/core';
import { AppUser } from '../types';

interface RedeemModalProps {
  userId: string;
  onClose: () => void;
  appUser: AppUser | null;
}

function FreeGiftCard({ appUser }: { appUser: AppUser | null }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(appUser?.freeCouponClaimed || false);

  useEffect(() => {
    if (appUser?.freeCouponClaimed) {
      setClaimed(true);
    }
  }, [appUser?.freeCouponClaimed]);

  const handleClaim = async () => {
    if (loading || claimed) return;
    setLoading(true);
    try {
      const result = await couponService.claimFreeFuelGift();
      if (result.success) {
        setClaimed(true);
      } else {
        alert(result.message);
      }
    } catch (error: any) {
      alert(error.message || t('redeem_modal.claim_gift_error'));
    } finally {
      setLoading(false);
    }
  };

  const isNative = Capacitor.isNativePlatform();

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-[2.5rem] text-white shadow-xl shadow-indigo-200/50 space-y-4 relative overflow-hidden group">
      <div className="absolute top-0 right-0 -m-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
      <div className="relative flex items-center gap-4">
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
          <Gift className="w-6 h-6 text-white" />
        </div>
        <div className="text-left">
          <h3 className="font-bold text-lg leading-tight">{t('redeem_modal.free_title')}</h3>
          <p className="text-white/60 text-xs font-medium">{t('redeem_modal.free_desc')}</p>
        </div>
      </div>

      {isNative ? (
        <div className="bg-white/10 p-4 rounded-2xl border border-white/10 text-center">
          <p className="text-sm font-bold text-white/90">
            {t('redeem_modal.mobile_invite')}
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.open('https://created.link', '_blank')}
            className="mt-3 px-4 py-2 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-900/40"
          >
            created.link
          </motion.button>
        </div>
      ) : (
        <button
          onClick={handleClaim}
          disabled={loading || claimed}
          className={cn(
            "w-full py-4 rounded-2xl font-bold transition-all shadow-lg active:scale-95",
            claimed
              ? "bg-emerald-500/20 text-emerald-300 cursor-default border border-emerald-500/30"
              : "bg-white text-indigo-600 hover:bg-stone-50 shadow-indigo-900/20"
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-indigo-600">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>{t('redeem_modal.validating')}</span>
            </div>
          ) : (
            claimed ? t('redeem_modal.free_claimed') : t('redeem_modal.free_claim')
          )}
        </button>
      )}
    </div>
  );
}

export function RedeemModal({ userId, onClose, appUser }: RedeemModalProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const lastAction = appUser?.laa || 0;
  const cooldownMs = 30000; // 30 seconds
  const remaining = Math.max(0, Math.ceil((cooldownMs - (now - lastAction)) / 1000));
  const isThrottled = remaining > 0;

  const handleCodeChange = (val: string) => {
    let cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    cleaned = cleaned.slice(0, 12);
    let formatted = '';
    if (cleaned.length > 0) formatted += cleaned.slice(0, 4);
    if (cleaned.length > 4) formatted += '-' + cleaned.slice(4, 8);
    if (cleaned.length > 8) formatted += '-' + cleaned.slice(8, 12);
    setCode(formatted);
    setMsg(null);
  };

  const isValidPattern = /^SHOP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !isValidPattern) return;
    setLoading(true);
    setMsg(null);
    const res = await couponService.redeemFuelCoupon(userId, code);
    setLoading(false);
    if (res.success) {
      setMsg({ text: res.message, type: 'success' });
      setCode('');
      setTimeout(onClose, 2000);
    } else {
      setMsg({ text: res.message, type: 'error' });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <Ticket className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 uppercase tracking-tight text-left">{t('redeem_modal.title')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <form onSubmit={handleRedeem} className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-bold uppercase tracking-widest text-stone-400">{t('redeem_modal.code_label')}</label>
              {code.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCode('')}
                  className="text-[10px] font-black uppercase tracking-tighter text-stone-300 hover:text-stone-500 transition-colors"
                >
                  {t('common.clear', 'Clear')}
                </button>
              )}
            </div>
            <div className="relative">
              <input
                autoFocus
                type="text"
                placeholder={t('redeem_modal.code_placeholder')}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                className={cn(
                  "w-full px-6 py-5 rounded-2xl border-2 transition-all font-mono text-xl tracking-wider uppercase",
                  isValidPattern
                    ? "border-emerald-200 bg-emerald-50/30 focus:border-emerald-400 focus:bg-white text-emerald-700"
                    : "border-stone-100 bg-stone-50 focus:border-emerald-400 focus:bg-white text-stone-900"
                )}
              />
              <AnimatePresence>
                {isValidPattern && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.5, x: 10 }}
                    className="absolute right-5 top-1/2 -translate-y-1/2"
                  >
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !isValidPattern || isThrottled}
            className={cn(
              "w-full py-5 rounded-2xl font-bold shadow-xl transition-all flex items-center justify-center gap-3",
              isValidPattern
                ? "bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.98]"
                : "bg-stone-100 text-stone-400 shadow-none cursor-not-allowed"
            )}
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : isThrottled ? (
              <>
                <Clock className="w-5 h-5" />
                {t('redeem_modal.wait', { time: remaining })}
              </>
            ) : (
              t('redeem_modal.claim')
            )}
          </button>
        </form>

        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className={cn(
                "p-4 rounded-xl text-sm font-bold text-center",
                msg.type === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"
              )}
            >
              {msg.text}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-stone-400 font-medium pb-2">
          {t('redeem_modal.info')}
        </p>

        {appUser && !appUser.freeCouponClaimed && (
          <div className="pt-4 border-t border-stone-100">
            <FreeGiftCard appUser={appUser} />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
