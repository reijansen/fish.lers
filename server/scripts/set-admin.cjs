#!/usr/bin/env node
/**
 * Set admin claim for a user
 * Usage:
 *   node set-admin.cjs <uid> [admin|super]
 *
 * Examples:
 *   node set-admin.cjs abc123xyz admin
 *   node set-admin.cjs abc123xyz super
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
const defaultServiceAccountPath = path.join(__dirname, '../firebase-service-account.json');

function resolveKeyPath() {
  const keyArg = process.argv.find((arg) => arg.startsWith('--key='));
  if (keyArg) {
    return path.resolve(keyArg.slice('--key='.length));
  }

  if (process.env.SERVICE_ACCOUNT_PATH) {
    return path.resolve(process.env.SERVICE_ACCOUNT_PATH);
  }

  return defaultServiceAccountPath;
}

try {
  const serviceAccountPath = resolveKeyPath();
  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Key file not found: ${serviceAccountPath}`);
  }

  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error('Error loading service account key');
  console.error('Provide a key with --key=path, SERVICE_ACCOUNT_PATH, or place firebase-service-account.json in server/');
  console.error(error.message);
  process.exit(1);
}

const auth = admin.auth();
const firestore = admin.firestore();

async function setAdminClaim(uid, level = 'admin') {
  try {
    if (!uid) {
      console.error('Usage: node set-admin.cjs <uid> [admin|super]');
      console.error('Example: node set-admin.cjs abc123xyz super --key=C:\\path\\serviceAccountKey.json');
      process.exit(1);
    }

    const normalizedLevel = String(level).toLowerCase();
    if (!['admin', 'super'].includes(normalizedLevel)) {
      console.error('Invalid level. Use "admin" or "super".');
      process.exit(1);
    }

    const isSuperAdmin = normalizedLevel === 'super';
    console.log(`Setting ${isSuperAdmin ? 'super admin' : 'admin'} claim for user: ${uid}`);

    await auth.setCustomUserClaims(uid, {
      admin: true,
      superAdmin: isSuperAdmin,
    });

    // Keep Firestore user role in sync with claims for frontend route guards.
    const userRef = firestore.collection('users').doc(uid);
    const userSnapshot = await userRef.get();
    const now = new Date().toISOString();
    if (userSnapshot.exists) {
      await userRef.set(
        {
          role: 'admin',
          isSuperAdmin,
          updatedAt: now,
        },
        { merge: true }
      );
    } else {
      await userRef.set({
        uid,
        role: 'admin',
        isSuperAdmin,
        createdAt: now,
        updatedAt: now,
      });
    }

    console.log('Admin claim set successfully');
    console.log(`User ${uid} is now ${isSuperAdmin ? 'a super admin' : 'an admin'}.`);

    const user = await auth.getUser(uid);
    console.log('\nUser Details:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Display Name: ${user.displayName || 'Not set'}`);
    console.log(`   Admin: ${!!user.customClaims?.admin}`);
    console.log(`   Super Admin: ${!!user.customClaims?.superAdmin}`);
    console.log('   Firestore role: admin');
    console.log(`   Firestore isSuperAdmin: ${isSuperAdmin}`);

    process.exit(0);
  } catch (error) {
    console.error('Error setting admin claim:');
    console.error(error.message);
    process.exit(1);
  }
}

const uid = process.argv[2];
const level = process.argv[3] || 'admin';
setAdminClaim(uid, level);
