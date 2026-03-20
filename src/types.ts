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

export interface CoinBatch {
  id: string;
  amount: number;
  remaining: number;
  expiresAt: number;
  createdAt: number;
  type: 'reward' | 'purchase' | 'coupon';
}

export interface AppUser {
  uid: string;
  coinBalance: number;
  coinBatches?: CoinBatch[];
  isAdmin?: boolean;
  isMerchant?: boolean;
  preferences?: string[];
  lastActionAt?: number;
  freeCouponClaimed?: boolean;
  fcmTokens?: string[];
}

export interface Coupon {
  id: string; // Document ID is the code
  code: string;
  coinsAmount: number;
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
  createdAt: number;
  updatedAt: number;
}
