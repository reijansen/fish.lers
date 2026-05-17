import admin from "firebase-admin";
import { AppConfig } from "./env.js";

let app: admin.app.App | null = null;
let firestore: FirebaseFirestore.Firestore | null = null;
let auth: admin.auth.Auth | null = null;

/**
 * Initialize Firebase Admin SDK with service account credentials.
 * This should be called once at server startup.
 * Call this BEFORE any database/auth operations.
 */
export function initializeFirebase(config: AppConfig): void {
  if (app) {
    console.log("ℹ️ Firebase already initialized, skipping...");
    return;
  }

  try {
    const credential = admin.credential.cert({
      projectId: config.firebaseProjectId,
      privateKey: config.firebasePrivateKey,
      clientEmail: config.firebaseClientEmail,
    } as admin.ServiceAccount);

    app = admin.initializeApp({
      credential,
    });

    firestore = admin.firestore();
    auth = admin.auth();

    console.log("✓ Firebase Admin SDK initialized");
  } catch (error) {
    console.error("❌ Failed to initialize Firebase:", error);
    throw error;
  }
}

/**
 * Get the Firestore instance. Ensure initializeFirebase() was called first.
 */
export function getFirestore(): FirebaseFirestore.Firestore {
  if (!firestore) {
    throw new Error("❌ Firestore not initialized. Call initializeFirebase() first.");
  }
  return firestore;
}

/**
 * Get the Firebase Auth instance. Ensure initializeFirebase() was called first.
 */
export function getAuth(): admin.auth.Auth {
  if (!auth) {
    throw new Error("❌ Auth not initialized. Call initializeFirebase() first.");
  }
  return auth;
}

/**
 * Get the Firebase Admin App instance.
 */
export function getFirebaseApp(): admin.app.App {
  if (!app) {
    throw new Error("❌ Firebase app not initialized. Call initializeFirebase() first.");
  }
  return app;
}
