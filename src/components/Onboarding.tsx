import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Fuel, 
  Layout, 
  ArrowRight, 
  CheckCircle2,
  Sparkles,
  Ticket,
  Scan,
  Store,
  Utensils
} from 'lucide-react';
import { userService } from '../services/userService';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { STORE_CATEGORIES } from '../constants/categories';

interface OnboardingProps {
  userId: string;
  onFinish: () => void;
  initialSlide?: number;
  currentPreferences?: string[];
}

const MIN_REQUIRED_INTERESTS = 1;

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
    icon: <Fuel className="w-16 h-16 text-sky-500" />,
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
    title: "onboarding.slides.replication_title",
    description: "onboarding.slides.replication_desc",
    icon: <Scan className="w-16 h-16 text-emerald-500" />,
    color: "from-emerald-50 to-teal-50",
    accent: "bg-emerald-500"
  },
  {
    title: "onboarding.slides.merchant_title",
    description: "onboarding.slides.merchant_desc",
    icon: (
      <div className="relative">
        <Store className="w-16 h-16 text-indigo-500" />
        <Utensils className="w-8 h-8 text-indigo-400 absolute -bottom-2 -right-2 bg-white rounded-lg p-1 shadow-sm" />
      </div>
    ),
    color: "from-indigo-50 to-blue-50",
    accent: "bg-indigo-500"
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
      
      {/* Top Section */}
      <div className="w-full p-4 flex justify-end relative z-10 min-h-[4rem]" />

      {/* Slide Content */}
      <div className="flex-1 w-full max-w-lg flex flex-col items-center justify-center px-6 relative z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full flex flex-col items-center text-center space-y-4 max-h-full"
          >
            <div className={`p-6 rounded-3xl bg-white shadow-xl shadow-black/5 ring-1 ring-black/5 mb-2 shrink-0`}>
              {slides[currentSlide].icon}
            </div>
            
            <div className="w-full space-y-3 flex flex-col overflow-hidden">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight shrink-0">
                {t(slides[currentSlide].title)}
              </h2>
              
              { isSelectionSlide ? (
                <div className="flex-1 overflow-y-auto px-2 py-2 -mx-2 custom-scrollbar max-h-[40vh] md:max-h-[50vh]">
                  <div className="grid grid-cols-2 gap-2">
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
                </div>
              ) : (
                <p className="text-base text-gray-600 leading-relaxed px-4 overflow-y-auto">
                  {t(slides[currentSlide].description)}
                </p>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Section */}
      <div className="w-full p-6 pb-8 flex flex-col items-center space-y-6 relative z-10 bg-white/80 backdrop-blur-sm border-t border-stone-100/50">
        {/* Progress Dots */}
        <div className="flex space-x-2">
          {slides.map((_, i) => (
            <div 
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentSlide ? `w-6 ${slides[currentSlide].accent}` : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={next}
          disabled={!canProceed}
          className={cn(
            "w-full max-w-xs py-3.5 rounded-2xl font-bold text-white shadow-lg flex items-center justify-center space-x-2 transition-all active:scale-95",
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
