import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, RefreshCw, ExternalLink, LayoutGrid, Chrome } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface OtherAppsViewProps {
  onClose: () => void;
}

export const OtherAppsView: React.FC<OtherAppsViewProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const targetUrl = "https://created.link/apps";

  const handleRefresh = () => {
    setIsLoading(true);
    setError(false);
    const iframe = document.getElementById('other-apps-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = targetUrl;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center p-0 sm:p-4 bg-stone-900/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white sm:rounded-[2.5rem] shadow-2xl w-full max-w-4xl h-full sm:h-[90vh] flex flex-col overflow-hidden relative"
      >
        {/* Header */}
        <div className="flex-none px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center shadow-lg shadow-stone-200">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-900 tracking-tight leading-none">
                {t('other_apps.title')}
              </h2>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">
                {t('other_apps.subtitle')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 hover:bg-stone-50 rounded-xl transition-colors text-stone-400 hover:text-stone-900"
              title="Refresh"
            >
              <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
            </button>
            <a 
              href={targetUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 hover:bg-stone-50 rounded-xl transition-colors text-stone-400 hover:text-stone-900"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
            <button
              onClick={onClose}
              className="ml-2 p-2 hover:bg-stone-50 rounded-xl transition-colors text-stone-400 hover:text-stone-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Webview Area */}
        <div className="flex-1 bg-stone-50 relative overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="w-10 h-10 border-4 border-stone-100 border-t-stone-900 rounded-full mb-4"
              />
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest animate-pulse">
                {t('other_apps.loading')}
              </p>
            </div>
          )}

          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
                <Chrome className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-stone-900">{t('other_apps.error')}</h3>
              <button 
                onClick={handleRefresh}
                className="px-6 py-2 bg-stone-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-stone-200"
              >
                Retry
              </button>
            </div>
          ) : (
            <iframe
              id="other-apps-iframe"
              src={targetUrl}
              className="w-full h-full border-none"
              onLoad={() => setIsLoading(false)}
              onError={() => setError(true)}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          )}
        </div>
        
        {/* Footer info/attribution */}
        <div className="flex-none px-6 py-3 bg-stone-50 border-t border-stone-100 flex items-center justify-center">
          <p className="text-[9px] font-bold text-stone-300 uppercase tracking-[0.2em]">
            Powered by Created.link Web Solutions
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
