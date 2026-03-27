import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  MapPin,
  ShoppingBag,
  Star,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Map as MapIcon,
  Store as StoreIcon,
  Clock,
  ArrowRight,
  Heart,
  Settings
} from 'lucide-react';
import { Store, AppUser } from '../types';
import { storeService } from '../services/storeService';
import { auth } from '../lib/firebase';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { STORE_CATEGORIES } from '../constants/categories';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from 'react-leaflet';
import L from 'leaflet';

// Fix for default Leaflet icon not showing correctly in React
// Using a custom SVG icon for a modern look
const createStoreIcon = (category: string, number?: number) => {
  const color = category === 'Grocery' ? '#10b981' :
    category === 'Pharmacy' ? '#f43f5e' :
      category === 'Apparel' ? '#6366f1' :
        '#78716c';

  return L.divIcon({
    className: 'custom-store-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 34px;
        height: 34px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        border: 2px solid white;
        transform: rotate(-45deg);
        margin-top: -17px;
        margin-left: -17px;
      ">
        <div style="transform: rotate(45deg); display: flex; align-items: center; justify-content: center;">
          ${number !== undefined ?
        `<span style="color: white; font-family: 'Inter', sans-serif; font-weight: 900; font-size: 14px; line-height: 1;">${number}</span>` :
        `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`
      }
        </div>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [0, 0]
  });
};

// Component to handle map bounds based on visible stores
const MapBoundsUpdater: React.FC<{ stores: Store[], userLocation: [number, number] | null }> = ({ stores, userLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (stores.length > 0) {
      const bounds = L.latLngBounds(stores.map(s => {
        const lat = s.location?.lat || 0;
        const lng = s.location?.lng || 0;
        return [lat, lng];
      }).filter(([lat, lng]) => lat !== 0 || lng !== 0));

      if (userLocation) {
        bounds.extend(userLocation);
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    } else if (userLocation) {
      map.setView(userLocation, 14);
    }
  }, [stores, map, userLocation]);

  return null;
};

// Component to center map on user location when it changes
const CenterMapOnUser: React.FC<{ location: [number, number] | null }> = ({ location }) => {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.flyTo(location, 14, { duration: 1.5 });
    }
  }, [location, map]);

  return null;
};

interface DiscoverStoresProps {
  onClose: () => void;
  onSelectStore: (storeId: string) => void;
  currentUser: any; // User | null
  appUser: AppUser | null;
  followedStoreIds: string[];
}

export const DiscoverStores: React.FC<DiscoverStoresProps> = ({
  onClose,
  onSelectStore,
  onShowMerchantDashboard,
  currentUser,
  appUser,
  followedStoreIds = []
}) => {
  const { t } = useTranslation();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState(false);

  const categoryOptions = [
    { key: 'all', label: t('merchant.categories.all'), value: 'All' },
    ...STORE_CATEGORIES.map(cat => ({
      key: cat.key,
      label: t(`merchant.categories.${cat.key}`),
      value: cat.value
    }))
  ];

  useEffect(() => {
    const unsubscribe = storeService.subscribeToAllStores((data) => {
      // Filter for active stores
      setStores(data.filter(s => s.status === 'active'));
      setLoading(false);
    });

    // Detect User Location
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setLocationError(false);
        },
        (error) => {
          console.warn("Geolocation error:", error);
          setLocationError(true);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    return () => unsubscribe();
  }, []);

  const handleToggleFollow = async (e: React.MouseEvent, storeId: string) => {
    e.stopPropagation(); // Don't navigate to store page
    if (!currentUser) {
      alert(t('auth.login_required'));
      return;
    }

    const isFollowing = followedStoreIds.includes(storeId);
    try {
      if (isFollowing) {
        await storeService.unfollowStore(storeId, currentUser.uid);
      } else {
        await storeService.followStore(storeId, currentUser.uid);
      }
    } catch (error) {
      console.error("Failed to toggle follow:", error);
    }
  };

  const filteredStores = stores.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-screen w-full bg-stone-50 overflow-hidden relative">
      {/* Map Section (Upper Half) */}
      <div className="h-[45%] w-full relative shrink-0 bg-stone-100 group overflow-hidden">
        <MapContainer
          center={userLocation || [0, 0]}
          zoom={userLocation ? 14 : 2}
          className="w-full h-full grayscale-[0.2] group-hover:opacity-100 duration-700 z-0"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBoundsUpdater stores={filteredStores} userLocation={userLocation} />
          <CenterMapOnUser location={userLocation} />

          {userLocation && (
            <Marker
              position={userLocation}
              icon={L.divIcon({
                className: 'user-location-marker',
                html: `<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg pulse-animation"></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })}
            />
          )}

          {filteredStores.map((store, index) => {
            if (!store.location?.lat || !store.location?.lng) return null;
            return (
              <Marker
                key={store.id}
                position={[store.location.lat, store.location.lng]}
                icon={createStoreIcon(store.category, index + 1)}
                eventHandlers={{
                  click: () => onSelectStore(store.id),
                }}
              >
                <Popup className="custom-popup">
                  <div className="p-1">
                    <h4 className="font-bold text-stone-900 text-sm">{store.name}</h4>
                    <p className="text-[10px] text-stone-500 font-medium">{store.category}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        <div className="absolute inset-0 bg-gradient-to-t from-stone-50/80 to-transparent pointer-events-none z-10" />

        {/* Back Button Overlay */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-3 bg-white/95 backdrop-blur-md hover:bg-stone-900 hover:text-white rounded-2xl transition-all border border-stone-100 shadow-xl z-20 group/back flex items-center gap-2"
        >
          <ChevronLeft className="w-5 h-5 text-stone-400 group-hover/back:text-white transition-all duration-300" />
          <span className="text-[10px] font-black uppercase tracking-widest pr-1 hidden sm:inline">{t('common.back')}</span>
        </button>

        {/* Map Controls / Labels */}
        <div className="absolute top-4 right-4 z-10 hidden sm:block">
          <div className="flex items-center gap-3 bg-white/95 backdrop-blur-md p-2 px-4 rounded-2xl border border-stone-100 shadow-xl">
            <div className="w-8 h-8 bg-stone-900 rounded-xl flex items-center justify-center">
              <MapIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-[10px] font-black text-stone-900 tracking-tight leading-none uppercase">{t('discover_stores.title')}</h2>
              <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest mt-0.5">
                {t('discover_stores.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Location Status */}
        {locationError && (
          <div className="absolute bottom-4 right-4 z-20 bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border border-rose-100 shadow-lg">
            {t('merchant.location_error')}
          </div>
        )}
      </div>

      {/* List Section (Lower Half) */}
      <div className="flex-1 flex flex-col min-h-0 bg-white shadow-[0_-20px_40px_rgba(0,0,0,0.03)] z-10 rounded-t-[2.5rem] -mt-6">
        {/* Filter Bar */}
        <div className="px-6 py-6 sm:px-8 flex flex-col sm:flex-row gap-3 sm:items-center border-b border-stone-50 bg-white/50 backdrop-blur-sm sticky top-0 shrink-0">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300 transition-colors group-focus-within:text-stone-900" />
            <input
              type="text"
              placeholder={t('discover_stores.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-stone-50 border-transparent focus:bg-white border-2 focus:border-stone-900/10 rounded-2xl outline-none transition-all font-bold text-xs text-stone-900"
            />
          </div>

          <div className="relative sm:w-48 shrink-0">
            <button
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className="w-full flex items-center justify-between pl-11 pr-4 py-3 bg-stone-50 border-transparent hover:bg-stone-100 rounded-2xl transition-all font-black text-[10px] text-stone-900 group whitespace-nowrap uppercase tracking-widest"
            >
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 group-hover:text-stone-900 transition-colors" />
              <span className="truncate pr-2">
                {categoryOptions.find(c => c.value === activeCategory)?.label}
              </span>
              <ChevronDown className={cn("w-3.5 h-3.5 text-stone-300 transition-transform duration-300 shrink-0", isCategoryOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isCategoryOpen && (
                <>
                  <div className="fixed inset-0 z-[130]" onClick={() => setIsCategoryOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-white border border-stone-100 rounded-[2rem] shadow-2xl z-[140] overflow-hidden"
                  >
                    <div className="max-h-60 overflow-y-auto no-scrollbar">
                      {categoryOptions.map(cat => (
                        <button
                          key={cat.key}
                          onClick={() => {
                            setActiveCategory(cat.value);
                            setIsCategoryOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-5 py-3 rounded-xl text-[9px] uppercase tracking-widest font-black transition-all",
                            activeCategory === cat.value
                              ? "bg-stone-900 text-white"
                              : "text-stone-400 hover:text-stone-900 hover:bg-stone-50"
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 pt-4 space-y-4 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-stone-100 border-t-stone-900 rounded-full animate-spin" />
              <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest">{t('discover_stores.loading')}</p>
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-stone-100 rounded-[2.5rem] bg-white">
              <div className="w-16 h-16 bg-stone-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <StoreIcon className="w-8 h-8 text-stone-100" />
              </div>
              <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">{t('discover_stores.no_results')}</p>
            </div>
          ) : (
            <div className="grid gap-4 w-full pb-10">
              {filteredStores.map((store, index) => {
                const isOwnStore = currentUser && store.ownerId === currentUser.uid;
                const storeNumber = index + 1;

                return (
                  <motion.div
                    key={store.id}
                    layout
                    onClick={() => onSelectStore(store.id)}
                    className={cn(
                      "p-3.5 sm:p-5 bg-white border rounded-[2.2rem] shadow-sm hover:shadow-2xl hover:shadow-stone-200/50 transition-all cursor-pointer group flex items-center justify-between gap-3 sm:gap-6 w-full overflow-hidden relative",
                      isOwnStore ? "border-emerald-500 bg-emerald-50/10 shadow-lg shadow-emerald-500/5" : "border-stone-50"
                    )}
                  >
                    {/* Store Number Badge */}
                    <div className={cn(
                      "absolute top-0 left-0 w-8 h-8 flex items-center justify-center rounded-br-2xl text-[10px] font-black text-white shadow-sm",
                      store.category === 'Grocery' ? "bg-emerald-500" :
                        store.category === 'Pharmacy' ? "bg-rose-500" :
                          store.category === 'Apparel' ? "bg-indigo-500" :
                            "bg-stone-500"
                    )}>
                      {storeNumber}
                    </div>

                    <div className="flex items-center gap-3 sm:gap-5 min-w-0 flex-1 pl-2">
                      <div className={cn(
                        "w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 duration-500",
                        store.category === 'Grocery' ? "bg-emerald-50 text-emerald-600" :
                          store.category === 'Pharmacy' ? "bg-rose-50 text-rose-600" :
                            store.category === 'Apparel' ? "bg-indigo-50 text-indigo-600" :
                              "bg-stone-50 text-stone-600"
                      )}>
                        <ShoppingBag className="w-6 h-6 sm:w-7 sm:h-7" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-black text-stone-900 text-base sm:text-lg truncate tracking-tight">{store.name}</h4>
                          <div className="flex items-center gap-1.5">
                            {isOwnStore && (
                              <span className="px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest rounded-lg underline decoration-white/30">
                                {t('common.your_store')}
                              </span>
                            )}
                            {store.isVerified && (
                              <div className="p-0.5 bg-emerald-500 rounded-full shrink-0">
                                <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 sm:gap-3 text-[10px] sm:text-xs font-bold text-stone-400">
                          <div className="flex items-center gap-1 text-amber-500">
                            <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                            <span>{store.averageRating?.toFixed(1) || '0.0'}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-1 text-indigo-500">
                            <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            <span>{t('store_front.followers_count', { count: store.followersCount || 0 })}</span>
                          </div>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline uppercase text-[9px] tracking-widest opacity-60">{store.category}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {isOwnStore ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onShowMerchantDashboard();
                          }}
                          className="h-10 sm:h-12 px-4 sm:px-6 bg-emerald-500 text-white rounded-2xl flex items-center gap-2 font-black text-[9px] sm:text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                        >
                          <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden xs:inline">{t('merchant.settings')}</span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleToggleFollow(e, store.id)}
                          className={cn(
                            "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all",
                            followedStoreIds.includes(store.id)
                              ? "bg-rose-50 text-rose-600 shadow-sm"
                              : "bg-stone-50 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                          )}
                        >
                          <Heart className={cn("w-4 h-4 sm:w-5 sm:h-5 transition-all", followedStoreIds.includes(store.id) && "fill-current scale-110")} />
                        </button>
                      )}
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-stone-50 rounded-2xl flex items-center justify-center group-hover:bg-stone-900 group-hover:text-white transition-all">
                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 translate-x-0 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-5 bg-white border-t border-stone-50 flex items-center justify-between shrink-0 rounded-b-[2.5rem]">
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-stone-300" />
          <p className="text-[10px] font-black text-stone-300 uppercase tracking-widest leading-none">
            {t('discover_stores.footer')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-6 w-px bg-stone-100" />
          <p className="text-[10px] font-black text-stone-900 uppercase tracking-widest flex items-center gap-2">
            <StoreIcon className="w-3.5 h-3.5" />
            {t('common.stores_found', { count: filteredStores.length })}
          </p>
        </div>
      </div>
    </div>
  );
};
