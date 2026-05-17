import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApp } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

type ServiceAccountLike = Record<string, any>;

let initialized = false;

function loadServiceAccountFromPath(p: string): ServiceAccountLike {
  const resolved = path.resolve(p);
  if (!fs.existsSync(resolved)) throw new Error(`Service account file not found: ${resolved}`);
  const raw = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw);
}

export function initAdmin(options?: { serviceAccountPath?: string } ): void {
  if (initialized) return;

  // priority: SERVICE_ACCOUNT_JSON_BASE64 -> options.serviceAccountPath -> SERVICE_ACCOUNT_PATH
  const envBase64 = process.env.SERVICE_ACCOUNT_JSON_BASE64;
  const envPath = process.env.SERVICE_ACCOUNT_PATH;
  let serviceAccount: ServiceAccountLike | null = null;

  if (envBase64) {
    const raw = Buffer.from(envBase64, 'base64').toString('utf8');
    serviceAccount = JSON.parse(raw);
  } else if (options?.serviceAccountPath) {
    serviceAccount = loadServiceAccountFromPath(options.serviceAccountPath);
  } else if (envPath) {
    serviceAccount = loadServiceAccountFromPath(envPath);
  } else {
    throw new Error('No service account provided. Set SERVICE_ACCOUNT_JSON_BASE64 or SERVICE_ACCOUNT_PATH, or pass serviceAccountPath option.');
  }

  if (!serviceAccount) throw new Error('serviceAccount unexpectedly null');
  initializeApp({ credential: cert(serviceAccount) });
  initialized = true;
}

export function getAdminAuth(): Auth {
  try {
    // getApp will throw if not initialized
    getApp();
  } catch (e) {
    throw new Error('Admin SDK not initialized. Call initAdmin(...) first.');
  }
  return getAuth();
}

export function getAdminFirestore(): Firestore {
  try {
    getApp();
  } catch (e) {
    throw new Error('Admin SDK not initialized. Call initAdmin(...) first.');
  }
  return getFirestore();
}

// convenience auto-init when used in short-running scripts if environment variables are present
try {
  if (!initialized && (process.env.SERVICE_ACCOUNT_JSON_BASE64 || process.env.SERVICE_ACCOUNT_PATH)) {
    initAdmin();
  }
} catch (e) {
  // do not crash on import — allow caller to handle initialization errors
}
