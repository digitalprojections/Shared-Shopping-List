import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Force clears all application cache, local storage, session storage,
 * service workers, and IndexedDB data, then reloads the page.
 */
export async function forceClearCache() {
  try {
    // 1. Clear Storage
    localStorage.clear();
    sessionStorage.clear();

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

    // 4. Clear IndexedDB (using Dexie if available)
    // You might want to import your db instance here if you want to wipe it too
    // For a generic approach, we can try to find all IDs and delete them
    if ('indexedDB' in window) {
      const dbs = await window.indexedDB.databases();
      dbs.forEach(db => {
        if (db.name) window.indexedDB.deleteDatabase(db.name);
      });
    }

    // 5. Hard reload to fetch fresh assets
    window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
  } catch (err) {
    console.error("Failed to clear cache:", err);
    // Fallback reload
    window.location.reload();
  }
}
