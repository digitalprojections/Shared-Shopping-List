import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import {
  Plus,
  LayoutGrid,
  List,
  Share2,
  ShoppingBag,
  Package,
  ChevronRight,
  ChevronLeft,
  MapPinPlus,
  PlayCircle,
  ExternalLink,
  X,
  Crown,
  Copy,
  Link as LinkIcon
} from 'lucide-react';
import { ShoppingList, AppUser, Order } from '../types';
import { cn } from '../lib/utils';
import { getOrderStatusColor } from '../lib/orderUtils';
import { adService } from '../services/adService';
import { shoppingService } from '../services/shoppingService';
import { couponService } from '../services/couponService';
import { APP_CONFIG } from '../config';
import { Capacitor } from '@capacitor/core';
import { InstallAppBanner } from './InstallAppBanner';
import { CommunityTips } from './CommunityTips';
import { ShareModal } from './ShareModal';
import { COLORS } from '../constants';

interface DashboardProps {
  userId: string;
  onSelectList: (id: string) => void;
  user: User;
  appUser: AppUser | null;
  lists: ShoppingList[];
  installPrompt: any;
  onInstall: () => void;
  onShowDiscoverStores: () => void;
  onShowOtherApps: () => void;
  purchases: Order[];
  salesOrders: Order[];
  orderTab: 'purchases' | 'sales';
  setOrderTab: (tab: 'purchases' | 'sales') => void;
  onShowOrders: () => void;
  onShowOrderDetail: (id: string, isMerchant: boolean) => void;
}

export function Dashboard({
  userId,
  onSelectList,
  user,
  appUser,
  lists,
  installPrompt,
  onInstall,
  onShowDiscoverStores,
  onShowOtherApps,
  purchases,
  salesOrders,
  orderTab,
  setOrderTab,
  onShowOrders,
  onShowOrderDetail
}: DashboardProps) {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [showShare, setShowShare] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [showCommunityTip, setShowCommunityTip] = useState(() => {
    return localStorage.getItem('hide_community_tip') !== 'true';
  });
  const [isPending, setIsPending] = useState(false);
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'yours' | 'shared'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    adService.initialize().catch(console.error);
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || isPending) return;

    setIsPending(true);
    try {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const id = await shoppingService.createList(userId, newListName, color);
      setNewListName('');
      setIsCreating(false);
      if (id) onSelectList(id);
    } catch (error: any) {
      alert(error.message || t('dashboard.create_error', 'Failed to create list'));
    } finally {
      setIsPending(false);
    }
  };

  const handleWatchAd = async () => {
    if (isAdLoading) return;
    setIsAdLoading(true);

    if (!Capacitor.isNativePlatform()) {
      try {
        const grantDailyFuelReward = httpsCallable(functions, 'grantDailyFuelReward');
        const result = await grantDailyFuelReward();
        const data = result.data as { success: boolean; error?: string };
        if (data.success) {
          console.log("Visit reward granted");
        } else {
          console.log("Visit reward fail:", data.error);
        }
      } catch (error) {
        console.error("Error rewarding dev visit:", error);
      } finally {
        setIsAdLoading(false);
      }
      onShowOtherApps();
      return;
    }

    try {
      const result = await adService.showRewardedAd();
      if (result.success) {
        alert(t('dashboard.reward_success'));
      } else {
        alert(result.error || t('dashboard.reward_fail'));
      }
    } catch (error) {
      console.error("Error showing rewarded ad:", error);
      alert(t('dashboard.ad_error'));
    } finally {
      setIsAdLoading(false);
    }
  };

  const filteredLists = lists.filter(list => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'yours') return list.ownerId === userId;
    if (activeFilter === 'shared') return list.ownerId !== userId;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <AnimatePresence>
        {(purchases.length > 0 || salesOrders.length > 0) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOrderTab('purchases')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    orderTab === 'purchases' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "text-stone-400 hover:text-stone-600"
                  )}
                >
                  {t('dashboard.all_purchases', 'My Purchases')}
                  {purchases.length > 0 && <span className="ml-2 opacity-60">({purchases.length})</span>}
                </button>
                {appUser?.isMerchant && (
                  <button
                    onClick={() => setOrderTab('sales')}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      orderTab === 'sales' ? "bg-stone-900 text-white shadow-lg shadow-stone-100" : "text-stone-stone-400 hover:text-stone-600"
                    )}
                  >
                    {t('dashboard.customer_orders', 'Orders')}
                    {salesOrders.length > 0 && <span className="ml-2 opacity-60">({salesOrders.length})</span>}
                  </button>
                )}
              </div>
              <button
                onClick={onShowOrders}
                className="p-2 bg-white border border-stone-100 rounded-xl text-stone-400 hover:text-indigo-600 transition-colors shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 -mx-1 px-1">
              {(orderTab === 'purchases' ? purchases : salesOrders).length > 0 ? (
                (orderTab === 'purchases' ? purchases : salesOrders).map((order) => (
                  <motion.button
                    key={order.id}
                    layoutId={order.id}
                    onClick={() => onShowOrderDetail(order.id, orderTab === 'sales')}
                    className="flex-shrink-0 w-64 bg-white p-5 rounded-[2.5rem] border border-stone-100 shadow-xl shadow-stone-900/[0.02] text-left group relative hover:border-indigo-100 transition-all active:scale-95"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn(
                        "p-2.5 rounded-xl transition-colors",
                        orderTab === 'purchases' ? "bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white" : "bg-stone-50 group-hover:bg-stone-900 group-hover:text-white"
                      )}>
                        {orderTab === 'purchases' ? <ShoppingBag className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                      </div>
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border",
                        getOrderStatusColor(order.status)
                      )}>
                        {t(`order.status.${order.status}`)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest leading-none">
                        {orderTab === 'purchases' ? order.storeName : order.customerName || 'Customer'}
                      </p>
                      <p className="text-sm font-black text-stone-900 truncate">
                        {order.items.map(i => i.name).join(', ')}
                      </p>
                    </div>
                  </motion.button>
                ))
              ) : (
                <div className="w-full py-8 text-center bg-stone-50 rounded-[2.5rem] border border-stone-100 border-dashed border-2">
                  <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest">
                    {t('dashboard.no_active_orders', 'No active orders')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {installPrompt && showInstallBanner && (
          <InstallAppBanner
            onInstall={onInstall}
            onClose={() => setShowInstallBanner(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showCommunityTip && (
          <div className="mb-8">
            <CommunityTips onClose={() => {
              setShowCommunityTip(false);
              localStorage.setItem('hide_community_tip', 'true');
            }} />
          </div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">{t('dashboard.title')}</h2>
          <p className="text-stone-500 mt-1">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {!user.isAnonymous && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowShare(true)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-stone-200 text-stone-700 rounded-2xl font-semibold shadow-sm hover:shadow-md transition-all"
            >
              <Share2 className="w-5 h-5" />
              <span className="hidden sm:inline">{t('dashboard.share_collection')}</span>
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreating(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-semibold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">{t('dashboard.create_list')}</span>
            <span className="sm:hidden">{t('dashboard.new_list_short')}</span>
          </motion.button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1 bg-stone-100/50 rounded-2xl w-fit">
          {(['all', 'yours', 'shared'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-bold transition-all",
                activeFilter === f
                  ? "bg-white shadow-sm text-emerald-600"
                  : "text-stone-500 hover:text-stone-700"
              )}
            >
              {t(`dashboard.filter_${f}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-stone-100/50 rounded-2xl">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "p-2 rounded-xl transition-all",
              viewMode === 'grid' ? "bg-white shadow-sm text-stone-900" : "text-stone-400 hover:text-stone-600"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              "p-2 rounded-xl transition-all",
              viewMode === 'list' ? "bg-white shadow-sm text-stone-900" : "text-stone-400 hover:text-stone-600"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className={cn(
            viewMode === 'grid'
              ? "grid grid-cols-2 md:grid-cols-3 gap-4"
              : "flex flex-col gap-3"
          )}>
            {filteredLists.map((list, index) => (
              <motion.div
                key={list.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.03 }}
                whileHover={{ y: viewMode === 'grid' ? -2 : 0, x: viewMode === 'list' ? 4 : 0 }}
                className="group relative"
              >
                <button
                  onClick={() => onSelectList(list.id)}
                  className={cn(
                    "w-full rounded-2xl border-2 transition-all duration-300 hover:shadow-lg hover:shadow-stone-200/50 flex",
                    viewMode === 'grid' ? "flex-col aspect-[16/10] p-4 justify-between text-left" : "items-center p-3 gap-4 text-left",
                    list.color || COLORS[0]
                  )}
                >
                  <div className={cn(
                    "bg-white/40 rounded-xl flex items-center justify-center backdrop-blur-sm hover:bg-white/60 transition-colors cursor-pointer shrink-0",
                    viewMode === 'grid' ? "w-9 h-9" : "w-11 h-11"
                  )}
                  >
                    {list.icon ? (
                      <span className={viewMode === 'grid' ? "text-xl" : "text-2xl"}>{list.icon}</span>
                    ) : (
                      <ShoppingBag className={cn(viewMode === 'grid' ? "w-5 h-5" : "w-6 h-6", "opacity-80")} />
                    )}
                  </div>

                  <div className={cn("flex-1 min-w-0", viewMode === 'grid' ? "space-y-1" : "flex items-center justify-between")}>
                    <div>
                      <h3 className={cn(
                        "font-bold leading-tight line-clamp-2",
                        viewMode === 'grid' ? "text-lg" : "text-base"
                      )}>
                        {list.name}
                      </h3>
                      {viewMode === 'list' && (
                        <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-0.5">
                          {new Date(list.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>

                    {viewMode === 'grid' ? (
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                            {new Date(list.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                          {list.totalItems !== undefined && (
                            <span className="text-[10px] font-black tracking-tighter opacity-40 mt-0.5">
                              {list.boughtItems || 0}/{list.totalItems}
                            </span>
                          )}
                        </div>
                        <div className="p-1.5 bg-white/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronLeft className="w-4 h-4 rotate-180" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        {list.totalItems !== undefined && (
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-[10px] font-black tracking-widest opacity-40">
                              {list.boughtItems || 0}/{list.totalItems}
                            </span>
                            <div className="w-12 h-1 bg-stone-900/10 rounded-full mt-1 overflow-hidden">
                              <div
                                className="h-full bg-stone-900/30"
                                style={{ width: `${list.totalItems > 0 ? ((list.boughtItems || 0) / list.totalItems) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <div className="p-2 bg-white/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                          <ChevronLeft className="w-4 h-4 rotate-180" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Update Badge */}
                  {list.updatedAt > shoppingService.getLastViewedAt(list.id) && list.lastUpdatedBy !== userId && (
                    <div className="absolute top-2 right-2 w-3 h-3 bg-rose-500 rounded-full border-2 border-white shadow-sm z-10" />
                  )}
                </button>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: lists.length * 0.03 }}
              whileHover={{ y: -2 }}
              className="group"
            >
              <button
                onClick={onShowDiscoverStores}
                className="w-full aspect-[16/10] p-4 rounded-3xl border-2 border-indigo-100 bg-indigo-50/20 flex flex-col items-center justify-center text-center gap-2 transition-all hover:bg-indigo-50 hover:border-indigo-200"
              >
                <div className="p-2 bg-indigo-100 rounded-2xl text-indigo-600 group-hover:scale-110 transition-transform">
                  <MapPinPlus className="w-7 h-7" />
                </div>
                <div>
                  <span className="block font-bold text-stone-900 leading-tight">{t('dashboard.nearby_stores')}</span>
                  <span className="text-xs text-stone-500">{t('dashboard.discover_local')}</span>
                </div>
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: lists.length * 0.03 }}
              whileHover={{ y: -2 }}
              className="group"
            >
              <button
                onClick={handleWatchAd}
                disabled={isAdLoading}
                className="w-full aspect-[16/10] p-4 rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 flex flex-col items-center justify-center text-center gap-2 transition-all hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-50"
              >
                {isAdLoading ? (
                  <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                ) : (
                  <>
                    <div className="p-2 bg-emerald-100 rounded-2xl text-emerald-600 group-hover:scale-110 transition-transform">
                      {Capacitor.isNativePlatform() ? (
                        <PlayCircle className="w-7 h-7" />
                      ) : (
                        <ExternalLink className="w-7 h-7" />
                      )}
                    </div>
                    <div>
                      <span className="block font-bold text-stone-900 leading-tight">
                        {Capacitor.isNativePlatform()
                          ? t('dashboard.get_free_fuel')
                          : t('dashboard.support_dev')}
                      </span>
                      <span className="text-xs text-stone-500">
                        {Capacitor.isNativePlatform()
                          ? t('dashboard.watch_ad')
                          : t('dashboard.visit_apps')}
                      </span>
                    </div>
                  </>
                )}
              </button>
            </motion.div>

            {lists.length === 0 && !isCreating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full py-20 flex flex-col items-center justify-center border-4 border-dashed border-stone-200 rounded-[3rem] bg-stone-50/50"
              >
                <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-4">
                  <Plus className="w-10 h-10 text-stone-300" />
                </div>
                <p className="text-stone-400 font-medium text-lg">{t('dashboard.no_lists')}</p>
                <button
                  onClick={() => setIsCreating(true)}
                  className="mt-4 text-emerald-600 font-bold hover:underline"
                >
                  {t('dashboard.create_first')}
                </button>
              </motion.div>
            )}
          </div>
        </div>

        <div className="space-y-6 order-first lg:order-last">
          {appUser?.isAdmin && <CouponGenerator />}
        </div>
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
          >
            <motion.form
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onSubmit={handleCreate}
              className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-stone-900">{t('dashboard.new_collection')}</h3>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">{t('dashboard.list_name')}</label>
                <input
                  autoFocus
                  type="text"
                  placeholder={t('dashboard.list_name_placeholder')}
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl border-2 border-stone-100 bg-stone-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-lg font-medium"
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-6 py-4 rounded-2xl text-stone-600 font-bold hover:bg-stone-100 transition-colors"
                >
                  {t('dashboard.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newListName.trim() || isPending}
                  className="flex-1 px-6 py-4 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('dashboard.creating', 'Creating...')}
                    </>
                  ) : (
                    t('dashboard.create')
                  )}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showShare && (
          <ShareModal listId={user?.uid || ''} type="collection" onClose={() => setShowShare(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CouponGenerator() {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    const code = await couponService.generateCoupon(parseInt(amount));
    setLoading(false);
    setGeneratedCode(code);
  };

  return (
    <div className="bg-stone-900 p-5 rounded-3xl text-white shadow-xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
          <Crown className="w-5 h-5 text-amber-400" />
        </div>
        <h3 className="font-bold">{t('admin.title')}</h3>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {['50', '100', '500', '1000'].map(val => (
            <button
              key={val}
              onClick={() => setAmount(val)}
              className={cn(
                "py-2 rounded-lg text-xs font-bold transition-all",
                amount === val ? "bg-amber-500 text-stone-900" : "bg-white/5 hover:bg-white/10"
              )}
            >
              {val} {t('admin.fuel_units')}
            </button>
          ))}
        </div>
        {!generatedCode ? (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-white text-stone-900 font-bold text-sm hover:bg-stone-100 disabled:opacity-50 transition-all"
          >
            {loading ? t('admin.generating') : t('admin.generate_coupon')}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
              <code className="text-amber-400 font-mono text-xs">{generatedCode}</code>
              <button
                onClick={() => navigator.clipboard.writeText(generatedCode)}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setGeneratedCode(null)}
              className="w-full py-2 text-xs font-bold text-stone-400 hover:text-white transition-colors"
            >
              {t('admin.generate_another')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
