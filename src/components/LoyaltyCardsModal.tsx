import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  Trash2, 
  CreditCard, 
  ChevronRight, 
  Scan,
  Store,
  Palette,
  Edit2,
  Check,
  ShoppingBag,
  Tag,
  Gift,
  Coffee,
  Car,
  Smartphone,
  Heart,
  Star,
  Ticket,
  Zap,
  Package
} from 'lucide-react';
import { loyaltyService } from '../services/loyaltyService';
import { LoyaltyCard } from '../types';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Ocr } from '@capacitor-community/image-to-text';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface LoyaltyCardsModalProps {
  userId: string;
  initialCard?: LoyaltyCard | null;
  onClose: () => void;
}

import bwipjs from 'bwip-js';

const CARD_COLORS = [
  'bg-emerald-500', 
  'bg-rose-500', 
  'bg-amber-500', 
  'bg-sky-500', 
  'bg-indigo-500', 
  'bg-violet-500', 
  'bg-fuchsia-500',
  'bg-stone-800',
];

export const LOYALTY_ICONS = {
  'credit-card': CreditCard,
  'store': Store,
  'shopping-bag': ShoppingBag,
  'tag': Tag,
  'gift': Gift,
  'coffee': Coffee,
  'car': Car,
  'smartphone': Smartphone,
  'heart': Heart,
  'star': Star,
  'ticket': Ticket,
  'zap': Zap,
  'package': Package
};

export const IconComponent: React.FC<{ iconId?: string, className?: string }> = ({ iconId, className }) => {
  const Icon = (iconId && LOYALTY_ICONS[iconId as keyof typeof LOYALTY_ICONS]) || CreditCard;
  return <Icon className={className} />;
};

const BwipBarcode: React.FC<{ value: string, format: string, scale?: number, height?: number }> = ({ value, format, scale = 3, height = 15 }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    if (!canvasRef.current) return;

    let bcid = 'code128';
    if (format === 'EAN_13') bcid = 'ean13';
    else if (format === 'UPC_A') bcid = 'upca';
    else if (format === 'UPC_E') bcid = 'upce';
    else if (format === 'EAN_8') bcid = 'ean8';
    else if (format === 'QR_CODE') bcid = 'qrcode';
    else if (format === 'PDF_417') bcid = 'pdf417';
    else if (format === 'DATA_MATRIX') bcid = 'datamatrix';
    else if (format === 'ITF') bcid = 'interleaved2of5';
    else if (format === 'CODE_39') bcid = 'code39';
    else if (format === 'CODE_93') bcid = 'code93';
    else if (format === 'CODABAR') bcid = 'rationalizedCodabar';

    const renderBarcode = (id: string, text: string) => {
      bwipjs.toCanvas(canvasRef.current!, {
        bcid: id,
        text: text,
        alttext: text,
        scale: scale,
        height: (id === 'qrcode' || id === 'datamatrix' || id === 'pdf417') ? 0 : height,
        includetext: true,
        textxalign: 'center',
        backgroundcolor: 'FFFFFF',
      });
    };

    try {
      renderBarcode(bcid, value);
    } catch (e) {
      console.warn("Barcode generation failed for format", bcid, e, "- falling back to code128");
      try {
        renderBarcode('code128', value);
      } catch (fallbackError) {
        console.error("Barcode fallback failed:", fallbackError);
      }
    }
  }, [value, format]);

  return (
    <div className="w-full bg-white p-6 rounded-2xl shadow-inner border border-stone-100 flex flex-col items-center justify-center">
      <canvas ref={canvasRef} className="max-w-full h-auto object-contain" />
    </div>
  );
};

export const LoyaltyCardsModal: React.FC<LoyaltyCardsModalProps> = ({ userId, initialCard, onClose }) => {
  const { t } = useTranslation();
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeCard, setActiveCard] = useState<LoyaltyCard | null>(initialCard || null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showZoomedBarcode, setShowZoomedBarcode] = useState(false);

  // Form state
  const [newCard, setNewCard] = useState({
    provider: '',
    name: '',
    cardNumber: '',
    barcodeType: 'CODE_128',
    color: 'bg-emerald-500',
    icon: 'credit-card'
  });

  const startScan = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert(t('loyalty.mobile_only_scan'));
      return;
    }

    try {
      const { barcodes } = await BarcodeScanner.scan({
        formats: [BarcodeFormat.Code128, BarcodeFormat.Ean13, BarcodeFormat.QrCode, BarcodeFormat.UpcA],
      });

      if (barcodes.length > 0) {
        setNewCard(prev => ({ 
          ...prev, 
          cardNumber: barcodes[0].displayValue,
          barcodeType: barcodes[0].format || 'CODE_128'
        }));
      }
    } catch (e) {
      console.error("Scan error:", e);
      alert(t('loyalty.scan_error'));
    }
  };

  const startOCR = async () => {
    if (!Capacitor.isNativePlatform()) {
      alert(t('loyalty.mobile_only_ocr'));
      return;
    }

    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.Uri
      });

      if (photo.path) {
        const { textDetections } = await Ocr.detectText({
          filename: photo.path,
        });
        
        const combinedText = textDetections.map(d => d.text).join(' ');
        const numberMatch = combinedText.match(/\d{5,20}/);
        if (numberMatch) {
          setNewCard(prev => ({ ...prev, cardNumber: numberMatch[0] }));
        } else if (textDetections.length > 0) {
          setNewCard(prev => ({ ...prev, cardNumber: textDetections[0].text.trim() }));
        }
      }
    } catch (e) {
      console.error("OCR error:", e);
      alert(t('loyalty.ocr_error'));
    }
  };

  useEffect(() => {
    return loyaltyService.subscribeToCards(userId, (data) => {
      setCards(data);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    if (initialCard) {
      setActiveCard(initialCard);
      setShowAddForm(false);
    }
  }, [initialCard]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.provider || !newCard.cardNumber) return;

    try {
      await loyaltyService.addCard(userId, {
        name: newCard.name || newCard.provider,
        provider: newCard.provider,
        cardNumber: newCard.cardNumber,
        barcodeType: newCard.barcodeType,
        color: newCard.color,
        icon: newCard.icon
      });
      setNewCard({ provider: '', name: '', cardNumber: '', barcodeType: 'CODE_128', color: 'bg-emerald-500', icon: 'credit-card' });
      setShowAddForm(false);
    } catch (err: any) {
      alert(err.message || t('loyalty.save_error'));
    }
  };

  const startEdit = () => {
    if (!activeCard) return;
    setNewCard({
      provider: activeCard.provider,
      name: activeCard.name || '',
      cardNumber: activeCard.cardNumber,
      barcodeType: activeCard.barcodeType,
      color: activeCard.color,
      icon: activeCard.icon || 'credit-card'
    });
    setIsEditing(true);
  };

  const handleUpdateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCard || !newCard.provider || !newCard.cardNumber) return;

    await loyaltyService.updateCard(activeCard.id, {
      name: newCard.name || newCard.provider,
      provider: newCard.provider,
      cardNumber: newCard.cardNumber,
      barcodeType: newCard.barcodeType,
      color: newCard.color,
      icon: newCard.icon
    });

    setIsEditing(false);
    setActiveCard({
      ...activeCard,
      name: newCard.name || newCard.provider,
      provider: newCard.provider,
      cardNumber: newCard.cardNumber,
      barcodeType: newCard.barcodeType,
      color: newCard.color,
      icon: newCard.icon
    });
  };

  const handleDeleteCard = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!id) return;
    
    if (window.confirm(t('loyalty.remove_confirm'))) {
      try {
        await loyaltyService.deleteCard(userId, id);
        if (initialCard) {
          onClose();
        } else {
          setActiveCard(null);
        }
      } catch (err) {
        console.error("Delete error:", err);
        alert(t('loyalty.delete_error'));
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-stone-900/40 backdrop-blur-md p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="bg-stone-50 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        <header className="p-6 sm:p-8 flex items-center justify-between sticky top-0 bg-stone-50/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-stone-100">
              <CreditCard className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">{t('loyalty.title')}</h2>
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{t('loyalty.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all">
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-10">
          <AnimatePresence mode="wait">
            {activeCard ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8 py-4"
              >
                <button 
                  onClick={() => {
                    if (isEditing) {
                      setIsEditing(false);
                    } else {
                      setActiveCard(null);
                    }
                  }}
                  className="flex items-center gap-2 text-stone-400 font-bold text-sm hover:text-stone-600 mb-4"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  {isEditing ? t('loyalty.back_to_card') : t('loyalty.back_to_all')}
                </button>

                {isEditing ? (
                  <form onSubmit={handleUpdateCard} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">{t('loyalty.store_name')}</label>
                      <input
                        type="text"
                        required
                        placeholder={t('loyalty.provider_placeholder')}
                        value={newCard.provider}
                        onChange={e => setNewCard({...newCard, provider: e.target.value})}
                        className="w-full px-6 py-4 bg-white border-2 border-stone-100 rounded-2xl font-bold focus:border-emerald-500 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">{t('loyalty.card_number_label')}</label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          required
                          placeholder={t('loyalty.card_number_placeholder')}
                          value={newCard.cardNumber}
                          onChange={e => setNewCard({...newCard, cardNumber: e.target.value})}
                          className="flex-1 px-6 py-4 bg-white border-2 border-stone-100 rounded-2xl font-bold focus:border-emerald-500 outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={startScan}
                          className="px-4 bg-emerald-100 text-emerald-600 rounded-2xl border-2 border-emerald-100 hover:border-emerald-200 transition-all flex items-center justify-center shrink-0"
                        >
                          <Scan className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">{t('loyalty.card_color')}</label>
                      <div className="flex flex-wrap gap-3 px-2">
                        {CARD_COLORS.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewCard({...newCard, color: c})}
                            className={cn(
                              "w-10 h-10 rounded-xl transition-all border-4",
                              c,
                              newCard.color === c ? "border-white shadow-lg scale-110" : "border-transparent opacity-60"
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">{t('loyalty.pick_icon')}</label>
                      <div className="grid grid-cols-6 gap-3 px-2">
                        {Object.keys(LOYALTY_ICONS).map(iconId => (
                          <button
                            key={iconId}
                            type="button"
                            onClick={() => setNewCard({...newCard, icon: iconId})}
                            className={cn(
                              "w-10 h-10 rounded-xl transition-all border-2 flex items-center justify-center",
                              newCard.icon === iconId ? "bg-stone-900 border-stone-900 text-white shadow-lg scale-110" : "bg-white border-stone-100 text-stone-400 hover:bg-stone-50"
                            )}
                          >
                            <IconComponent iconId={iconId} className="w-5 h-5" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="flex-1 py-4 bg-stone-200 text-stone-600 font-bold rounded-2xl"
                      >
                        {t('dashboard.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200"
                      >
                        {t('loyalty.save_changes')}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className={cn(
                      "aspect-[1.6/1] w-full rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-stone-200",
                      activeCard.color
                    )}>
                      <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">{t('loyalty.store_card')}</p>
                            <h3 className="text-3xl font-black tracking-tight">{activeCard.name || activeCard.provider}</h3>
                          </div>
                          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                            <IconComponent iconId={activeCard.icon} className="w-8 h-8" />
                          </div>
                        </div>
                        
                        <div className="mt-8">
                           <button onClick={() => setShowZoomedBarcode(true)} className="w-full text-left bg-white/5 hover:bg-white/10 transition-colors rounded-2xl cursor-zoom-in" title={t('loyalty.tap_to_enlarge')}>
                             <BwipBarcode value={activeCard.cardNumber} format={activeCard.barcodeType} />
                           </button>
                        </div>
                      </div>
                      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                    </div>

                    <div className="bg-white rounded-[2rem] p-6 border border-stone-100 shadow-sm space-y-4">
                       <div className="flex items-center gap-4 text-stone-600">
                          <Scan className="w-5 h-5" />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{t('loyalty.card_number')}</p>
                            <p className="font-mono font-bold">{activeCard.cardNumber}</p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                         <button
                          onClick={startEdit}
                          className="flex-1 py-4 rounded-2xl bg-stone-50 text-stone-600 font-bold text-sm hover:bg-stone-100 transition-colors flex items-center justify-center gap-2"
                         >
                           <Edit2 className="w-4 h-4" />
                           {t('loyalty.edit_card')}
                         </button>
                         <button 
                          onClick={(e) => handleDeleteCard(e, activeCard.id)}
                          className="flex-1 py-4 rounded-2xl bg-rose-50 text-rose-600 font-bold text-sm hover:bg-rose-100 transition-colors flex items-center justify-center gap-2"
                         >
                           <Trash2 className="w-4 h-4" />
                           {t('loyalty.remove_card', { coin: t('admin.coin') })}
                         </button>
                       </div>
                    </div>
                  </>
                )}
              </motion.div>
            ) : showAddForm ? (
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                onSubmit={handleAddCard}
                className="space-y-6 py-4"
              >
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">{t('loyalty.store_name')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('loyalty.provider_placeholder')}
                    value={newCard.provider}
                    onChange={e => setNewCard({...newCard, provider: e.target.value})}
                    className="w-full px-6 py-4 bg-white border-2 border-stone-100 rounded-2xl font-bold focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">{t('loyalty.card_number_label')}</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      required
                      placeholder={t('loyalty.card_number_placeholder')}
                      value={newCard.cardNumber}
                      onChange={e => setNewCard({...newCard, cardNumber: e.target.value})}
                      className="flex-1 px-6 py-4 bg-white border-2 border-stone-100 rounded-2xl font-bold focus:border-emerald-500 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={startScan}
                      className="px-4 bg-emerald-100 text-emerald-600 rounded-2xl border-2 border-emerald-100 hover:border-emerald-200 transition-all flex items-center justify-center shrink-0"
                      title="Scan Barcode"
                    >
                      <Scan className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={startOCR}
                      className="px-4 bg-sky-100 text-sky-600 rounded-2xl border-2 border-sky-100 hover:border-sky-200 transition-all flex items-center justify-center shrink-0"
                      title="Scan Text (OCR)"
                    >
                      <Plus className="w-5 h-5 rotate-45" />
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1 ml-2">{t('loyalty.scan_help')}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">{t('loyalty.card_color')}</label>
                  <div className="flex flex-wrap gap-3 px-2">
                    {CARD_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCard({...newCard, color: c})}
                        className={cn(
                          "w-10 h-10 rounded-xl transition-all border-4",
                          c,
                          newCard.color === c ? "border-white shadow-lg scale-110" : "border-transparent opacity-60"
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">{t('loyalty.pick_icon')}</label>
                  <div className="grid grid-cols-6 gap-3 px-2">
                    {Object.keys(LOYALTY_ICONS).map(iconId => (
                      <button
                        key={iconId}
                        type="button"
                        onClick={() => setNewCard({...newCard, icon: iconId})}
                        className={cn(
                          "w-10 h-10 rounded-xl transition-all border-2 flex items-center justify-center",
                          newCard.icon === iconId ? "bg-stone-900 border-stone-900 text-white shadow-lg scale-110" : "bg-white border-stone-100 text-stone-400 hover:bg-stone-50"
                        )}
                      >
                        <IconComponent iconId={iconId} className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-4 bg-stone-200 text-stone-600 font-bold rounded-2xl"
                  >
                    {t('dashboard.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200"
                  >
                    {t('loyalty.save_card')}
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4 py-4"
              >
                <div className="flex items-center justify-between mb-2 px-2">
                   <h3 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">{t('loyalty.saved_cards')}</h3>
                   <button 
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-1.5 text-xs font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg"
                   >
                     <Plus className="w-3.5 h-3.5" />
                     {t('loyalty.add_new', { coin: t('admin.coin') })}
                   </button>
                </div>

                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-24 bg-stone-100 rounded-3xl animate-pulse" />)}
                  </div>
                ) : cards.length === 0 ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-stone-100 rounded-[2rem] flex items-center justify-center mx-auto">
                      <CreditCard className="w-10 h-10 text-stone-300" />
                    </div>
                    <div className="max-w-[240px] mx-auto">
                      <p className="text-stone-900 font-bold">{t('loyalty.no_cards')}</p>
                      <p className="text-stone-400 text-sm mt-1">{t('loyalty.no_cards_desc')}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {cards.map(card => (
                      <motion.button
                        key={card.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveCard(card)}
                        className={cn(
                          "w-full p-6 h-24 rounded-3xl text-left text-white flex items-center justify-between relative overflow-hidden shadow-lg",
                          card.color
                        )}
                      >
                        <div className="relative z-10">
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-0.5">{card.provider}</p>
                          <h4 className="text-xl font-black truncate max-w-[160px]">{card.name || card.provider}</h4>
                        </div>
                        <div className="relative z-10 flex items-center gap-4">
                          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                            <IconComponent iconId={card.icon} className="w-6 h-6" />
                          </div>
                          <ChevronRight className="w-6 h-6" />
                        </div>
                        {/* Subtle patterns */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
                      </motion.button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {showZoomedBarcode && activeCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-white flex flex-col items-center justify-center p-8"
          >
            <button
              onClick={() => setShowZoomedBarcode(false)}
              className="absolute top-6 right-6 p-4 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors z-50 shadow-lg"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="flex items-center justify-center overflow-hidden" style={{ transform: 'rotate(90deg)', width: '100vh', height: '100vw' }}>
              <div className="w-[80vh] max-w-4xl bg-white p-12 rounded-[3rem] shadow-2xl border border-stone-100 flex items-center justify-center">
                <BwipBarcode 
                  value={activeCard.cardNumber} 
                  format={activeCard.barcodeType} 
                  scale={5} 
                  height={30} 
                />
              </div>
            </div>
            <div className="absolute bottom-12 w-full text-center px-8">
              <p className="text-xl font-black text-stone-300 uppercase tracking-[0.3em]">{t('loyalty.tap_to_close', 'Tap X to close')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
