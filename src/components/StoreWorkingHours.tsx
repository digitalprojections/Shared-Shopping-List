import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Store, DayKey, DailySchedule } from '../types';
import { cn } from '../lib/utils';

export const getDayKey = (date: Date): DayKey => {
  const day = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
  if (day === 'thu') return 'thu';
  if (day === 'sat') return 'sat';
  return day.slice(0, 3) as DayKey;
};

export const isOpenNow = (workingHours: Store['workingHours'] | Record<DayKey, DailySchedule>) => {
  if (!workingHours) return false;
  
  let schedules: Record<DayKey, DailySchedule>;
  if (typeof workingHours === 'string') {
    try {
      schedules = JSON.parse(workingHours);
    } catch (e) {
      return false;
    }
  } else {
    schedules = workingHours as Record<DayKey, DailySchedule>;
  }

  const now = new Date();
  const todayKey = getDayKey(now);
  const schedule = schedules[todayKey];

  if (!schedule || !schedule.isOpen) return false;

  const [hours, minutes] = schedule.open.split(':').map(Number);
  const [closeHours, closeMinutes] = schedule.close.split(':').map(Number);

  const openTime = new Date(now);
  openTime.setHours(hours, minutes, 0);

  const closeTime = new Date(now);
  closeTime.setHours(closeHours, closeMinutes, 0);

  return now >= openTime && now <= closeTime;
};

interface StoreWorkingHoursProps {
  workingHours: Store['workingHours'];
  className?: string;
}

export const StoreWorkingHours: React.FC<StoreWorkingHoursProps> = ({ workingHours, className }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!workingHours) return null;

  let schedules: Record<DayKey, DailySchedule>;
  if (typeof workingHours === 'string') {
    try {
      schedules = JSON.parse(workingHours);
    } catch (e) {
      return null;
    }
  } else {
    schedules = workingHours as unknown as Record<DayKey, DailySchedule>;
  }

  const isOpen = isOpenNow(schedules);
  const days: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const today = getDayKey(new Date());

  return (
    <div className={cn("space-y-2", className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
            isOpen ? "bg-emerald-50 text-emerald-600" : "bg-stone-50 text-stone-400"
          )}>
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">
              {t('store.opening_hours', 'Opening Hours')}
            </p>
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-2 h-2 rounded-full",
                isOpen ? "bg-emerald-500 animate-pulse" : "bg-stone-300"
              )} />
              <span className="font-bold text-stone-900">
                {isOpen ? t('store.open_now', 'Open Now') : t('store.closed_now', 'Closed')}
              </span>
              <span className="text-stone-400 font-medium">
                • {schedules[today]?.isOpen 
                  ? `${schedules[today].open} - ${schedules[today].close}`
                  : t('store.closed_today', 'Closed Today')
                }
              </span>
            </div>
          </div>
        </div>
        <ChevronDown className={cn(
          "w-5 h-5 text-stone-400 transition-transform duration-300",
          isExpanded && "rotate-180"
        )} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-3">
              {days.map((day) => {
                const schedule = schedules[day];
                const isToday = day === today;
                return (
                  <div 
                    key={day} 
                    className={cn(
                      "flex items-center justify-between transition-colors px-3 py-2 rounded-xl",
                      isToday ? "bg-white shadow-sm ring-1 ring-stone-100" : ""
                    )}
                  >
                    <span className={cn(
                      "text-sm font-bold uppercase tracking-wider",
                      isToday ? "text-stone-900" : "text-stone-400"
                    )}>
                      {t(`merchant.weekdays.${day}`, day)}
                    </span>
                    <span className={cn(
                      "text-sm font-mono",
                      !schedule?.isOpen ? "text-stone-300 italic" : "text-stone-700 font-bold"
                    )}>
                      {schedule?.isOpen 
                        ? `${schedule.open} - ${schedule.close}`
                        : t('store.closed', 'Closed')
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
