#!/usr/bin/env node
// scripts/set-claim.js
// Small helper to set/unset the `admin` custom claim for a user using Firebase Admin SDK.
// Usage: node scripts/set-claim.js <uid> --admin=true --key=./serviceAccountKey.json

const path = require('path');
const yargs = require('yargs');

const argv = yargs
  .usage('Usage: $0 <uid> --admin=true --key=./serviceAccountKey.json')
  .option('key', { type: 'string', describe: 'Path to service account JSON', demandOption: true })
  .option('admin', { type: 'boolean', describe: 'Set admin true/false', demandOption: true })
  .demandCommand(1)
  .help()
  .argv;

const uid = argv._[0];
const keyPath = path.resolve(argv.key);
const makeAdmin = !!argv.admin;

if (!uid) {
  console.error('Missing uid.');
  process.exit(1);
}

let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.error('Please install firebase-admin: npm install -g firebase-admin OR npm install firebase-admin --save-dev');
  process.exit(1);
}

try {
  const serviceAccount = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (err) {
  console.error('Failed to initialize admin SDK with key:', keyPath, err.message || err);
  process.exit(1);
}

(async () => {
  try {
    await admin.auth().setCustomUserClaims(uid, { admin: makeAdmin });
    console.log(`Set admin=${makeAdmin} for user ${uid}`);
    process.exit(0);
  } catch (err) {
    console.error('Error setting custom claim:', err);
    process.exit(1);
  }
})();
