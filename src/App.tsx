import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Share2, 
  Trash2, 
  CheckCircle2, 
  Circle, 
  ChevronLeft, 
  Copy, 
  Link as LinkIcon,
  X,
  MoreVertical,
  LogOut,
  ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, isFirebaseConfigured } from './lib/firebase';
import { 
  signInAnonymously, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import { shoppingService } from './services/shoppingService';
import { ShoppingList, ListItem, ShareLink, Permission } from './types';
import { cn } from './lib/utils';

// --- Components ---

const COLORS = [
  'bg-rose-100 border-rose-200 text-rose-700',
  'bg-amber-100 border-amber-200 text-amber-700',
  'bg-emerald-100 border-emerald-200 text-emerald-700',
  'bg-sky-100 border-sky-200 text-sky-700',
  'bg-indigo-100 border-indigo-200 text-indigo-700',
  'bg-violet-100 border-violet-200 text-violet-700',
  'bg-fuchsia-100 border-fuchsia-200 text-fuchsia-700',
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [sharedListId, setSharedListId] = useState<string | null>(null);
  const [sharedPermission, setSharedPermission] = useState<Permission>('read');

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    
    if (shareId) {
      shoppingService.getShare(shareId).then(share => {
        if (share && share.isActive) {
          setSharedListId(share.listId);
          setSharedPermission(share.permission);
          setActiveListId(share.listId);
        }
      }).catch(err => {
        console.error("Error fetching share:", err);
        setError("Could not load shared list. Please check your configuration.");
      });
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (!u && !shareId) {
        signInAnonymously(auth).catch(err => {
          console.error("Auth error:", err);
          if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
            setError("Firebase Auth is not enabled. Please enable 'Anonymous' sign-in in your Firebase Console.");
          } else {
            setError(err.message);
          }
        });
      }
    }, (err) => {
      console.error("Auth state change error:", err);
      setError("Firebase connection failed. Check your API keys.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 10, -10, 0]
          }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <ShoppingBag className="w-12 h-12 text-emerald-600" />
        </motion.div>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-stone-400 font-medium"
        >
          Loading your lists...
        </motion.p>
      </div>
    );
  }

  if (!isFirebaseConfigured || error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-stone-200 text-center space-y-6"
        >
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto",
            error ? "bg-rose-100" : "bg-amber-100"
          )}>
            {error ? <X className="w-8 h-8 text-rose-600" /> : <LinkIcon className="w-8 h-8 text-amber-600" />}
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-stone-900">
              {error ? "Configuration Error" : "Setup Required"}
            </h2>
            <p className="text-stone-500">
              {error || "Please configure your Firebase environment variables to start using ShopShare."}
            </p>
          </div>
          
          {error && (
            <div className="text-left space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400">Checklist:</h4>
              <ul className="text-sm text-stone-600 space-y-2">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>Go to <b>Authentication</b> tab in Firebase Console</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>Enable <b>Anonymous</b> sign-in provider</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>Ensure <b>Firestore</b> is created in Test Mode</span>
                </li>
              </ul>
            </div>
          )}

          {!error && (
            <div className="bg-stone-50 p-4 rounded-xl text-left text-xs font-mono text-stone-600 overflow-x-auto">
              VITE_FIREBASE_API_KEY<br/>
              VITE_FIREBASE_AUTH_DOMAIN<br/>
              VITE_FIREBASE_PROJECT_ID<br/>
              ...
            </div>
          )}
          
          <p className="text-xs text-stone-400">
            {error ? "After fixing, refresh this page." : "Check the .env.example file for the full list of required variables."}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-emerald-100">
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-xl border-b border-stone-200/60 px-4 py-4 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => {
              setActiveListId(null);
              setSharedListId(null);
              window.history.replaceState({}, '', window.location.pathname);
            }}
          >
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-stone-900 to-stone-600">
              ShopShare
            </h1>
          </motion.div>
          
          <div className="flex items-center gap-4">
            {user && !user.isAnonymous && (
              <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => signOut(auth)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </motion.button>
            )}
            <div className="w-8 h-8 rounded-full bg-stone-200 border-2 border-white shadow-sm overflow-hidden">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                alt="avatar" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          {!activeListId ? (
            <Dashboard 
              userId={user?.uid || ''} 
              onSelectList={setActiveListId} 
            />
          ) : (
            <ListView 
              listId={activeListId} 
              onBack={() => {
                setActiveListId(null);
                setSharedListId(null);
                window.history.replaceState({}, '', window.location.pathname);
              }}
              isShared={!!sharedListId}
              permission={sharedListId ? sharedPermission : 'edit'}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function Dashboard({ userId, onSelectList }: { userId: string, onSelectList: (id: string) => void }) {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState('');

  useEffect(() => {
    if (!userId) return;
    return shoppingService.subscribeToLists(userId, setLists);
  }, [userId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const id = await shoppingService.createList(userId, newListName, color);
    setNewListName('');
    setIsCreating(false);
    if (id) onSelectList(id);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900">Your Collections</h2>
          <p className="text-stone-500 mt-1">Organize and share your shopping needs.</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCreating(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-semibold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          Create New List
        </motion.button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {lists.map((list, index) => (
          <motion.div
            key={list.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -4 }}
            className="group relative"
          >
            <button
              onClick={() => onSelectList(list.id)}
              className={cn(
                "w-full aspect-[4/3] p-6 rounded-[2.5rem] border-2 flex flex-col justify-between text-left transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-emerald-900/5",
                list.color || COLORS[0]
              )}
            >
              <div className="space-y-2">
                <div className="w-12 h-12 bg-white/40 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  <ShoppingBag className="w-6 h-6 opacity-80" />
                </div>
                <h3 className="font-bold text-2xl leading-tight line-clamp-2">
                  {list.name}
                </h3>
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs font-bold uppercase tracking-widest opacity-60">
                  {new Date(list.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <div className="p-2 bg-white/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronLeft className="w-5 h-5 rotate-180" />
                </div>
              </div>
            </button>
          </motion.div>
        ))}
        
        {lists.length === 0 && !isCreating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full py-20 flex flex-col items-center justify-center border-4 border-dashed border-stone-200 rounded-[3rem] bg-stone-50/50"
          >
            <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="w-10 h-10 text-stone-300" />
            </div>
            <p className="text-stone-400 font-medium text-lg">No lists found. Start fresh!</p>
            <button 
              onClick={() => setIsCreating(true)}
              className="mt-4 text-emerald-600 font-bold hover:underline"
            >
              Create your first list
            </button>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
          >
            <motion.form 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onSubmit={handleCreate}
              className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-stone-900">New Collection</h3>
                <button 
                  type="button" 
                  onClick={() => setIsCreating(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-stone-400 ml-1">List Name</label>
                <input 
                  autoFocus
                  type="text"
                  placeholder="e.g., Weekend Camping"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl border-2 border-stone-100 bg-stone-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-lg font-medium"
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-6 py-4 rounded-2xl text-stone-600 font-bold hover:bg-stone-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!newListName.trim()}
                  className="flex-1 px-6 py-4 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 transition-all"
                >
                  Create
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ListView({ 
  listId, 
  onBack, 
  isShared, 
  permission 
}: { 
  listId: string, 
  onBack: () => void, 
  isShared: boolean,
  permission: Permission
}) {
  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    shoppingService.getList(listId).then(setList);
    return shoppingService.subscribeToItems(listId, setItems);
  }, [listId]);

  const handleAddItem = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newItemName.trim() || permission === 'read') return;
    await shoppingService.addItem(listId, newItemName, newItemQty);
    setNewItemName('');
    setNewItemQty('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleInputChange = async (val: string) => {
    setNewItemName(val);
    if (val.length >= 2) {
      const sugs = await shoppingService.getSuggestions(val);
      setSuggestions(sugs);
    } else {
      setSuggestions([]);
    }
  };

  const handleDeleteList = async () => {
    if (window.confirm('Are you sure you want to delete this list?')) {
      await shoppingService.deleteList(listId);
      onBack();
    }
  };

  if (!list) return null;

  const boughtCount = items.filter(i => i.isBought).length;
  const progress = items.length > 0 ? (boughtCount / items.length) * 100 : 0;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.1, x: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="p-3 bg-white hover:bg-stone-100 rounded-2xl shadow-sm border border-stone-200 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold text-stone-900">{list.name}</h2>
              {isShared && (
                <span className="text-[10px] uppercase tracking-widest font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                  {permission}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex-1 h-2 w-32 bg-stone-200 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  className="h-full bg-emerald-500"
                />
              </div>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                {boughtCount}/{items.length} Items
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 self-end md:self-auto">
          {!isShared && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowShare(true)}
              className="flex items-center gap-2 px-5 py-3 bg-white border border-stone-200 rounded-2xl font-bold text-stone-700 shadow-sm hover:shadow-md transition-all"
            >
              <Share2 className="w-5 h-5" />
              Share
            </motion.button>
          )}
          <div className="relative">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowOptions(!showOptions)}
              className="p-3 bg-white border border-stone-200 rounded-2xl shadow-sm hover:shadow-md transition-all"
            >
              <MoreVertical className="w-6 h-6 text-stone-500" />
            </motion.button>
            <AnimatePresence>
              {showOptions && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowOptions(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-3 w-56 bg-white rounded-[1.5rem] shadow-2xl border border-stone-100 z-50 overflow-hidden"
                  >
                    {!isShared && (
                      <button 
                        onClick={handleDeleteList}
                        className="w-full px-5 py-4 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                        Delete Collection
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setShowOptions(false);
                      }}
                      className="w-full px-5 py-4 text-left text-sm font-bold text-stone-600 hover:bg-stone-50 flex items-center gap-3 transition-colors"
                    >
                      <Copy className="w-5 h-5" />
                      Copy Link
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {permission === 'edit' && (
        <motion.div 
          layout
          className="relative group"
        >
          <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <input 
                ref={inputRef}
                type="text"
                placeholder="What do we need?"
                value={newItemName}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-full px-6 py-4 rounded-[1.5rem] border-2 border-stone-100 bg-white focus:outline-none focus:border-emerald-500 shadow-sm focus:shadow-emerald-500/10 transition-all text-lg font-medium"
              />
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-stone-100 rounded-[1.5rem] shadow-2xl z-50 overflow-hidden"
                  >
                    {suggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setNewItemName(sug);
                          setSuggestions([]);
                          inputRef.current?.focus();
                        }}
                        className="w-full px-6 py-4 text-left text-base font-medium hover:bg-emerald-50 hover:text-emerald-700 transition-colors border-b border-stone-50 last:border-0"
                      >
                        {sug}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex gap-3">
              <input 
                type="text"
                placeholder="Qty"
                value={newItemQty}
                onChange={(e) => setNewItemQty(e.target.value)}
                className="w-full sm:w-24 px-6 py-4 rounded-[1.5rem] border-2 border-stone-100 bg-white focus:outline-none focus:border-emerald-500 shadow-sm transition-all text-lg font-medium"
              />
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={!newItemName.trim()}
                className="p-4 rounded-[1.5rem] bg-emerald-600 text-white disabled:opacity-50 shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 transition-all"
              >
                <Plus className="w-8 h-8" />
              </motion.button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div 
              layout
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "group flex items-center justify-between p-5 rounded-[2rem] border-2 transition-all duration-300",
                item.isBought 
                  ? "bg-stone-50 border-stone-100 opacity-60" 
                  : "bg-white border-stone-100 shadow-sm hover:shadow-md hover:border-emerald-100"
              )}
            >
              <div className="flex items-center gap-5 flex-1">
                <motion.button 
                  whileTap={{ scale: 0.8 }}
                  disabled={permission === 'read'}
                  onClick={() => shoppingService.toggleItem(listId, item.id, !item.isBought)}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all border-2",
                    item.isBought 
                      ? "bg-emerald-500 border-emerald-500 text-white" 
                      : "bg-white border-stone-200 text-transparent hover:border-emerald-400"
                  )}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </motion.button>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-xl font-bold transition-all",
                    item.isBought && "line-through text-stone-400"
                  )}>
                    {item.name}
                  </span>
                  {item.quantity && (
                    <span className="text-sm font-bold text-stone-400 uppercase tracking-widest">{item.quantity}</span>
                  )}
                </div>
              </div>
              {permission === 'edit' && (
                <motion.button 
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => shoppingService.deleteItem(listId, item.id)}
                  className="p-3 text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </motion.button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        
        {items.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-24 h-24 bg-stone-100 rounded-[2.5rem] flex items-center justify-center">
              <ShoppingBag className="w-10 h-10 text-stone-300" />
            </div>
            <div className="space-y-1">
              <p className="text-stone-900 font-bold text-xl">Your list is empty</p>
              <p className="text-stone-400">Add some items to get started!</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showShare && (
          <ShareModal 
            listId={listId} 
            onClose={() => setShowShare(false)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ShareModal({ listId, onClose }: { listId: string, onClose: () => void }) {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [permission, setPermission] = useState<Permission>('read');

  useEffect(() => {
    return shoppingService.subscribeToShares(listId, setShares);
  }, [listId]);

  const handleCreateShare = async () => {
    await shoppingService.createShareLink(listId, permission);
  };

  const copyShareLink = (shareId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?share=${shareId}`;
    navigator.clipboard.writeText(url);
    // Simple toast-like feedback could be added here
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white p-8 rounded-[3rem] shadow-2xl w-full max-w-lg space-y-8"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-stone-900">Share Collection</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3 p-2 bg-stone-100 rounded-[1.5rem]">
            <button 
              onClick={() => setPermission('read')}
              className={cn(
                "flex-1 py-3 rounded-2xl text-sm font-bold transition-all",
                permission === 'read' ? "bg-white shadow-md text-emerald-600" : "text-stone-500 hover:text-stone-700"
              )}
            >
              Read Only
            </button>
            <button 
              onClick={() => setPermission('edit')}
              className={cn(
                "flex-1 py-3 rounded-2xl text-sm font-bold transition-all",
                permission === 'edit' ? "bg-white shadow-md text-emerald-600" : "text-stone-500 hover:text-stone-700"
              )}
            >
              Can Edit
            </button>
          </div>

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreateShare}
            className="w-full py-5 rounded-[1.5rem] bg-emerald-600 text-white font-bold shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-3"
          >
            <LinkIcon className="w-5 h-5" />
            Generate Access Link
          </motion.button>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-stone-400 ml-1">Active Links</h4>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {shares.map((share) => (
              <motion.div 
                layout
                key={share.id} 
                className="flex items-center justify-between p-5 rounded-[1.5rem] border-2 border-stone-50 bg-stone-50/50"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-widest text-stone-900">{share.permission} Access</span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest mt-1",
                    share.isActive ? "text-emerald-500" : "text-stone-400"
                  )}>
                    {share.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => copyShareLink(share.id)}
                    className="p-3 bg-white hover:bg-stone-100 rounded-xl shadow-sm border border-stone-200 transition-all text-stone-600"
                    title="Copy Link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => shoppingService.toggleShareActive(share.id, !share.isActive)}
                    className={cn(
                      "p-3 rounded-xl shadow-sm border transition-all",
                      share.isActive 
                        ? "bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100" 
                        : "bg-white border-stone-200 text-stone-400 hover:bg-stone-100"
                    )}
                    title={share.isActive ? "Deactivate" : "Activate"}
                  >
                    <CheckCircle2 className={cn("w-4 h-4", !share.isActive && "opacity-20")} />
                  </button>
                  <button 
                    onClick={() => shoppingService.deleteShare(share.id)}
                    className="p-3 bg-white hover:bg-rose-50 rounded-xl shadow-sm border border-stone-200 transition-all text-rose-500"
                    title="Delete Link"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
            {shares.length === 0 && (
              <div className="text-center py-8 bg-stone-50 rounded-[1.5rem] border-2 border-dashed border-stone-200">
                <p className="text-sm font-bold text-stone-400">No active share links</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
