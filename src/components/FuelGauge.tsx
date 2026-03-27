import React from 'react';
import { motion } from 'motion/react';
import { Fuel, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

interface FuelGaugeProps {
  level: number;
  maxLevel?: number;
  onClick?: () => void;
  className?: string;
  showLabel?: boolean;
}

export const FuelGauge: React.FC<FuelGaugeProps> = ({ 
  level, 
  maxLevel = 1000, 
  onClick, 
  className,
  showLabel = true
}) => {
  const { t } = useTranslation();
  
  // Calculate percentage, capped at 100
  const percentage = Math.min(Math.max((level / maxLevel) * 100, 0), 100);
  
  // Determine color based on level
  const isLow = percentage < 20;
  const isCritical = percentage < 10;
  
  const getGaugeColor = () => {
    if (isCritical) return "from-rose-500 to-rose-600";
    if (isLow) return "from-amber-400 to-orange-500";
    return "from-emerald-400 to-teal-500";
  };

  const getTrackColor = () => {
    if (isCritical) return "bg-rose-100";
    if (isLow) return "bg-amber-100";
    return "bg-stone-100";
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col gap-1.5 p-3 rounded-2xl transition-all border shrink-0",
        isCritical ? "bg-rose-50 border-rose-100 shadow-rose-100/50 shadow-lg" : 
        isLow ? "bg-amber-50 border-amber-100 shadow-amber-100/50 shadow-lg" : 
        "bg-white border-stone-100 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between w-full gap-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-colors",
            isCritical ? "bg-rose-500 text-white" : 
            isLow ? "bg-amber-500 text-white" : 
            "bg-stone-50 text-stone-400"
          )}>
            {isCritical ? <AlertTriangle className="w-4 h-4" /> : <Fuel className="w-4 h-4" />}
          </div>
          {showLabel && (
            <div className="text-left leading-none">
              <span className={cn(
                "text-[10px] font-black uppercase tracking-widest",
                isCritical ? "text-rose-600" : isLow ? "text-amber-600" : "text-stone-400"
              )}>
                {isCritical ? t('fuel.critical') : isLow ? t('fuel.low') : t('fuel.status')}
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-sm font-black text-stone-900 tabular-nums">
                  {level}
                </span>
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">
                  {t('fuel.units')}
                </span>
              </div>
            </div>
          )}
        </div>
        
        {!showLabel && (
           <span className="text-xs font-black text-stone-900 tabular-nums">
            {level}
          </span>
        )}
      </div>

      {/* Modern Gauge Bar */}
      <div className={cn("h-2 w-full rounded-full overflow-hidden relative", getTrackColor())}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: "spring", damping: 20, stiffness: 100 }}
          className={cn("h-full rounded-full bg-gradient-to-r relative shadow-sm", getGaugeColor())}
        >
          {/* Subtle Shine/Liquid effect */}
          <motion.div 
             animate={{ x: ['-100%', '200%'] }}
             transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
             className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-1/2"
          />
        </motion.div>
      </div>

      {isCritical && (
        <motion.div 
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white shadow-sm shadow-rose-500/50"
        />
      )}
    </motion.button>
  );
};
