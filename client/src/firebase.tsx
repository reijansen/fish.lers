// Import the functions you need from the SDKs you need
import { FirebaseApp, initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Read Firebase config from Vite environment variables (VITE_ prefix)
function requireEnv(key: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY as string | undefined),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined),
  appId: requireEnv('VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID as string | undefined),
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Export the single Firebase app instance and services
export { app };
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* eslint-disable no-console */

// Emulator connections removed — using production/back-end services by default.