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
  Store,
  MessageCircle,
  Search
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Order, OrderStatus } from '../types';
import { orderService } from '../services/orderService';
import { cn } from '../lib/utils';
import { getOrderStatusColor } from '../lib/orderUtils';
import { OrderDetailView } from './OrderDetailView';
import { auth } from '../lib/firebase';

interface UserOrdersViewProps {
  onClose: () => void;
}

export const UserOrdersView: React.FC<UserOrdersViewProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }

    const unsubscribe = orderService.subscribeToUserOrders(
      userId, 
      (fetchedOrders) => {
        setOrders(fetchedOrders);
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to user orders:", error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status === filter;
    const matchesSearch = order.storeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          order.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });


  const getStatusLabel = (status: OrderStatus) => {
    return t(`order.status.${status}`, status.replace(/_/g, ' '));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-stone-100 border-t-indigo-600 rounded-full animate-spin" />
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
            <h2 className="font-black text-stone-900 uppercase tracking-tight text-xl">{t('order.my_orders')}</h2>
            <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest mt-0.5">{t('order.track_purchases')}</p>
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
                placeholder={t('order.search_orders')}
                className="w-full bg-white border border-stone-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-50 shadow-sm transition-all"
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
                  {s === 'all' ? t('common.all', 'All') : getStatusLabel(s as OrderStatus)}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          <div className="space-y-4 pb-20">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <motion.button
                  layout
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className="w-full bg-white p-6 rounded-[2rem] border border-stone-100 shadow-xl shadow-stone-900/[0.02] flex items-center justify-between text-left hover:border-indigo-200 transition-all group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner",
                      order.status === 'pending' ? 'bg-amber-50' : 'bg-stone-50'
                    )}>
                      <Store className={cn(
                        "w-7 h-7",
                        order.status === 'pending' ? 'text-amber-500' : 'text-stone-300'
                      )} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-stone-900 truncate">{order.storeName}</h4>
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
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-0.5">
                          {t('common.currency_symbol')}
                          {order.totalAmount.toFixed(2)}
                        </p>
                      </div>
                      <p className="text-[9px] font-bold text-stone-300 mt-1 uppercase tracking-tighter">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-xl group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </motion.button>
              ))
            ) : (
              <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 bg-stone-100 rounded-[2rem] flex items-center justify-center">
                  <ShoppingBag className="w-10 h-10 text-stone-300" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-stone-900 uppercase tracking-tight">{t('order.no_orders')}</h3>
                  <p className="text-sm font-medium text-stone-400 mt-1">{t('order.no_orders_subtitle')}</p>
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
            isMerchant={false}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
