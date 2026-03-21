import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Force clears application cache and reloads.
 * @param options - Configure what to clear
 */
export async function forceClearCache(options: {
  clearStorage?: boolean;
  reload?: boolean;
} = { clearStorage: true, reload: true }) {
  try {
    console.log("forceClearCache: Starting clean up...", options);

    // 1. Clear Storage (Optional - LocalStorage / SessionStorage)
    if (options.clearStorage) {
      localStorage.clear();
      sessionStorage.clear();
    }

    // 2. Clear Caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // 3. Unregister Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    }

    // 4. Clear IndexedDB (Optional)
    if (options.clearStorage && 'indexedDB' in window) {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          try {
            window.indexedDB.deleteDatabase(db.name);
          } catch (e) {
            console.warn(`Failed to delete DB ${db.name}`);
          }
        }
      }
    }

    // 5. Reload if requested
    if (options.reload) {
      // Use cache-busting query param
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString());
      window.location.replace(url.toString());
    }

    return true;
  } catch (err) {
    console.error("Failed to clear cache:", err);
    if (options.reload) {
      window.location.reload();
    }
    return false;
  }
}
