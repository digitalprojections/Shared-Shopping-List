import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

const EMOJI_CATEGORIES = [
  { 
    name: 'Food', 
    emojis: ['🛒', '🍎', '🥦', '🥩', '🍞', '🥛', '🥚', '🧀', '🧁', '🍕', '🍇', '🍌', '🥕', '🍗', '🍜', '🍩', '🍪', '🍨'] 
  },
  { 
    name: 'Home', 
    emojis: ['🏠', '🧼', '🧻', '🛠️', '🪴', '🧹', '🧺', '🔦', '🔋', '🔌', '📦', '🔑', '🪑', '🛌', '🛋️'] 
  },
  { 
    name: 'Health', 
    emojis: ['💊', '🩹', '🧴', '🦷', '🕶️', '🏃', '🧘', '💧', '🩹', '🌡️', '🧼'] 
  },
  { 
    name: 'Fun', 
    emojis: ['🎁', '🎈', '🎉', '🎨', '🎮', '⚽', '🎸', '📷', '🎬', '🍿', '🥤', '🍺', '🍷'] 
  },
  { 
    name: 'Pets', 
    emojis: ['🐶', '🐱', '🐹', '🐰', '🐦', '🐟', '🦴', '🐾'] 
  }
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  currentEmoji?: string;
}

export function EmojiPicker({ onSelect, onClose, currentEmoji }: EmojiPickerProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
    >
      <motion.div
        ref={modalRef}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 flex-shrink-0">
          <h3 className="text-xl font-bold text-stone-900">{t('emoji_picker.title')}</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scroll-container space-y-6">
          {EMOJI_CATEGORIES.map((category) => (
            <div key={category.name} className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-1">
                {t(`emoji_picker.categories.${category.name}`)}
              </h4>
              <div className="grid grid-cols-5 gap-2">
                {category.emojis.map((emoji) => (
                  <motion.button
                    key={emoji}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => {
                      onSelect(emoji);
                      onClose();
                    }}
                    className={cn(
                      "aspect-square text-2xl flex items-center justify-center rounded-2xl transition-all",
                      currentEmoji === emoji 
                        ? "bg-emerald-100 ring-2 ring-emerald-500" 
                        : "bg-stone-50 hover:bg-white hover:shadow-md border border-transparent hover:border-stone-100"
                    )}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
