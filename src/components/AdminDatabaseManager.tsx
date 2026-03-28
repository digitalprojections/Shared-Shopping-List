import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Shield, 
  Trash2, 
  MapPin, 
  User as UserIcon,
  Check,
  AlertCircle,
  Database,
  Store as StoreIcon,
  Crown,
  Save
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppUser, Store } from '../types';
import { adminService } from '../services/adminService';
import { cn } from '../lib/utils';
import { COLORS } from '../constants';

interface AdminDatabaseManagerProps {
  onClose: () => void;
}

export const AdminDatabaseManager: React.FC<AdminDatabaseManagerProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'users' | 'orphans'>('users');
  
  // Tab: Users
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedUser, setSearchedUser] = useState<AppUser | null>(null);
  const [recentUsers, setRecentUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);

  // Tab: Orphans
  const [orphanedStores, setOrphanedStores] = useState<Store[]>([]);
  const [loadingOrphans, setLoadingOrphans] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'users') {
      loadRecentUsers();
    } else if (activeTab === 'orphans') {
      loadOrphanedStores();
    }
  }, [activeTab]);

  const loadRecentUsers = async () => {
    setLoadingUsers(true);
    const result = await adminService.getRecentUsers();
    setRecentUsers(result.users);
    setLoadingUsers(false);
  };

  const handleSearchUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoadingUsers(true);
    const user = await adminService.searchUserById(searchQuery.trim());
    setSearchedUser(user);
    if (user) {
      setEditUser({ ...user });
    }
    setLoadingUsers(false);
  };

  const handleSaveUser = async () => {
    if (!editUser) return;
    setSavingUser(true);
    const success = await adminService.updateUserField(editUser.uid, editUser);
    if (success) {
      setSearchedUser(editUser);
      // Also update in recent users if it's there
      setRecentUsers(prev => prev.map(u => u.uid === editUser.uid ? editUser : u));
      alert(t('admin.save_success', 'User updated successfully!'));
    } else {
      alert(t('admin.save_error', 'Failed to update user.'));
    }
    setSavingUser(false);
  };

  const loadOrphanedStores = async () => {
    setLoadingOrphans(true);
    try {
      const stores = await adminService.findOrphanedStores();
      setOrphanedStores(stores);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOrphans(false);
    }
  };

  const handleDeleteOrphan = async (storeId: string) => {
    if (!window.confirm(t('admin.delete_orphan_confirm', 'Delete this orphaned store entirely and unconditionally?'))) return;
    setProcessingId(storeId);
    try {
      await adminService.deleteOrphanedStore(storeId);
      setOrphanedStores(prev => prev.filter(s => s.id !== storeId));
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSelectRecentUser = (u: AppUser) => {
    setSearchedUser(u);
    setEditUser({ ...u });
    setSearchQuery(u.uid);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-stone-200"
      >
        {/* Header */}
        <div className="p-6 md:p-8 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/50">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100 shadow-inner">
              <Database className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                {t('admin.database_manager', 'Database Manager')}
              </h2>
              <p className="text-stone-500 text-sm font-medium">{t('admin.db_subtitle', 'Manage users and clean data')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-stone-100 rounded-full transition-colors group">
            <X className="w-6 h-6 text-stone-400 group-hover:text-stone-600" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-8 pt-4 flex gap-8 border-b border-stone-100 shrink-0 bg-stone-50/30">
          <button
            onClick={() => setActiveTab('users')}
            className={cn(
              "pb-4 text-sm font-bold transition-all relative flex items-center gap-2",
              activeTab === 'users' ? "text-indigo-600" : "text-stone-400 hover:text-stone-600"
            )}
          >
            <UserIcon className="w-4 h-4" />
            {t('admin.tab_users', 'User Lookup')}
            {activeTab === 'users' && <motion.div layoutId="dbtab" className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-600 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveTab('orphans')}
            className={cn(
              "pb-4 text-sm font-bold transition-all relative flex items-center gap-2",
              activeTab === 'orphans' ? "text-rose-600" : "text-stone-400 hover:text-stone-600"
            )}
          >
            <Shield className="w-4 h-4" />
            {t('admin.tab_orphans', 'Orphan Sweeper')}
            {activeTab === 'orphans' && <motion.div layoutId="dbtab" className="absolute bottom-0 left-0 right-0 h-1 bg-rose-600 rounded-full" />}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 no-scrollbar relative min-h-[300px]">
          {activeTab === 'users' && (
            <div className="space-y-8">
              <form onSubmit={handleSearchUser} className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-stone-400" />
                <input
                  type="text"
                  placeholder={t('admin.lookup_placeholder', 'Enter exact User ID to search...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-16 pr-32 py-5 rounded-[2rem] border-2 border-stone-100 bg-stone-50 focus:bg-white focus:border-indigo-300 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-stone-900 tracking-wide text-lg shadow-inner"
                />
                <button 
                  type="submit"
                  disabled={loadingUsers || !searchQuery.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-6 py-3 bg-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-indigo-200"
                >
                  {loadingUsers ? t('admin.searching', 'Searching...') : t('admin.search_btn', 'Lookup')}
                </button>
              </form>

              {loadingUsers && !searchedUser ? (
                 <div className="flex justify-center py-10 opacity-50">
                   <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                 </div>
              ) : editUser ? (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white border-2 border-indigo-100 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-100/20">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <UserIcon className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-stone-900 mb-1">{editUser.uid.slice(0, 10)}...</h3>
                        <p className="text-stone-400 font-mono text-xs">{editUser.uid}</p>
                      </div>
                    </div>
                    {editUser.isAdmin && <div className="px-4 py-1.5 bg-amber-100 text-amber-700 text-xs font-black uppercase tracking-widest rounded-full flex items-center gap-2"><Crown className="w-4 h-4"/> Admin</div>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Fuel Control */}
                    <div className="space-y-3">
                      <label className="text-xs font-black text-stone-400 uppercase tracking-widest ml-2 flex items-center gap-2">
                        Fuel Level <Database className="w-3 h-3"/>
                      </label>
                      <input 
                        type="number"
                        value={editUser.fl || editUser.fuelLevel || editUser.coinBalance || 0}
                        onChange={(e) => setEditUser({...editUser, fl: parseInt(e.target.value) || 0})}
                        className="w-full px-5 py-4 rounded-2xl bg-stone-50 border-2 border-stone-100 focus:bg-white focus:border-indigo-400 text-xl font-bold transition-all"
                      />
                    </div>

                    {/* Flags */}
                    <div className="space-y-4 pt-1">
                      <label className="text-xs font-black text-stone-400 uppercase tracking-widest ml-2">Access Privileges</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-3 p-4 border-2 border-stone-100 rounded-2xl flex-1 cursor-pointer hover:border-indigo-200 transition-colors bg-stone-50">
                          <input 
                            type="checkbox"
                            checked={editUser.isMerchant || false}
                            onChange={(e) => setEditUser({...editUser, isMerchant: e.target.checked})}
                            className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="font-bold text-stone-700">Merchant</span>
                        </label>
                        <label className="flex items-center gap-3 p-4 border-2 border-amber-100 rounded-2xl flex-1 cursor-pointer hover:border-amber-300 transition-colors bg-amber-50/30">
                          <input 
                            type="checkbox"
                            checked={editUser.isAdmin || false}
                            onChange={(e) => setEditUser({...editUser, isAdmin: e.target.checked})}
                            className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500"
                          />
                          <span className="font-bold text-amber-900">Admin</span>
                        </label>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="md:col-span-2 flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                      <div className="flex items-center gap-6">
                        <div className="space-y-1 text-center border-r border-stone-200 pr-6">
                          <div className="text-2xl font-black text-stone-900">{editUser.ownedStores?.length || 0}</div>
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Stores</div>
                        </div>
                        <div className="space-y-1 text-center border-r border-stone-200 pr-6">
                          <div className="text-2xl font-black text-stone-900">{editUser.followedStores?.length || 0}</div>
                          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Follows</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-stone-900 mt-2">Activity</div>
                          <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest">
                            {new Date(editUser.laa || Date.now()).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={handleSaveUser}
                        disabled={savingUser}
                        className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center gap-3 min-w-[160px] justify-center"
                      >
                        {savingUser ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"/> : <><Save className="w-5 h-5"/> Save</>}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                searchQuery && <p className="text-center text-stone-400 py-4 font-bold">User not found with exactly this UID.</p>
              )}

              {/* Recent Users list */}
              {!searchedUser && recentUsers.length > 0 && (
                <div className="pt-6">
                  <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4 ml-2">Recent Users ({recentUsers.length})</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentUsers.map(u => (
                      <button 
                        key={u.uid}
                        onClick={() => handleSelectRecentUser(u)}
                        className="p-4 bg-stone-50 border border-stone-100 rounded-2xl text-left hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group flex items-start gap-4"
                      >
                        <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                          <UserIcon className="w-5 h-5 text-stone-400 group-hover:text-indigo-500" />
                        </div>
                        <div className="overflow-hidden min-w-0">
                          <p className="font-bold text-stone-900 text-sm truncate">{u.uid}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {u.isMerchant && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase rounded-sm">Merchant</span>}
                            {u.isAdmin && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase rounded-sm">Admin</span>}
                            <span className="text-[10px] text-stone-400 truncate">{new Date(u.laa || Date.now()).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'orphans' && (
            <div className="space-y-6">
              <div className="bg-rose-50 border-2 border-rose-100 rounded-3xl p-6 flex items-start gap-4">
                <div className="p-3 bg-rose-200 rounded-2xl text-rose-700 shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-rose-900 text-lg mb-1">Unattended Store Sweeper</h3>
                  <p className="text-rose-700/80 text-sm font-medium leading-relaxed max-w-2xl">
                    Lists all stores where the <code className="bg-rose-200/50 px-1 py-0.5 rounded font-bold text-rose-900">ownerId</code> does not match any existing user in the database. 
                    Deleting these stores cleans up wasted space and unlinks orphaned products.
                  </p>
                </div>
              </div>

              {loadingOrphans ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-stone-50 rounded-3xl border border-stone-100">
                  <div className="w-12 h-12 border-4 border-stone-200 border-t-rose-500 rounded-full animate-spin" />
                  <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Scanning Firebase...</p>
                </div>
              ) : orphanedStores.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200 text-center">
                  <div className="w-16 h-16 bg-white rounded-[1.5rem] shadow-sm flex items-center justify-center mb-4">
                    <Check className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h4 className="text-xl font-bold text-stone-900 mb-1">Database is Clean</h4>
                  <p className="text-stone-500 text-sm">No unattended stores detected in the current index.</p>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-4 px-2">
                    <h4 className="font-black text-stone-900 uppercase tracking-widest text-sm">
                      Found {orphanedStores.length} Orphan(s)
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence>
                      {orphanedStores.map(store => (
                        <motion.div 
                          layout
                          key={store.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="bg-white border-2 border-stone-100 hover:border-rose-200 rounded-3xl p-5 shadow-sm transition-all flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-black uppercase text-[9px] rounded-full tracking-widest">Orphan</span>
                              <span className="text-[10px] text-stone-400 font-mono py-0.5 truncate">store: {store.id}</span>
                            </div>
                            <h5 className="font-bold text-stone-900 truncate text-lg">{store.name || 'Unnamed Store'}</h5>
                            <div className="text-xs text-stone-500 truncate flex items-center gap-1.5 mt-1">
                              <UserIcon className="w-3.5 h-3.5" /> owner: <span className="font-mono text-[10px]">{store.ownerId}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteOrphan(store.id)}
                            disabled={!!processingId}
                            className="w-12 h-12 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-2xl flex items-center justify-center transition-all disabled:opacity-50 shrink-0 shadow-sm"
                          >
                            {processingId === store.id ? (
                              <div className="w-5 h-5 border-2 border-rose-300 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="w-5 h-5" />
                            )}
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
