import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { User } from 'firebase/auth';
import {
  Plus,
  Trash2,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Link as LinkIcon,
  X,
  MoreVertical,
  ShoppingBag,
  RotateCcw,
  Clock,
  RefreshCw,
  MapPin
} from 'lucide-react';
import { ShoppingList, ListItem, Permission, AppUser } from '../types';
import { shoppingService } from '../services/shoppingService';
import { cn } from '../lib/utils';
import { COLORS } from '../constants';
import { EmojiPicker } from './EmojiPicker';
import { ShareModal } from './ShareModal';

interface ListViewProps {
  listId: string;
  onBack: () => void;
  isShared: boolean;
  permission: Permission;
  user: User | null;
  appUser: AppUser | null;
}

export function ListView({
  listId,
  onBack,
  isShared,
  permission,
  user,
  appUser
}: ListViewProps) {
  const { t } = useTranslation();
  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isThrottled, setIsThrottled] = useState(false);
  const [localDraftItems, setLocalDraftItems] = useState<ListItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const hasUnsyncedChanges = useMemo(() => {
    if (localDraftItems.length !== items.length) return true;

    return localDraftItems.some((local, idx) => {
      const remote = items[idx];
      if (!remote) return true;
      if (local.name !== remote.name || local.quantity !== remote.quantity || local.isBought !== remote.isBought) return true;
      if (!local.id.startsWith('temp-') && !remote.id.startsWith('temp-') && local.id !== remote.id) return true;
      return false;
    });
  }, [localDraftItems, items]);

  useEffect(() => {
    if (!listId) return;
    return shoppingService.subscribeToList(listId, setList);
  }, [listId]);

  useEffect(() => {
    if (!listId) return;
    let initialLoadDone = false;

    return shoppingService.subscribeToItems(listId, (remoteItems) => {
      setItems(prevItems => {
        setLocalDraftItems(prevDraft => {
          if (!initialLoadDone) {
            const savedDraft = localStorage.getItem(`list_draft_${listId}`);
            initialLoadDone = true;
            if (savedDraft) {
              try {
                return JSON.parse(savedDraft);
              } catch (e) {
                return remoteItems;
              }
            }
            return remoteItems;
          }

          const localModifications = prevDraft.filter(l => {
            if (l.id.startsWith('temp-')) return false;
            const remoteBefore = prevItems.find(r => r.id === l.id);
            return remoteBefore && (remoteBefore.name !== l.name || remoteBefore.quantity !== l.quantity || remoteBefore.isBought !== l.isBought);
          });

          const localDeletions = prevItems.filter(r => !prevDraft.find(l => l.id === r.id)).map(r => r.id);
          const localAdditions = prevDraft.filter(l => l.id.startsWith('temp-'));

          let nextDraft = remoteItems.map(remote => {
            const dirtyLocal = localModifications.find(l => l.id === remote.id);
            if (dirtyLocal) return dirtyLocal;
            return remote;
          });

          nextDraft = nextDraft.filter(item => !localDeletions.includes(item.id));

          const unsyncedAdditions = localAdditions.filter(local => {
            const alreadySynced = remoteItems.find(remote =>
              remote.name === local.name &&
              remote.quantity === local.quantity &&
              !remote.id.startsWith('temp-')
            );
            return !alreadySynced;
          });

          return [...nextDraft, ...unsyncedAdditions];
        });

        return remoteItems;
      });
    });
  }, [listId]);

  useEffect(() => {
    if (!listId) return;
    const isClean = localDraftItems.length === items.length &&
      JSON.stringify(localDraftItems) === JSON.stringify(items);

    if (isClean || localDraftItems.length === 0) {
      localStorage.removeItem(`list_draft_${listId}`);
    } else {
      localStorage.setItem(`list_draft_${listId}`, JSON.stringify(localDraftItems));
    }
  }, [localDraftItems, listId, items]);

  useEffect(() => {
    if (isThrottled) {
      const timer = setTimeout(() => setIsThrottled(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isThrottled]);

  const handleAddItem = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newItemName.trim() || permission === 'read' || !user) return;

    const newItem: ListItem = {
      id: `temp-${Date.now()}`,
      name: newItemName,
      quantity: newItemQty,
      isBought: false,
      createdAt: Date.now()
    };

    setLocalDraftItems(prev => [...prev, newItem]);
    setNewItemName('');
    setNewItemQty('');
    inputRef.current?.focus();
  };

  const hasChanges = localDraftItems.length !== items.length || JSON.stringify(localDraftItems) !== JSON.stringify(items);

  const handleSync = async () => {
    if (!user || !appUser || isSyncing) return;

    if (appUser.fuelLevel <= 0) {
      alert(t('list_view.insufficient_fuel'));
      return;
    }

    setIsSyncing(true);
    try {
      const itemsToAdd = localDraftItems.filter(item => item.id.startsWith('temp-')).map(({ id, ...rest }) => rest);
      const itemsToUpdate = localDraftItems.filter(local => {
        const remote = items.find(r => r.id === local.id);
        return remote && (remote.isBought !== local.isBought || remote.name !== local.name || remote.quantity !== local.quantity);
      });
      const itemsToDelete = items.filter(remote => !localDraftItems.find(local => local.id === remote.id)).map(i => i.id);

      if (itemsToAdd.length === 0 && itemsToUpdate.length === 0 && itemsToDelete.length === 0) {
        alert(t('common.no_changes'));
        setIsSyncing(false);
        return;
      }

      const totalDiff = itemsToAdd.length - itemsToDelete.length;
      const boughtBefore = items.filter(i => i.isBought).length;
      const boughtAfter = localDraftItems.filter(i => i.isBought).length;
      const boughtDiff = boughtAfter - boughtBefore;

      await shoppingService.syncListChanges(listId, user.uid, itemsToAdd, itemsToUpdate, itemsToDelete, totalDiff, boughtDiff);

      localStorage.removeItem(`list_draft_${listId}`);
      const syncedItems = [...localDraftItems];
      setItems(syncedItems);
      setLocalDraftItems(syncedItems);
      alert(t('list_view.sync_success'));
    } catch (error: any) {
      alert(error.message || t('list_view.sync_fail'));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteList = async () => {
    if (!user) return;
    if (window.confirm(t('list_view.delete_confirm'))) {
      try {
        await shoppingService.deleteList(listId, user.uid);
        onBack();
      } catch (error: any) {
        alert(error.message || t('list_view.sync_fail'));
      }
    }
  };

  if (!list) return null;

  const boughtCount = items.filter(i => i.isBought).length;
  const progress = items.length > 0 ? (boughtCount / items.length) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.1, x: -2 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="p-2.5 bg-white hover:bg-stone-100 rounded-xl shadow-sm border border-stone-200 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 bg-white/40 rounded-xl sm:rounded-2xl flex items-center justify-center backdrop-blur-sm hover:bg-white/60 transition-colors cursor-pointer flex-shrink-0"
                onClick={() => setShowEmojiPicker(true)}
              >
                {list.icon ? (
                  <span className="text-2xl sm:text-3xl">{list.icon}</span>
                ) : (
                  <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7 opacity-80" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-stone-900 truncate">{list.name}</h2>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex-1 h-2 w-32 bg-stone-200 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                {t('list_view.items_count', { bought: boughtCount, total: items.length })}
              </span>
            </div>
            {isShared && (
              <span className="text-[10px] uppercase tracking-widest font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 self-start sm:self-center mt-2 block w-fit">
                {permission}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 self-end md:self-auto">
          {permission === 'edit' && hasUnsyncedChanges ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all"
            >
              <RefreshCw className={cn("w-5 h-5", isSyncing && "animate-spin")} />
              {isSyncing ? t('list_view.syncing') : t('list_view.sync_changes')}
            </motion.button>
          ) : null}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowOptions(!showOptions)}
              className="p-3 bg-white border border-stone-200 rounded-2xl shadow-sm hover:shadow-md transition-all"
            >
              <MoreVertical className="w-6 h-6 text-stone-500" />
            </motion.button>
            <AnimatePresence>
              {showOptions && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-3 w-56 bg-white rounded-[1.5rem] shadow-2xl border border-stone-100 z-50 overflow-hidden"
                  >
                    {hasChanges && (
                      <button
                        onClick={() => {
                          if (window.confirm(t('list_view.discard_confirm'))) {
                            setLocalDraftItems(items);
                            localStorage.removeItem(`list_draft_${listId}`);
                            setShowOptions(false);
                          }
                        }}
                        className="w-full px-5 py-4 text-left text-sm font-bold text-amber-600 hover:bg-amber-50 flex items-center gap-3 transition-colors border-b border-stone-50"
                      >
                        <RotateCcw className="w-5 h-5" />
                        {t('list_view.discard_changes')}
                      </button>
                    )}
                    {!isShared && (
                      <button
                        onClick={handleDeleteList}
                        className="w-full px-5 py-4 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors border-b border-stone-50"
                      >
                        <Trash2 className="w-5 h-5" />
                        {t('list_view.delete_collection')}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setShowOptions(false);
                      }}
                      className="w-full px-5 py-4 text-left text-sm font-bold text-stone-600 hover:bg-stone-50 flex items-center gap-3 transition-colors"
                    >
                      <Copy className="w-5 h-5" />
                      {t('list_view.copy_link')}
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {permission === 'edit' && (
        <motion.div
          layout
          className="relative group"
        >
          <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                placeholder={t('list_view.add_item_placeholder')}
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                className="w-full px-5 py-3 rounded-2xl border-2 border-stone-100 bg-white focus:outline-none focus:border-emerald-500 shadow-sm transition-all text-base font-medium"
              />
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder={t('list_view.qty_placeholder')}
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                className="w-full sm:w-24 px-5 py-3 rounded-2xl border-2 border-stone-100 bg-white focus:outline-none focus:border-emerald-500 shadow-sm transition-all text-base font-medium"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!newItemName.trim() || isThrottled}
                className="p-3 rounded-2xl bg-emerald-600 text-white disabled:opacity-50 shadow-md shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center min-w-[3rem]"
              >
                {isThrottled ? <Clock className="w-5 h-5 animate-pulse" /> : <Plus className="w-6 h-6" />}
              </motion.button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence initial={false}>
          {localDraftItems.map((item) => (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={cn(
                "group flex items-center justify-between p-3 rounded-xl border transition-all duration-300",
                item.isBought
                  ? "bg-stone-50 border-transparent opacity-60"
                  : "bg-white border-stone-100 shadow-sm hover:shadow-md hover:border-emerald-100",
                item.id.startsWith('temp-') && "border-emerald-200 border-dashed"
              )}
            >
              <div className="flex items-center gap-4 flex-1">
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  disabled={permission === 'read'}
                  onClick={() => {
                    setLocalDraftItems(prev => prev.map(i =>
                      i.id === item.id ? { ...i, isBought: !i.isBought } : i
                    ));
                  }}
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center transition-all border-2 flex-shrink-0",
                    item.isBought
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "bg-white border-stone-200 text-transparent hover:border-emerald-400"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                </motion.button>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-lg font-semibold transition-all",
                    item.isBought && "line-through text-stone-400"
                  )}>
                    {item.name}
                    {item.id.startsWith('temp-') && <span className="ml-2 text-[10px] text-emerald-500 font-black italic">{t('list_view.new_tag')}</span>}
                  </span>
                  {item.quantity && (
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">{item.quantity}</span>
                  )}
                  {item.storeName && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-stone-300" />
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{item.storeName}</span>
                    </div>
                  )}
                </div>
              </div>
              {permission === 'edit' && (
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    setLocalDraftItems(prev => prev.filter(i => i.id !== item.id));
                  }}
                  className="p-2 text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-24 h-24 bg-stone-100 rounded-[2.5rem] flex items-center justify-center">
              <ShoppingBag className="w-10 h-10 text-stone-300" />
            </div>
            <div className="space-y-1">
              <p className="text-stone-900 font-bold text-xl">{t('list_view.empty_list')}</p>
              <p className="text-stone-400">{t('list_view.empty_suggest')}</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showEmojiPicker && (
          <EmojiPicker
            currentEmoji={list.icon}
            onSelect={(emoji) => {
              shoppingService.updateListIcon(listId, emoji, user?.uid || '');
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShare && (
          <ShareModal
            listId={listId}
            onClose={() => setShowShare(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
