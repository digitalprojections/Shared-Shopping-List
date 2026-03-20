export const STORE_CATEGORIES = [
  { key: 'grocery', value: 'Grocery' },
  { key: 'halaal', value: 'Halaal' },
  { key: 'organic', value: 'Organic' },
  { key: 'pharmacy', value: 'Pharmacy' },
  { key: 'electronics', value: 'Electronics' },
  { key: 'fashion', value: 'Fashion' },
  { key: 'home', value: 'Home' },
  { key: 'pets', value: 'Pets' },
  { key: 'beauty', value: 'Beauty' },
  { key: 'sports', value: 'Sports' }
] as const;

export const PRODUCT_CATEGORIES = [
  { key: 'general', value: 'General' },
  { key: 'grocery', value: 'Grocery' },
  { key: 'bakery', value: 'Bakery' },
  { key: 'butchery', value: 'Butchery' },
  { key: 'dairy', value: 'Dairy' },
  { key: 'electronics', value: 'Electronics' },
  { key: 'home', value: 'Home' },
  { key: 'pharmacy', value: 'Pharmacy' }
] as const;

export type StoreCategory = typeof STORE_CATEGORIES[number]['value'];
export type ProductCategory = typeof PRODUCT_CATEGORIES[number]['value'];
