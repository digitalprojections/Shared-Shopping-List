import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, ChevronRight, Store, Plus } from 'lucide-react';
import { loyaltyService } from '../services/loyaltyService';
import { LoyaltyCard } from '../types';
import { cn } from '../lib/utils';
import { IconComponent } from './LoyaltyCardsModal';

interface LoyaltyCardsRowProps {
  userId: string;
  onCardClick: (card: LoyaltyCard) => void;
  onAddClick: () => void;
}

export const LoyaltyCardsRow: React.FC<LoyaltyCardsRowProps> = ({ userId, onCardClick, onAddClick }) => {
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return loyaltyService.subscribeToCards(userId, (data) => {
      setCards(data);
      setLoading(false);
    });
  }, [userId]);

  if (loading && cards.length === 0) return null;

  return (
    <div className="w-full bg-white/40 backdrop-blur-md border-b border-stone-200/60 overflow-hidden">
      <div className="max-w-5xl mx-auto px-4 py-3 md:px-8">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-1">
          {/* Add Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onAddClick}
            className="flex-shrink-0 w-12 h-12 rounded-2xl border-2 border-dashed border-stone-200 flex items-center justify-center text-stone-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors bg-white/50"
          >
            <Plus className="w-6 h-6" />
          </motion.button>

          <AnimatePresence mode="popLayout">
            {cards.map((card) => (
              <motion.button
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key={card.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => onCardClick(card)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-2xl text-white flex items-center gap-3 shadow-sm min-w-[140px] relative overflow-hidden",
                  card.color
                )}
              >
                <IconComponent iconId={card.icon} className="w-4 h-4 opacity-70" />
                <div className="text-left">
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-80 leading-none mb-0.5">
                    {card.provider}
                  </p>
                  <p className="text-sm font-black truncate max-w-[100px] leading-tight">
                    {card.name}
                  </p>
                </div>
                <div className="absolute top-0 right-0 w-8 h-8 bg-white/10 rounded-full -mr-3 -mt-3" />
              </motion.button>
            ))}
          </AnimatePresence>

          {cards.length === 0 && !loading && (
            <div className="flex items-center gap-2 text-stone-400 py-2">
              <CreditCard className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">No cards saved</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
