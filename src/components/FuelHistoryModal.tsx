import React from 'react';
import { motion } from 'motion/react';
import { Fuel, X, Clock, History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface FuelHistoryModalProps {
  batches: any[];
  onClose: () => void;
}

export function FuelHistoryModal({ batches, onClose }: FuelHistoryModalProps) {
  const { t } = useTranslation();
  const now = Date.now();
  const sortedBatches = [...batches].sort((a, b) => b.createdAt - a.createdAt);

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
        className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-lg space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
              <Fuel className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 uppercase tracking-tight text-left">{t('fuel.history_title')}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {sortedBatches.length > 0 ? (
            <div className="grid gap-3 text-left">
              {sortedBatches.map((batch) => {
                const isExpired = batch.expiresAt <= now;
                return (
                  <div
                    key={batch.id}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all flex items-center justify-between text-left",
                      isExpired
                        ? "bg-stone-50 border-stone-100 opacity-60"
                        : "bg-white border-emerald-100 shadow-sm"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        isExpired ? "bg-stone-200" : "bg-emerald-100"
                      )}>
                        {isExpired ? <Clock className="w-5 h-5 text-stone-400" /> : <Fuel className="w-5 h-5 text-emerald-600" />}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-stone-900">
                          {batch.remaining} / {batch.amount}
                          <span className="ml-2 py-0.5 px-2 bg-stone-100 rounded-md text-[9px] uppercase tracking-tighter text-stone-500">
                            {batch.type}
                          </span>
                        </p>
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-0.5">
                          {isExpired ? t('fuel.expired') : t('fuel.expires')}: {new Date(batch.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
                <History className="w-8 h-8 text-stone-300" />
              </div>
              <p className="text-stone-500 font-medium">{t('fuel.no_fuel_history')}</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
