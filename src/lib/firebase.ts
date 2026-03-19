import { initializeApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, Auth, GoogleAuthProvider } from "firebase/auth";
import { getFunctions, Functions } from "firebase/functions";

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

if (isFirebaseConfigured) {
  try {
    const debugInfo = `Project ID: ${firebaseConfig.projectId || 'MISSING'}`;
    console.log("[Firebase] Initializing with", debugInfo);
    // TEMPORARY: Alert for hard debugging to bypass any console filtering
    alert("Firebase Initializing! " + debugInfo);
    
    app = initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
    authInstance = getAuth(app);
    functionsInstance = getFunctions(app);

    if (!firebaseConfig.projectId) {
      console.error("[Firebase] CRITICAL: Project ID is missing from environment variables!");
    }

    // Enable offline persistence
    enableIndexedDbPersistence(dbInstance).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn("Firestore: Multiple tabs open, persistence can only be enabled in one tab at a time.");
      } else if (err.code === 'unimplemented') {
        console.warn("Firestore: The current browser does not support all of the features required to enable persistence.");
      }
    });
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
}


export const db = dbInstance as Firestore;
export const auth = authInstance as Auth;
export const functions = functionsInstance as Functions;
export const googleProvider = new GoogleAuthProvider();
