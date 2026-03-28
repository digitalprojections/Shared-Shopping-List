import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { X, Link as LinkIcon, Copy, CheckCircle2, Trash2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { ShareLink, Permission } from '../types';
import { shoppingService } from '../services/shoppingService';
import { cn } from '../lib/utils';
import { APP_CONFIG } from '../config';

interface ShareModalProps {
  listId: string;
  onClose: () => void;
  type?: 'list' | 'collection';
}

export function ShareModal({ listId, onClose, type = 'list' }: ShareModalProps) {
  const { t } = useTranslation();
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [permission, setPermission] = useState<Permission>('read');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    return shoppingService.subscribeToShares(listId, setShares);
  }, [listId]);

  const handleCreateShare = async () => {
    await shoppingService.createShareLink(listId, permission, type);
  };

  const copyShareLink = (shareId: string) => {
    const platform = Capacitor.getPlatform();

    // In native apps, we use the hardcoded production URL.
    // On web (PWA or development), we use the current browser URL.
    const baseUrl = (platform === 'android' || platform === 'ios')
      ? APP_CONFIG.PROD_URL
      : `${window.location.origin}${window.location.pathname}`;

    const url = `${baseUrl}${baseUrl.endsWith('/') ? '' : '/'}?share=${shareId}`;
    console.log('Share Link: Generated URL for platform', platform, url);

    navigator.clipboard.writeText(url);
    setCopiedId(shareId);
    setTimeout(() => setCopiedId(null), 2000);
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
        className="bg-white p-8 rounded-[3rem] shadow-2xl w-full max-w-lg space-y-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-stone-900">{t('share_modal.title')}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 p-2 bg-stone-100 rounded-[1.5rem]">
            <button
              onClick={() => setPermission('read')}
              className={cn(
                "flex-1 py-3 rounded-2xl text-sm font-bold transition-all",
                permission === 'read' ? "bg-white shadow-md text-emerald-600" : "text-stone-500 hover:text-stone-700"
              )}
            >
              {t('share_modal.read_only')}
            </button>
            <button
              onClick={() => setPermission('edit')}
              className={cn(
                "flex-1 py-3 rounded-2xl text-sm font-bold transition-all",
                permission === 'edit' ? "bg-white shadow-md text-emerald-600" : "text-stone-500 hover:text-stone-700"
              )}
            >
              {t('share_modal.can_edit')}
            </button>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreateShare}
            className="w-full py-5 rounded-[1.5rem] bg-emerald-600 text-white font-bold shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
          >
            <LinkIcon className="w-5 h-5" />
            {t('share_modal.generate_link')}
          </motion.button>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 ml-1">{t('share_modal.active_links')}</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {shares.map((share) => (
              <motion.div
                layout
                key={share.id}
                className="flex items-center justify-between p-5 rounded-[1.5rem] border-2 border-stone-50 bg-stone-50/50"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-widest text-stone-900">{t('share_modal.access_type', { permission: share.permission })}</span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest mt-1",
                    share.isActive ? "text-emerald-500" : "text-stone-400"
                  )}>
                    {share.isActive ? t('share_modal.active') : t('share_modal.deactivated')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyShareLink(share.id)}
                    className="p-3 bg-white hover:bg-stone-100 rounded-xl shadow-sm border border-stone-200 transition-all text-stone-600"
                    title={t('list_view.copy_link')}
                  >
                    {copiedId === share.id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => shoppingService.toggleShareActive(share.id, !share.isActive)}
                    className={cn(
                      "p-3 rounded-xl shadow-sm border transition-all",
                      share.isActive
                        ? "bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100"
                        : "bg-white border-stone-200 text-stone-400 hover:bg-stone-100"
                    )}
                    title={share.isActive ? t('share_modal.deactivate') : t('share_modal.activate')}
                  >
                    <CheckCircle2 className={cn("w-4 h-4", !share.isActive && "opacity-20")} />
                  </button>
                  <button
                    onClick={() => shoppingService.deleteShare(share.id)}
                    className="p-3 bg-white hover:bg-rose-50 rounded-xl shadow-sm border border-stone-200 transition-all text-rose-500"
                    title={t('share_modal.delete_link')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
            {shares.length === 0 && (
              <div className="text-center py-8 bg-stone-50 rounded-[1.5rem] border-2 border-dashed border-stone-200">
                <p className="text-sm font-bold text-stone-400">{t('share_modal.no_links')}</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
