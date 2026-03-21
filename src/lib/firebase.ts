import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import { getFunctions, Functions } from "firebase/functions";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getMessaging, Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isFirebaseConfigured = !!firebaseConfig.apiKey;

let app: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let functionsInstance: Functions | null = null;
let messagingInstance: Messaging | null = null;

if (isFirebaseConfigured) {
  try {
    const debugInfo = `Project ID: ${firebaseConfig.projectId || 'MISSING'}`;
    console.log("[Firebase] Initializing with", debugInfo);
    
    app = initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    functionsInstance = getFunctions(app);
    
    // Check if browser supports messaging
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      messagingInstance = getMessaging(app);
    }

    if (!firebaseConfig.projectId) {
      console.error("[Firebase] CRITICAL: Project ID is missing from environment variables!");
    }
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}


export const db = dbInstance as Firestore;
export const auth = authInstance as Auth;
export const functions = functionsInstance as Functions;
export const messaging = messagingInstance as Messaging;
export const storage = getStorage(app!) as FirebaseStorage;
export const googleProvider = new GoogleAuthProvider();

/**
 * Removes undefined fields from an object to prevent Firestore validation errors.
 * Firestore accepts null but throws errors for undefined.
 */
export function cleanObject<T extends object>(obj: T): T {
  const result = { ...obj };
  Object.keys(result).forEach((key) => {
    if ((result as any)[key] === undefined) {
      delete (result as any)[key];
    }
  });
  return result;
}

