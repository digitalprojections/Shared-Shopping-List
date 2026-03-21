import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ArrowLeft, 
  ShoppingBag, 
  Plus, 
  Minus, 
  ChevronRight, 
  CreditCard, 
  Clock, 
  Store as StoreIcon, // Use alias to avoid conflict
  AlertCircle,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OrderItem, Store, Order } from '../types';
import { orderService } from '../services/orderService';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';

interface StoreOrderCheckoutProps {
  store: Store;
  items: Map<string, OrderItem>;
  total: number;
  count: number;
  onClose: () => void;
  onOrderSuccess: (orderId: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  removeItem: (id: string) => void;
}

export const StoreOrderCheckout: React.FC<StoreOrderCheckoutProps> = ({ 
  store, 
  items, 
  total, 
  count, 
  onClose, 
  onOrderSuccess,
  updateQuantity,
  removeItem
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handlePlaceOrder = async () => {
    if (!auth.currentUser) {
      setError(t('order.error_not_logged_in', 'You must be logged in to place an order.'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'chat'> = {
        storeId: store.id,
        storeName: store.name,
        customerId: auth.currentUser.uid,
        customerName: auth.currentUser.displayName || 'Anonymous User',
        items: Array.from(items.values()),
        totalAmount: total,
        status: 'pending',
        notes: note
      };

      const docRef = await orderService.createOrder(orderData);
      if (docRef) {
        onOrderSuccess(docRef.id);
      }
    } catch (err) {
      console.error("Error placing order:", err);
      setError(t('order.error_placing_order', 'Failed to place order. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const itemArray: OrderItem[] = Array.from(items.values());

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      className="fixed inset-0 z-[200] bg-white flex flex-col"
    >
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-4 sm:px-6 py-4 sm:py-6 safe-top shrink-0">
        <div className="max-w-xl mx-auto flex items-center gap-3 sm:gap-4">
          <button onClick={onClose} className="p-2.5 sm:p-3 bg-stone-50 rounded-xl sm:rounded-2xl text-stone-600 hover:bg-stone-100 transition-colors">
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-stone-900 leading-tight uppercase tracking-tight">{t('order.checkout_title', 'Checkout')}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StoreIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500" />
              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-stone-400">{store.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="max-w-xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
          
          {/* Items Summary */}
          <section className="space-y-3 sm:space-y-4">
            <h3 className="text-[9px] sm:text-[10px] font-black text-stone-300 uppercase tracking-widest px-2">{t('order.items_count', '{{count}} ITEMS', { count })}</h3>
            <div className="space-y-2.5 sm:space-y-3">
              {itemArray.map((item) => (
                <div key={item.productId} className="bg-stone-50/50 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-stone-100 flex items-center justify-between group">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-xl sm:rounded-2xl" />
                      ) : (
                        <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-stone-200" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-stone-900 leading-tight truncate">{item.name}</p>
                      <p className="text-xs font-black text-indigo-500 mt-1 uppercase tracking-tight">
                        {t('common.currency_symbol')}{item.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-3 sm:gap-4 bg-white px-2 py-1 rounded-lg sm:rounded-xl border border-stone-100 shadow-sm">
                      <button 
                        onClick={() => item.quantity > 1 ? updateQuantity(item.productId, -1) : removeItem(item.productId)}
                        className="p-1 text-stone-400 hover:text-stone-900"
                      >
                        {item.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-rose-400" /> : <Minus className="w-3.5 h-3.5" />}
                      </button>
                      <span className="text-xs sm:text-sm font-black text-stone-900 min-w-[12px] text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="p-1 text-stone-400 hover:text-stone-900"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[9px] sm:text-[10px] font-black text-stone-400">
                      {t('common.currency_symbol')}{(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Add Note */}
          <section className="space-y-3 sm:space-y-4">
            <h3 className="text-[9px] sm:text-[10px] font-black text-stone-300 uppercase tracking-widest px-2">{t('order.note_label', 'Note for the store')}</h3>
            <div className="bg-stone-50 rounded-[2rem] sm:rounded-[2.5rem] p-3 sm:p-4">
              <textarea 
                placeholder={t('order.note_placeholder', 'Add any special instructions...')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-white border-transparent focus:ring-0 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-sm font-medium min-h-[100px] sm:min-h-[120px] resize-none outline-none shadow-sm"
              />
            </div>
          </section>

          {/* Payment Warning */}
          <div className="p-4 sm:p-6 bg-amber-50 rounded-[2rem] sm:rounded-[2.5rem] flex items-start gap-3 sm:gap-4 border border-amber-100">
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 shrink-0 mt-0.5 sm:mt-1" />
            <div className="space-y-1">
               <p className="text-[10px] sm:text-xs font-black text-amber-700 uppercase tracking-widest">{t('order.payment_info', 'Pay on Delivery')}</p>
               <p className="text-[11px] sm:text-xs font-medium text-amber-600 leading-relaxed">
                 {t('order.disclaimer', 'This application facilitates order delivery. Please coordinate payment directly with the store owner upon receipt.')}
               </p>
            </div>
          </div>

          {/* Totals Section */}
          <section className="bg-stone-900 rounded-[2.5rem] sm:rounded-[3rem] p-6 sm:p-8 space-y-5 sm:space-y-6">
             <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center justify-between text-stone-400">
                   <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{t('order.subtotal', 'Subtotal')}</p>
                   <p className="text-sm sm:text-base font-black">
                     {t('common.currency_symbol')}{total.toFixed(2)}
                   </p>
                </div>
                <div className="flex items-center justify-between text-stone-400 pb-3 sm:pb-4 border-b border-stone-800">
                   <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest">{t('order.delivery_fee', 'Delivery Fee')}</p>
                   <p className="text-emerald-400 font-black uppercase text-[9px] sm:text-[10px] tracking-widest">{t('order.free', 'FREE')}</p>
                </div>
                <div className="flex items-center justify-between pt-1 sm:pt-2">
                   <p className="text-base sm:text-lg font-black text-white uppercase tracking-tight">{t('order.total', 'Total Amount')}</p>
                   <p className="text-xl sm:text-2xl font-black text-indigo-400">
                      <span className="text-[10px] sm:text-xs mr-1">{t('common.currency_symbol')}</span>
                      {total.toFixed(2)}
                   </p>
                </div>
             </div>
             
             {error && (
               <div className="p-3 sm:p-4 bg-rose-500/10 rounded-xl sm:rounded-2xl border border-rose-500/30 flex items-center gap-3">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" />
                  <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-rose-500">{error}</p>
               </div>
             )}

             <button 
                onClick={handlePlaceOrder}
                disabled={loading || count === 0}
                className={cn(
                  "w-full h-14 sm:h-18 bg-white text-stone-900 rounded-2xl sm:rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all",
                  loading ? "opacity-70" : "active:scale-95 shadow-xl shadow-stone-950"
                )}
             >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                    <span className="text-sm sm:text-base">{t('order.place_order_button', 'Send Order Now')}</span>
                  </>
                )}
             </button>
          </section>

          <footer className="h-12" />
        </div>
      </div>
    </motion.div>
  );
};
