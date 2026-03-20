import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  Search, 
  Package, 
  ArrowLeft, 
  ShoppingBag, 
  Edit2, 
  Trash2, 
  Check, 
  CircleDollarSign as DollarSign, 
  Loader2, 
  Save, 
  Box, 
  AlertCircle 
} from 'lucide-react';
import { Store, StoreProduct } from '../types';
import { storeService } from '../services/storeService';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { STORE_CATEGORIES, PRODUCT_CATEGORIES } from '../constants/categories';


interface ProductManagerProps {
  store: Store;
  onClose: () => void;
}

export const ProductManager: React.FC<ProductManagerProps> = ({ store, onClose }) => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    inStock: true,
    category: 'General',
    saleStart: '',
    saleEnd: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = storeService.subscribeToStoreProducts(store.id, (data) => {
      setProducts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [store.id]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      inStock: true,
      category: 'General',
      saleStart: '',
      saleEnd: ''
    });
    setEditingProduct(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setIsSubmitting(true);
    try {
      const submissionData: any = { ...formData };
      
      // Remove empty strings to prevent Firestore 'undefined' error
      if (formData.saleStart) {
        submissionData.saleStart = new Date(formData.saleStart).getTime();
      } else {
        delete submissionData.saleStart;
      }
      
      if (formData.saleEnd) {
        submissionData.saleEnd = new Date(formData.saleEnd).getTime();
      } else {
        delete submissionData.saleEnd;
      }

      if (editingProduct) {
        await storeService.updateProduct(editingProduct.id, submissionData);
      } else {
        await storeService.addProduct(store.id, submissionData);
      }
      resetForm();
    } catch (error) {
      console.error("Error managing product:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm(t('product_manager.delete_confirm'))) return;
    try {
      await storeService.deleteProduct(productId);
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const startEdit = (product: StoreProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price,
      inStock: product.inStock,
      category: product.category || 'General',
      saleStart: product.saleStart ? new Date(product.saleStart).toISOString().split('T')[0] : '',
      saleEnd: product.saleEnd ? new Date(product.saleEnd).toISOString().split('T')[0] : ''
    });
    setShowAddForm(true);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryTabs = [
    { key: 'all', label: t('merchant.categories.all'), value: 'All' },
    ...PRODUCT_CATEGORIES.map(cat => ({
      key: cat.key,
      label: t(`merchant.categories.${cat.key}`),
      value: cat.value
    }))
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] bg-white flex flex-col overflow-hidden"
    >
      {/* Premium Dark Header */}
      <div className="shrink-0 bg-stone-900 shadow-2xl z-30">
        <div className="w-full px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <button
              onClick={onClose}
              className="p-3 hover:bg-white/10 rounded-2xl transition-all group active:scale-90"
              title={t('merchant.dashboard')}
            >
              <ArrowLeft className="w-6 h-6 text-stone-400 group-hover:text-white transition-colors" />
            </button>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                <Package className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight leading-none">
                  {t('product_manager.inventory_title')}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">{store.name}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 h-12">
            <div className="relative flex-1 md:w-80 group h-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 group-focus-within:text-emerald-400 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('product_manager.search_placeholder')}
                className="w-full h-full pl-11 pr-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-stone-600 outline-none focus:border-emerald-500/50 focus:bg-white/10 transition-all text-sm font-bold"
              />
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="h-full flex items-center gap-2 px-6 bg-emerald-500 text-stone-900 font-black rounded-2xl hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 text-sm uppercase tracking-wider"
            >
              <Plus className="w-5 h-5 stroke-[3px]" />
              <span className="hidden sm:inline">{t('product_manager.add_product')}</span>
            </button>
          </div>
        </div>

        {/* Categories Tab Bar */}
        <div className="w-full px-6 border-t border-white/5 bg-stone-900/50 backdrop-blur-md">
          <div className="flex gap-8 overflow-x-auto no-scrollbar">
            {categoryTabs.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.value)}
                className={cn(
                  "py-4 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap border-b-2 transition-all relative",
                  activeCategory === cat.value 
                    ? 'text-emerald-400 border-emerald-400' 
                    : 'text-stone-500 border-transparent hover:text-stone-300'
                )}
              >
                {cat.label}
                {activeCategory === cat.value && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-400"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Catalog View */}
      <div className="flex-1 overflow-y-auto bg-stone-50 no-scrollbar relative">
        <div className="w-full p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <div className="w-16 h-16 border-4 border-stone-200 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">{t('product_manager.loading')}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-40 text-center"
            >
              <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-sm border border-stone-100 flex items-center justify-center mb-8">
                <Box className="w-10 h-10 text-stone-200" />
              </div>
              <h3 className="text-2xl font-black text-stone-900">{t('product_manager.empty_catalog')}</h3>
              <p className="text-stone-400 mt-2 font-medium">{t('product_manager.no_results')}</p>
              <button
                onClick={() => { setSearchQuery(''); setActiveCategory('All'); setShowAddForm(true); }}
                className="mt-8 px-8 py-4 bg-white text-emerald-600 font-black rounded-2xl border-2 border-emerald-100 hover:bg-emerald-50 transition-all shadow-sm"
              >
                {t('product_manager.first_product_btn')}
              </button>
            </motion.div>
          ) : (
            <motion.div 
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-8"
            >
              {filteredProducts.map((product) => (
                <motion.div
                  layout
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -8, scale: 1.02 }}
                  className="group bg-white rounded-[2.5rem] p-7 shadow-sm border border-stone-100 hover:shadow-3xl hover:shadow-stone-200/60 transition-all flex flex-col gap-6 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/[0.02] group-hover:to-transparent transition-all duration-700" />
                  
                  {/* Status Badge */}
                  <div className={cn(
                    "absolute top-6 right-6 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                    product.inStock 
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                      : "bg-rose-50 text-rose-500 border-rose-100"
                  )}>
                    {product.inStock ? t('merchant.in_stock') : t('merchant.out_of_stock')}
                  </div>
                  
                  <div className="flex items-start justify-between">
                    <div className={cn(
                      "w-20 h-20 rounded-3xl flex items-center justify-center transition-all duration-700 bg-stone-50 group-hover:bg-emerald-500 group-hover:rotate-6 shadow-sm group-hover:shadow-emerald-200 group-hover:shadow-xl",
                      !product.inStock && "grayscale opacity-50"
                    )}>
                      <ShoppingBag className={cn(
                        "w-10 h-10 transition-all duration-700",
                        product.inStock ? "text-stone-300 group-hover:text-white" : "text-stone-400"
                      )} />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                      <button
                        onClick={() => startEdit(product)}
                        className="p-3 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-all shadow-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-3 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all shadow-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-lg font-black text-stone-900 group-hover:text-emerald-600 transition-colors line-clamp-1">
                      {product.name}
                    </h4>
                    <p className="text-stone-400 text-sm font-medium line-clamp-2 leading-relaxed min-h-[2.5rem]">
                      {product.description || t('product_manager.no_description')}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="px-2 py-0.5 bg-stone-100 text-stone-500 text-[9px] font-black uppercase tracking-widest rounded-md">
                        {product.category || t('merchant.categories.general')}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-stone-50 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest leading-none mb-1">{t('product_manager.price')}</span>
                      <span className="text-2xl font-black text-stone-900 tracking-tight">
                        <span className="text-sm font-bold text-emerald-500 mr-0.5">{t('common.currency_symbol')}</span>
                        {product.price.toFixed(2)}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => storeService.updateProduct(product.id, { inStock: !product.inStock })}
                      className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border-2",
                        product.inStock 
                          ? "bg-white border-emerald-100 text-emerald-500 hover:bg-emerald-500 hover:text-white hover:border-emerald-500" 
                          : "bg-white border-stone-200 text-stone-300 hover:border-rose-500 hover:text-rose-500"
                      )}
                    >
                      <Check className="w-6 h-6 stroke-[3px]" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Product Form Overlay (Full Height Slide) */}
      <AnimatePresence>
        {showAddForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetForm}
              className="fixed inset-0 z-[140] bg-stone-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-[150] w-full max-w-xl bg-white shadow-[-20px_0_60px_rgba(0,0,0,0.1)] flex flex-col"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center border border-emerald-100">
                    <ShoppingBag className="w-7 h-7 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-stone-900 leading-none">
                      {editingProduct ? t('product_manager.edit_title') : t('product_manager.new_title')}
                    </h3>
                    <p className="text-stone-400 text-sm font-medium mt-1.5 uppercase tracking-widest">{t('product_manager.inventory_subtitle')}</p>
                  </div>
                </div>
                <button
                  onClick={resetForm}
                  className="p-3 hover:bg-stone-50 rounded-2xl transition-all active:scale-90"
                >
                  <X className="w-6 h-6 text-stone-300" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <div className="p-8 space-y-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">{t('product_manager.title_label')}</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={t('product_manager.title_placeholder')}
                        className="w-full px-7 py-5 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-[2rem] outline-none transition-all font-bold text-stone-900 text-lg placeholder:text-stone-300"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">{t('product_manager.price')}</label>
                        <div className="relative">
                          <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
                          <input
                            required
                            type="number"
                            step="0.01"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                            className="w-full pl-14 pr-7 py-5 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-[2rem] outline-none transition-all font-black text-stone-900 text-2xl"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">{t('product_manager.category_label')}</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full px-7 py-5 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-[2rem] outline-none transition-all font-bold text-stone-900 h-[72px] appearance-none cursor-pointer"
                        >
                          {PRODUCT_CATEGORIES.map(cat => (
                            <option key={cat.key} value={cat.value}>
                              {t(`merchant.categories.${cat.key}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">
                          {t('product_manager.sale_start', 'Sale Start')}
                        </label>
                        <input
                          type="date"
                          value={formData.saleStart}
                          onChange={(e) => setFormData({ ...formData, saleStart: e.target.value })}
                          className="w-full px-7 py-5 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-[2rem] outline-none transition-all font-bold text-stone-900"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">
                          {t('product_manager.sale_end', 'Sale End')}
                        </label>
                        <input
                          type="date"
                          value={formData.saleEnd}
                          onChange={(e) => setFormData({ ...formData, saleEnd: e.target.value })}
                          className="w-full px-7 py-5 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-[2rem] outline-none transition-all font-bold text-stone-900"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-stone-400 uppercase tracking-widest px-1">{t('product_manager.desc_label')}</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder={t('product_manager.desc_placeholder')}
                        className="w-full px-7 py-5 bg-stone-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-[2rem] outline-none transition-all font-medium text-stone-800 resize-none h-40 leading-relaxed placeholder:text-stone-300"
                      />
                    </div>

                    <div className="flex items-center justify-between p-6 bg-stone-50 rounded-[2rem] border border-stone-100">
                      <div>
                        <h4 className="font-black text-stone-900 text-sm uppercase tracking-widest">{t('product_manager.available_stock')}</h4>
                        <p className="text-xs text-stone-400 font-medium mt-1">{t('product_manager.visible_desc')}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, inStock: !formData.inStock })}
                        className={cn(
                          "w-16 h-9 rounded-full relative transition-all duration-300",
                          formData.inStock ? "bg-emerald-500 shadow-lg shadow-emerald-500/20" : "bg-stone-200"
                        )}
                      >
                        <motion.div
                          animate={{ x: formData.inStock ? 28 : 4 }}
                          className="w-7 h-7 bg-white rounded-full absolute top-1 shadow-sm"
                        />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-8 border-t border-stone-100 bg-white shrink-0">
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.name}
                    className="w-full py-6 bg-emerald-600 text-white font-black rounded-[2.5rem] shadow-2xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-4 disabled:opacity-50 disabled:scale-100"
                  >
                    {isSubmitting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Save className="w-7 h-7" />}
                    <span className="text-xl uppercase tracking-[0.15em]">{editingProduct ? t('product_manager.update_btn') : t('product_manager.add_inventory_btn')}</span>
                  </button>
                </div>
              </form>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="p-6 bg-stone-900 border-t border-white/5 flex items-center gap-4 px-8 text-stone-500 shrink-0">
        <AlertCircle className="w-5 h-5 shrink-0 text-emerald-500" />
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed max-w-4xl">
          {t('product_manager.warning_banner')}
        </p>
      </div>
    </motion.div>
  );
};
