import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Package, 
  DollarSign, 
  Tag as TagIcon, 
  Check, 
  AlertCircle,
  Save,
  Loader2
} from 'lucide-react';
import { Store, StoreProduct } from '../types';
import { storeService } from '../services/storeService';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

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
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    inStock: true,
    category: 'General'
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
      category: 'General'
    });
    setEditingProduct(null);
    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setIsSubmitting(true);
    try {
      if (editingProduct) {
        await storeService.updateProduct(editingProduct.id, formData);
      } else {
        await storeService.addProduct(store.id, formData);
      }
      resetForm();
    } catch (error) {
      console.error("Error managing product:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;
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
      category: product.category || 'General'
    });
    setShowAddForm(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                { editingProduct ? 'Edit Product' : 'Manage Inventory' }
              </h2>
              <p className="text-stone-400 text-sm font-medium">{store.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        {/* Form Overlay */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-8 border-b border-stone-100 bg-stone-50 overflow-hidden"
            >
              <form onSubmit={handleSubmit} className="py-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">
                      {t('merchant.product_name')}
                    </label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium"
                      placeholder="e.g. Organic Milk"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">
                      {t('merchant.price')}
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        required
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-1.5 ml-1">
                    {t('merchant.description')}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium h-24 resize-none"
                    placeholder="Short description of the product..."
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-all",
                        formData.inStock ? "bg-emerald-500 border-emerald-500 shadow-md shadow-emerald-100" : "bg-white border-stone-200"
                      )}>
                        {formData.inStock && <Check className="w-4 h-4 text-white stroke-[3px]" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={formData.inStock}
                        onChange={(e) => setFormData({ ...formData, inStock: e.target.checked })}
                      />
                      <span className="text-sm font-bold text-stone-700">{t('merchant.in_stock')}</span>
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-6 py-3 text-stone-500 font-bold hover:bg-stone-100 rounded-2xl transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-8 py-3 bg-stone-900 text-white font-bold rounded-2xl hover:bg-stone-800 transition-all flex items-center gap-2"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      <span>{ editingProduct ? 'Update Product' : 'Add to Inventory' }</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          { !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 py-6 mb-8 border-2 border-dashed border-stone-100 rounded-3xl text-stone-400 font-bold hover:border-indigo-200 hover:text-indigo-600 transition-all hover:bg-indigo-50 group"
            >
              <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
              <span>Add New Product to Inventory</span>
            </button>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-8 h-8 text-stone-200 animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 bg-stone-50 rounded-3xl flex items-center justify-center mx-auto">
                <Package className="w-8 h-8 text-stone-200" />
              </div>
              <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">No products in inventory</p>
            </div>
          ) : (
            <div className="space-y-4">
              {products.map(product => (
                <div 
                  key={product.id}
                  className="p-4 bg-white border border-stone-100 rounded-3xl flex items-center justify-between gap-4 group hover:border-indigo-100 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0",
                      product.inStock ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    )}>
                      <TagIcon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-stone-900 truncate">{product.name}</h4>
                        { !product.inStock && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-md">
                            OUT OF STOCK
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-stone-400">
                        <span className="text-emerald-600">${product.price.toFixed(2)}</span>
                        <span>•</span>
                        <span className="truncate">{product.category || 'General'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(product)}
                      className="p-3 text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-3 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-stone-50 border-t border-stone-100 flex items-center gap-3 px-8 text-stone-400 shrink-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="text-[10px] font-bold uppercase tracking-widest">
            Products are listed on your store page immediately. Make sure prices are accurate.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
