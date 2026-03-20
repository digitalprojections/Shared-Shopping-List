import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Coins, 
  Layout, 
  ShoppingBag, 
  ArrowRight, 
  CheckCircle2,
  Sparkles,
  Ticket
} from 'lucide-react';

interface OnboardingProps {
  userId: string;
  onFinish: () => void;
  initialSlide?: number;
  currentPreferences?: string[];
}

import { userService } from '../services/userService';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

import { STORE_CATEGORIES } from '../constants/categories';


const MIN_REQUIRED_INTERESTS = 3;

const slides = [
  {
    title: "onboarding.slides.collab_title",
    description: "onboarding.slides.collab_desc",
    icon: <Users className="w-16 h-16 text-emerald-500" />,
    color: "from-emerald-50 to-teal-50",
    accent: "bg-emerald-500"
  },
  {
    title: "onboarding.slides.control_title",
    description: "onboarding.slides.control_desc",
    icon: <Coins className="w-16 h-16 text-sky-500" />,
    color: "from-sky-50 to-indigo-50",
    accent: "bg-sky-500"
  },
  {
    title: "onboarding.slides.design_title",
    description: "onboarding.slides.design_desc",
    icon: <Layout className="w-16 h-16 text-amber-500" />,
    color: "from-amber-50 to-orange-50",
    accent: "bg-amber-500"
  },
  {
    title: "onboarding.slides.smart_title",
    description: "onboarding.slides.smart_desc",
    icon: <Sparkles className="w-16 h-16 text-fuchsia-500" />,
    color: "from-fuchsia-50 to-pink-50",
    accent: "bg-fuchsia-500"
  },
  {
    title: "onboarding.slides.loyalty_title",
    description: "onboarding.slides.loyalty_desc",
    icon: <Ticket className="w-16 h-16 text-rose-500" />,
    color: "from-rose-50 to-orange-50",
    accent: "bg-rose-500"
  },
  {
    title: "onboarding.slides.interests_title",
    description: "onboarding.slides.interests_desc",
    icon: <Sparkles className="w-16 h-16 text-amber-500" />,
    color: "from-amber-50 to-orange-50",
    accent: "bg-amber-500",
    isSelection: true
  }
];

export const Onboarding: React.FC<OnboardingProps> = ({ userId, onFinish, initialSlide = 0, currentPreferences = [] }) => {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(initialSlide);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(currentPreferences);

  const isSelectionSlide = (slides[currentSlide] as any).isSelection;
  const isLastSlide = currentSlide === slides.length - 1;
  const canProceed = !isSelectionSlide || selectedInterests.length >= MIN_REQUIRED_INTERESTS;

  const next = async () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(s => s + 1);
    } else {
      if (selectedInterests.length < MIN_REQUIRED_INTERESTS) return;
      await userService.updatePreferences(userId, selectedInterests);
      onFinish();
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest) 
        : [...prev, interest]
    );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-between overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-b ${slides[currentSlide].color} transition-colors duration-700 opacity-50`} />
      
      {/* Top Section - Skip */}
      <div className="w-full p-6 flex justify-end relative z-10 min-h-[5rem]">
        {!isSelectionSlide && (
          <button 
            onClick={onFinish}
            className="text-gray-500 font-medium text-sm hover:text-gray-800 transition-colors"
          >
            {t('onboarding.skip')}
          </button>
        )}
      </div>

      {/* Slide Content */}
      <div className="flex-1 w-full max-w-lg flex items-center justify-center p-8 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="flex flex-col items-center text-center space-y-8"
          >
            <div className={`p-8 rounded-3xl bg-white shadow-xl shadow-black/5 ring-1 ring-black/5 mb-4`}>
              {slides[currentSlide].icon}
            </div>
            
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                {t(slides[currentSlide].title)}
              </h2>
              { isSelectionSlide ? (
                <div className="grid grid-cols-2 gap-2 pt-4 px-2">
                  {STORE_CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => toggleInterest(cat.key)}
                      className={cn(
                        "px-4 py-3 rounded-xl text-sm font-bold transition-all border-2",
                        selectedInterests.includes(cat.key)
                          ? "bg-amber-500 border-amber-500 text-white shadow-md scale-105"
                          : "bg-white border-stone-100 text-stone-600 hover:border-amber-200"
                      )}
                    >
                      {t(`merchant.categories.${cat.key}`)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-lg text-gray-600 leading-relaxed px-4">
                  {t(slides[currentSlide].description)}
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Section - Navigation */}
      <div className="w-full p-8 pb-12 flex flex-col items-center space-y-8 relative z-10">
        {/* Progress Dots */}
        <div className="flex space-x-2">
          {slides.map((_, i) => (
            <div 
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === currentSlide ? `w-8 ${slides[currentSlide].accent}` : 'w-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={next}
          disabled={!canProceed}
          className={cn(
            "w-full max-w-xs py-4 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-95",
            slides[currentSlide].accent,
            !canProceed && "opacity-50 cursor-not-allowed"
          )}
        >
          <span>
            {isLastSlide 
              ? (selectedInterests.length < MIN_REQUIRED_INTERESTS 
                  ? t('onboarding.select_more', { count: MIN_REQUIRED_INTERESTS - selectedInterests.length }) 
                  : t('onboarding.get_started')) 
              : t('onboarding.next')}
          </span>
          {isLastSlide ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <ArrowRight className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};
