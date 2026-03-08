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

    // Check for share link in URL
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
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <ShoppingBag className="w-8 h-8 text-stone-400" />
        </motion.div>
      </div>
    );
  }

  if (!isFirebaseConfigured || error) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-stone-200 text-center space-y-6">
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
              {error || "Please configure your Firebase environment variables in the AI Studio Secrets panel to start using ShopShare."}
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
                  <span>Click <b>Get Started</b> if you haven't yet</span>
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-bottom border-stone-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-emerald-600" />
          <h1 className="text-xl font-semibold tracking-tight">ShopShare</h1>
        </div>
        {user && !user.isAnonymous && (
          <button 
            onClick={() => signOut(auth)}
            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <LogOut className="w-5 h-5 text-stone-500" />
          </button>
        )}
      </header>

      <main className="max-w-2xl mx-auto p-4">
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
                // Clear URL params
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
    await shoppingService.createList(userId, newListName, color);
    setNewListName('');
    setIsCreating(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-stone-500">My Lists</h2>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New List
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {lists.map((list) => (
          <motion.button
            key={list.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectList(list.id)}
            className={cn(
              "aspect-square p-4 rounded-2xl border flex flex-col justify-between text-left transition-shadow hover:shadow-lg",
              list.color || COLORS[0]
            )}
          >
            <div className="font-semibold text-lg leading-tight line-clamp-2">
              {list.name}
            </div>
            <div className="text-xs opacity-70">
              {new Date(list.updatedAt).toLocaleDateString()}
            </div>
          </motion.button>
        ))}
        {lists.length === 0 && !isCreating && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-stone-200 rounded-2xl">
            <p className="text-stone-400 text-sm">No lists yet. Create your first one!</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
          >
            <motion.form 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onSubmit={handleCreate}
              className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Create New List</h3>
                <button type="button" onClick={() => setIsCreating(false)}>
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              </div>
              <input 
                autoFocus
                type="text"
                placeholder="List name (e.g., Groceries)"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-4 py-2 rounded-xl text-stone-600 font-medium hover:bg-stone-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
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

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-stone-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-xl font-bold leading-tight">{list.name}</h2>
            {isShared && (
              <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Shared ({permission})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isShared && (
            <button 
              onClick={() => setShowShare(true)}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500"
            >
              <Share2 className="w-5 h-5" />
            </button>
          )}
          <div className="relative">
            <button 
              onClick={() => setShowOptions(!showOptions)}
              className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {showOptions && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowOptions(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-stone-100 z-30 overflow-hidden"
                  >
                    {!isShared && (
                      <button 
                        onClick={handleDeleteList}
                        className="w-full px-4 py-3 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete List
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setShowOptions(false);
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-stone-600 hover:bg-stone-50 flex items-center gap-2 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      Copy URL
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {permission === 'edit' && (
        <div className="relative">
          <form onSubmit={handleAddItem} className="flex gap-2">
            <div className="flex-1 relative">
              <input 
                ref={inputRef}
                type="text"
                placeholder="Add item..."
                value={newItemName}
                onChange={(e) => handleInputChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-20 overflow-hidden"
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
                        className="w-full px-4 py-2 text-left text-sm hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0"
                      >
                        {sug}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <input 
              type="text"
              placeholder="Qty"
              value={newItemQty}
              onChange={(e) => setNewItemQty(e.target.value)}
              className="w-20 px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            <button 
              type="submit"
              disabled={!newItemName.trim()}
              className="p-3 rounded-xl bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-6 h-6" />
            </button>
          </form>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <motion.div 
            layout
            key={item.id}
            className={cn(
              "group flex items-center justify-between p-4 rounded-2xl border transition-all",
              item.isBought ? "bg-stone-50 border-stone-100 opacity-60" : "bg-white border-stone-200 shadow-sm"
            )}
          >
            <div className="flex items-center gap-3 flex-1">
              <button 
                disabled={permission === 'read'}
                onClick={() => shoppingService.toggleItem(listId, item.id, !item.isBought)}
                className={cn(
                  "transition-colors",
                  item.isBought ? "text-emerald-500" : "text-stone-300 hover:text-stone-400"
                )}
              >
                {item.isBought ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
              </button>
              <div className="flex flex-col">
                <span className={cn(
                  "font-medium transition-all",
                  item.isBought && "line-through text-stone-400"
                )}>
                  {item.name}
                </span>
                {item.quantity && (
                  <span className="text-xs text-stone-500">{item.quantity}</span>
                )}
              </div>
            </div>
            {permission === 'edit' && (
              <button 
                onClick={() => shoppingService.deleteItem(listId, item.id)}
                className="p-2 text-stone-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </motion.div>
        ))}
        {items.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-stone-400 text-sm">List is empty</p>
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
    alert('Share link copied to clipboard!');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md space-y-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Share List</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 p-1 bg-stone-100 rounded-xl">
            <button 
              onClick={() => setPermission('read')}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                permission === 'read' ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"
              )}
            >
              Read Only
            </button>
            <button 
              onClick={() => setPermission('edit')}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                permission === 'edit' ? "bg-white shadow-sm text-stone-900" : "text-stone-500 hover:text-stone-700"
              )}
            >
              Can Edit
            </button>
          </div>

          <button 
            onClick={handleCreateShare}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            <LinkIcon className="w-4 h-4" />
            Generate Share Link
          </button>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400">Active Links</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {shares.map((share) => (
              <div key={share.id} className="flex items-center justify-between p-3 rounded-xl border border-stone-100 bg-stone-50">
                <div className="flex flex-col">
                  <span className="text-sm font-medium capitalize">{share.permission} Access</span>
                  <span className="text-[10px] text-stone-400">
                    {share.isActive ? 'Active' : 'Deactivated'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => copyShareLink(share.id)}
                    className="p-2 hover:bg-stone-200 rounded-lg transition-colors text-stone-600"
                    title="Copy Link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => shoppingService.toggleShareActive(share.id, !share.isActive)}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      share.isActive ? "text-emerald-600 hover:bg-emerald-100" : "text-stone-400 hover:bg-stone-200"
                    )}
                    title={share.isActive ? "Deactivate" : "Activate"}
                  >
                    <Circle className={cn("w-4 h-4", share.isActive && "fill-current")} />
                  </button>
                  <button 
                    onClick={() => shoppingService.deleteShare(share.id)}
                    className="p-2 hover:bg-rose-100 rounded-lg transition-colors text-rose-500"
                    title="Delete Link"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {shares.length === 0 && (
              <p className="text-center py-4 text-sm text-stone-400">No share links yet</p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
