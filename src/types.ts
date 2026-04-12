export type Permission = 'read' | 'edit';

export interface ShoppingList {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  color: string;
  icon?: string;
  sharedUsers?: string[];
  totalItems?: number;
  boughtItems?: number;
  lastUpdatedBy?: string;
}

export interface ListItem {
  id: string;
  name: string;
  isBought: boolean;
  quantity: string;
  createdAt: number;
  emoji?: string;
  unit?: string;
  price?: number;
  category?: string;
  storeId?: string;
  storeName?: string;
  productId?: string;
}

export interface ShareLink {
  id: string;
  listId: string; // If type is 'collection', this refers to the ownerId instead
  type?: 'list' | 'collection';
  permission: Permission;
  isActive: boolean;
  createdAt: number;
}

export interface UserSuggestion {
  name: string;
  count: number;
}

export interface FuelBatch {
  id: string;
  a: number; // amount
  r: number; // remaining
  ea: number; // expiresAt
  ca: number; // createdAt
  t: 'reward' | 'purchase' | 'coupon'; // type

  /** @deprecated Use abbreviated keys (a, r, ea, ca, t) */
  amount?: number;
  /** @deprecated Use abbreviated keys (a, r, ea, ca, t) */
  remaining?: number;
  /** @deprecated Use abbreviated keys (a, r, ea, ca, t) */
  expiresAt?: number;
  /** @deprecated Use abbreviated keys (a, r, ea, ca, t) */
  createdAt?: number;
  /** @deprecated Use abbreviated keys (a, r, ea, ca, t) */
  type?: string;
}

export interface PushToken {
  token: string;
  platform: 'android' | 'ios' | 'web';
  createdAt: number;
}

export interface AppUser {
  uid: string;
  fl: number; // current total fuel level
  ldrd?: string; // lastDailyRewardDay
  ldra?: number; // lastDailyRewardAt
  laa?: number; // lastActionAt
  isAdmin?: boolean;
  isMerchant?: boolean;
  preferences?: string[];
  followedStores?: string[];
  ownedStores?: string[];
  fcmTokens?: PushToken[];
  fuelBatches?: FuelBatch[]; // Primary batch storage

  /** @deprecated Use fl */
  fuelLevel?: number;
  /** @deprecated Use fl and fuelBatches */
  coinBalance?: number;
  /** @deprecated Use fuelBatches */
  coinBatches?: any[];
  /** @deprecated Use laa */
  lastActionAt?: number;
  /** @deprecated Use ldrd */
  lastDailyRewardDay?: string;
  /** @deprecated Use ldra */
  lastDailyRewardAt?: number;
  freeCouponClaimed?: boolean;
}

export interface Coupon {
  id: string; // Document ID is the code
  code: string;
  fuelAmount: number;
  isConsumed: boolean;
  consumedBy: string | null;
  createdAt: number;
}

export interface LoyaltyCard {
  id: string;
  name: string;
  provider: string;
  cardNumber: string;
  barcodeType: string; // MLKit BarcodeFormat (e.g. 'CODE_128', 'QR_CODE', 'EAN_13')
  color: string;
  icon?: string;
  ownerId: string;
  createdAt: number;
}

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  category: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  isVerified: boolean;
  status: 'pending' | 'active' | 'rejected';
  createdAt: number;
  updatedAt: number;
  followersCount?: number;
  workingHours?: string;
  contactPhone?: string;
  website?: string;
  themeColor?: string;
  bannerUrl?: string;
  logoUrl?: string;
  followers?: string[];
  averageRating?: number;
  ratingCount?: number;
  directOrderEnabled?: boolean;
}

export const DAYS_OF_WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = typeof DAYS_OF_WEEK[number];

export interface DailySchedule {
  isOpen: boolean;
  open: string;
  close: string;
}
export interface StoreProduct {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  inStock: boolean;
  category: string;
  saleStart?: number;
  saleEnd?: number;
  likesCount: number;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'out_for_delivery' | 'completed' | 'cancelled';

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: number;
}

export interface Order {
  id: string;
  storeId: string;
  storeName: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  deliveryTime?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
  chat?: ChatMessage[];
}
