import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ArrowLeft, 
  ShoppingBag, 
  Clock, 
  ChevronRight,
  Package,
  CheckCircle2,
  Truck,
  AlertCircle,
  Calendar,
  User,
  Filter,
  Search
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Order, OrderStatus } from '../types';
import { orderService } from '../services/orderService';
import { cn } from '../lib/utils';
import { getOrderStatusColor } from '../lib/orderUtils';
import { OrderDetailView } from './OrderDetailView';

interface StoreOrdersViewProps {
  storeId: string;
  storeName: string;
  onClose: () => void;
}

export const StoreOrdersView: React.FC<StoreOrdersViewProps> = ({ storeId, storeName, onClose }) => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    const unsubscribe = orderService.subscribeToStoreOrders(
      storeId, 
      (fetchedOrders) => {
        setOrders(fetchedOrders);
        setLoading(false);
        setPermissionError(false);
      },
      (error) => {
        console.error("Error subscribing to store orders:", error);
        if (error.code === 'permission-denied') {
          setPermissionError(true);
        }
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [storeId]);

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch = order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          order.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });


  const getStatusLabel = (status: OrderStatus) => {
    return t(`order.status.${status}`, status.replace(/_/g, ' '));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-stone-100 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[200] bg-stone-50 flex flex-col pt-safe"
    >
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-6 py-6 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={onClose} className="p-3 bg-stone-50 rounded-2xl text-stone-600 hover:bg-stone-100 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex-1 text-center">
            <h2 className="font-black text-stone-900 uppercase tracking-tight text-xl">{t('merchant.orders_title', 'Store Orders')}</h2>
            <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mt-0.5">{storeName}</p>
          </div>
          <div className="w-12" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('merchant.search_orders', 'Search by customer or ID...')}
                className="w-full bg-white border border-stone-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:ring-4 focus:ring-emerald-50 shadow-sm transition-all"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
              {(['all', 'pending', 'confirmed', 'processing', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={cn(
                    "px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-2",
                    filter === s 
                      ? "bg-stone-900 text-white border-stone-900" 
                      : "bg-white text-stone-400 border-stone-100 hover:border-stone-200"
                  )}
                >
                  {s === 'all' ? t('common.all') : getStatusLabel(s as OrderStatus)}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          <div className="space-y-4 pb-20">
            {permissionError ? (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-6 bg-amber-50 rounded-[3rem] border-2 border-dashed border-amber-200 p-8">
                <div className="w-20 h-20 bg-amber-100 rounded-[2rem] flex items-center justify-center">
                  <AlertCircle className="w-10 h-10 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-amber-900 uppercase tracking-tight">{t('merchant.insufficient_balance', 'Low Fuel')}</h3>
                  <p className="text-sm font-medium text-amber-700 mt-2 max-w-xs mx-auto">
                    {t('merchant.insufficient_balance_subtitle', 'You need at least 50 fuel units to view and process orders. Please refuel your tank to continue.')}
                  </p>
                </div>
                <button 
                  onClick={onClose}
                  className="px-8 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-amber-200 active:scale-95 transition-all"
                >
                  {t('common.back')}
                </button>
              </div>
            ) : filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <motion.button
                  layout
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className="w-full bg-white p-6 rounded-[2rem] border border-stone-100 shadow-xl shadow-stone-900/[0.02] flex items-center justify-between text-left hover:border-emerald-200 transition-all group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                      order.status === 'pending' ? 'bg-amber-50' : 'bg-stone-50'
                    )}>
                      <ShoppingBag className={cn(
                        "w-7 h-7",
                        order.status === 'pending' ? 'text-amber-500' : 'text-stone-300'
                      )} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-stone-900 truncate">{order.customerName}</h4>
                        <span className={cn(
                          "px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border",
                          getOrderStatusColor(order.status)
                        )}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {order.items.length} {order.items.length === 1 ? 'Item' : 'Items'}
                        </p>
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-0.5">
                          {t('common.currency_symbol')}
                          {order.totalAmount.toFixed(2)}
                        </p>
                      </div>
                      <p className="text-[9px] font-bold text-stone-300 mt-1 uppercase tracking-tighter">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </motion.button>
              ))
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 bg-stone-100 rounded-[2rem] flex items-center justify-center">
                  <Package className="w-10 h-10 text-stone-300" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900 uppercase tracking-tight">{t('merchant.no_orders', 'No orders found')}</h3>
                  <p className="text-sm font-medium text-stone-400 mt-1">{t('merchant.no_orders_subtitle', 'Start by sharing your store link with customers!')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedOrderId && (
          <OrderDetailView 
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
            isMerchant={true}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
