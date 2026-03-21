import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ArrowLeft, 
  Clock, 
  MessageCircle, 
  CheckCircle2, 
  ShoppingBag, 
  Send,
  Package,
  Truck,
  CheckCircle,
  AlertCircle,
  Calendar,
  User,
  Store,
  Navigation
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Order, OrderStatus, ChatMessage } from '../types';
import { orderService } from '../services/orderService';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';

interface OrderDetailViewProps {
  orderId: string;
  onClose: () => void;
  isMerchant?: boolean;
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({ orderId, onClose, isMerchant }) => {
  const { t } = useTranslation();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [deliveryTimeInput, setDeliveryTimeInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = orderService.subscribeToOrder(orderId, (updatedOrder) => {
      setOrder(updatedOrder);
      if (updatedOrder.deliveryTime) {
        setDeliveryTimeInput(updatedOrder.deliveryTime);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [orderId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [order?.chat]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !order) return;
    try {
      await orderService.sendChatMessage(orderId, auth.currentUser?.uid || '', messageText);
      setMessageText('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleUpdateStatus = async (status: OrderStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, status);
      setShowStatusPicker(false);
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleUpdateDeliveryTime = async () => {
    try {
      await orderService.updateOrderStatus(orderId, order!.status, deliveryTimeInput);
    } catch (error) {
      console.error("Error updating delivery time:", error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[250] bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-stone-100 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'confirmed': return <CheckCircle2 className="w-5 h-5 text-blue-500" />;
      case 'processing': return <Package className="w-5 h-5 text-indigo-500" />;
      case 'out_for_delivery': return <Truck className="w-5 h-5 text-purple-500" />;
      case 'completed': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'cancelled': return <X className="w-5 h-5 text-rose-500" />;
      default: return <AlertCircle className="w-5 h-5 text-stone-500" />;
    }
  };

  const getStatusLabel = (status: OrderStatus) => {
    return t(`order.status.${status}`, status.replace(/_/g, ' '));
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      className="fixed inset-0 z-[250] bg-stone-50 flex flex-col"
    >
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-4 py-4 sm:px-6 sm:py-6 safe-top shrink-0">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <button onClick={onClose} className="p-2 sm:p-3 bg-stone-50 rounded-xl sm:2xl text-stone-600 hover:bg-stone-100">
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="flex-1 text-center font-black uppercase tracking-widest text-[10px] sm:text-sm text-stone-900">
             {t('order.id_label', 'Order #{{id}}', { id: orderId.slice(-6).toUpperCase() })}
          </div>
          <div className="w-10 sm:w-12" /> {/* Spacer */}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-12">
        <div className="max-w-xl mx-auto p-6 space-y-8">
          
          {/* Status Card */}
          <div className="bg-white rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-xl shadow-stone-900/5 space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest">{t('order.current_status', 'Current Status')}</p>
                <div className="flex items-center gap-2">
                  <div className="shrink-0">
                    {getStatusIcon(order.status)}
                  </div>
                  <span className="text-lg sm:text-xl font-black text-stone-900 uppercase tracking-tight">{getStatusLabel(order.status)}</span>
                </div>
              </div>
              {isMerchant && (
                <button 
                  onClick={() => setShowStatusPicker(true)}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-50 text-indigo-600 rounded-lg sm:xl text-[10px] sm:text-xs font-black uppercase tracking-widest"
                >
                  {t('order.change_status', 'Edit Status')}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 sm:pt-6 border-t border-stone-100">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-stone-50 rounded-xl sm:2xl shrink-0">
                   <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-stone-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest">{t('order.delivery_time', 'Estimated Delivery')}</p>
                  {isMerchant ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input 
                        type="text" 
                        value={deliveryTimeInput}
                        onChange={(e) => setDeliveryTimeInput(e.target.value)}
                        placeholder="e.g. 30-45 mins"
                        className="w-full bg-stone-50 border-none rounded-lg px-2 py-1 text-xs sm:text-sm font-bold"
                      />
                      <button onClick={handleUpdateDeliveryTime} className="p-1.5 bg-emerald-500 text-white rounded-md">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="font-bold text-stone-900 text-sm sm:text-base">{order.deliveryTime || t('order.pending_delivery', 'Waiting for store...')}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-stone-50 rounded-xl sm:2xl shrink-0">
                   <Navigation className="w-4 h-4 sm:w-5 sm:h-5 text-stone-400" />
                </div>
                <div>
                    <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest">{t('order.total_amount', 'Total Amount')}</p>
                    <p className="font-bold text-stone-900 text-lg sm:text-xl">
                      <span className="text-[10px] sm:text-xs text-indigo-500 mr-1">{t('common.currency_symbol')}</span>
                      {order.totalAmount.toFixed(2)}
                    </p>
                </div>
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3 sm:space-y-4">
             <h3 className="text-base sm:text-lg font-black text-stone-900 uppercase tracking-tight px-2">{t('order.items_title', 'Items ordered')}</h3>
             <div className="space-y-2.5 sm:space-y-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 sm:p-4 rounded-2xl sm:3xl flex items-center justify-between border border-stone-100">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-stone-50 rounded-xl sm:2xl flex items-center justify-center shrink-0">
                        {item.imageUrl ? (
                           <img src={item.imageUrl} alt="" className="w-full h-full object-cover rounded-xl sm:2xl" />
                        ) : (
                          <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-stone-200" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 text-sm sm:text-base leading-tight truncate">{item.name}</p>
                        <p className="text-[9px] sm:text-[10px] font-black text-stone-400 uppercase tracking-widest mt-0.5">
                          {item.quantity} × {t('common.currency_symbol')}{item.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <p className="font-black text-stone-900 text-sm sm:text-base">
                      <span className="text-[8px] text-indigo-500 mr-0.5">{t('common.currency_symbol')}</span>
                      {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
             </div>
          </div>

          {/* Messaging Section */}
          <div className="space-y-3 sm:space-y-4">
             <div className="flex items-center justify-between px-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900 uppercase tracking-tight">{t('order.chat_title', 'Messages')}</h3>
                <span className="px-2.5 py-1 bg-stone-200 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-stone-600">
                  {order.chat?.length || 0}
                </span>
             </div>
             <div className="bg-stone-100 rounded-3xl sm:rounded-[2.5rem] p-3 sm:p-4 min-h-[250px] sm:min-h-[300px] flex flex-col">
                <div className="flex-1 space-y-3 sm:space-y-4 overflow-y-auto max-h-[350px] sm:max-h-[400px] p-2 no-scrollbar">
                   {order.chat && order.chat.length > 0 ? (
                      order.chat.map((msg) => {
                        const isMe = msg.senderId === auth.currentUser?.uid;
                        return (
                          <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                            <div className={cn(
                              "max-w-[85%] sm:max-w-[80%] p-3 sm:p-4 rounded-2xl sm:rounded-[1.5rem] text-xs sm:text-sm font-medium",
                              isMe ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-stone-900 rounded-tl-none shadow-sm"
                            )}>
                              {msg.text}
                            </div>
                            <span className="text-[8px] font-bold text-stone-400 mt-1 uppercase tracking-widest">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        );
                      })
                   ) : (
                      <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-8 space-y-3">
                         <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-sm">
                            <MessageCircle className="w-6 h-6 sm:w-8 sm:h-8 text-stone-200" />
                         </div>
                         <p className="text-[10px] sm:text-xs font-bold text-stone-400 uppercase tracking-widest leading-relaxed">
                            {t('order.no_messages', 'No messages yet. Send a greeting!')}
                         </p>
                      </div>
                   )}
                   <div ref={chatEndRef} />
                </div>
                
                <div className="mt-3 sm:mt-4 flex gap-2">
                   <input 
                      type="text" 
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder={t('order.chat_placeholder', 'Type a message...')}
                      className="flex-1 bg-white border-transparent focus:ring-2 focus:ring-indigo-100 rounded-xl sm:2xl px-4 py-3 sm:px-5 sm:py-4 text-sm font-medium outline-none shadow-sm"
                   />
                   <button 
                      onClick={handleSendMessage}
                      disabled={!messageText.trim()}
                      className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-600 text-white rounded-xl sm:2xl shadow-xl shadow-indigo-100 flex items-center justify-center active:scale-95 disabled:opacity-50 shrink-0"
                   >
                      <Send className="w-5 h-5 sm:w-6 sm:h-6" />
                   </button>
                </div>
             </div>
          </div>

        </div>
      </div>

      <AnimatePresence>
        {showStatusPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-stone-900/40 backdrop-blur-md flex items-end justify-center"
            onClick={() => setShowStatusPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-xl bg-white rounded-t-[2.5rem] sm:rounded-t-[3rem] p-6 sm:p-8 space-y-5 sm:space-y-6"
              onClick={e => e.stopPropagation()}
            >
              <h4 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight text-center">{t('order.pick_status', 'Update Order Status')}</h4>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 pb-safe">
                 {(['confirmed', 'processing', 'out_for_delivery', 'completed', 'cancelled'] as OrderStatus[]).map((status) => (
                   <button
                    key={status}
                    onClick={() => handleUpdateStatus(status)}
                    className={cn(
                      "p-3 sm:p-4 rounded-xl sm:2xl flex flex-col items-center gap-2 border-2 transition-all",
                      order.status === status ? "bg-indigo-50 border-indigo-600" : "bg-stone-50 border-transparent hover:border-stone-200"
                    )}
                   >
                     {getStatusIcon(status)}
                     <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-center leading-tight">{getStatusLabel(status)}</span>
                   </button>
                 ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
