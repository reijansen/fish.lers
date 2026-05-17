#!/usr/bin/env node
// scripts/set-claim.cjs
// CommonJS helper to set/unset the `admin` custom claim for a user using Firebase Admin SDK.
// Usage: node scripts/set-claim.cjs <uid> --admin=true --key=./serviceAccountKey.json

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const parser = yargs(hideBin(process.argv));
const argv = parser
  .usage('Usage: $0 <uid> --admin=true --key=./serviceAccountKey.json')
  .option('key', { type: 'string', describe: 'Path to service account JSON (optional if SERVICE_ACCOUNT_PATH or SERVICE_ACCOUNT_JSON_BASE64 is set)' })
  .option('admin', { type: 'boolean', describe: 'Set admin true/false', demandOption: true })
  .demandCommand(1)
  .help()
  .parseSync();

const uid = argv._[0];
const makeAdmin = !!argv.admin;
let keyPath = argv.key ? path.resolve(argv.key) : null;

if (!uid) {
  console.error('Missing uid.');
  process.exit(1);
}

// We'll use the modular admin SDK entrypoints. No top-level require for the default admin namespace.

// Resolve service account: priority
// 1) SERVICE_ACCOUNT_JSON_BASE64 (base64-encoded JSON)
// 2) SERVICE_ACCOUNT_PATH (absolute or relative path)
// 3) --key argument
let serviceAccount = null;
try {
  if (process.env.SERVICE_ACCOUNT_JSON_BASE64) {
    const raw = Buffer.from(process.env.SERVICE_ACCOUNT_JSON_BASE64, 'base64').toString('utf8');
    serviceAccount = JSON.parse(raw);
  } else if (process.env.SERVICE_ACCOUNT_PATH) {
    const p = path.resolve(process.env.SERVICE_ACCOUNT_PATH);
    if (!fs.existsSync(p)) throw new Error(`SERVICE_ACCOUNT_PATH not found: ${p}`);
    serviceAccount = require(p);
  } else if (keyPath) {
    if (!fs.existsSync(keyPath)) throw new Error(`Key file not found: ${keyPath}`);
    serviceAccount = require(keyPath);
  } else {
    console.error('No service account provided. Set SERVICE_ACCOUNT_JSON_BASE64 or SERVICE_ACCOUNT_PATH, or pass --key=path.');
    process.exit(1);
  }

  // initialize with modular API
  const { initializeApp, cert } = require('firebase-admin/app');
  initializeApp({ credential: cert(serviceAccount) });
} catch (err) {
  console.error('Failed to initialize admin SDK with key:', keyPath || process.env.SERVICE_ACCOUNT_PATH || 'SERVICE_ACCOUNT_JSON_BASE64', err && err.message ? err.message : err);
  process.exit(1);
}

(async () => {
  try {
  // use modular auth API
  const { getAuth } = require('firebase-admin/auth');
  await getAuth().setCustomUserClaims(uid, { admin: makeAdmin });
    console.log(`Set admin=${makeAdmin} for user ${uid}`);
    process.exit(0);
  } catch (err) {
    console.error('Error setting custom claim:', err);
    process.exit(1);
  }
})();
