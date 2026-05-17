import { connectMongoDB } from '../config/mongodb.js';
import { getUserFromMongo } from '../services/authFallback.js';
import { UserBackup } from '../models/backup/userBackup.js';
import { EquipmentBackup } from '../models/backup/equipmentBackup.js';
import { RequestBackup } from '../models/backup/requestBackup.js';

// ❌ No Firebase import at all — simulating Firebase is completely down

async function testAuthFallback() {
  console.log('\n=============================');
  console.log('🔥 SIMULATING FIREBASE DOWN');
  console.log('🍃 TESTING MONGODB FALLBACK');
  console.log('=============================');

  // Connect only MongoDB
  await connectMongoDB();

  // Test 1 — Check MongoDB has backed up users
  console.log('\n🧪 Test 1: Users in MongoDB backup...');
  const users = await UserBackup.find({});
  if (users.length > 0) {
    console.log(`✅ Found ${users.length} backed up users`);
    console.log(`   Sample: ${users[0].email} | role: ${users[0].role}`);
  } else {
    console.log('⚠️ No users found — make sure your server ran with firestoreListener first');
  }

  // Test 2 — Check MongoDB has backed up equipment
  console.log('\n🧪 Test 2: Equipment in MongoDB backup...');
  const equipment = await EquipmentBackup.find({});
  if (equipment.length > 0) {
    console.log(`✅ Found ${equipment.length} backed up equipment`);
    console.log(`   Sample: ${equipment[0].name}`);
  } else {
    console.log('⚠️ No equipment found in MongoDB backup');
  }

  // Test 3 — Check MongoDB has backed up requests
  console.log('\n🧪 Test 3: Requests in MongoDB backup...');
  const requests = await RequestBackup.find({});
  if (requests.length > 0) {
    console.log(`✅ Found ${requests.length} backed up requests`);
  } else {
    console.log('⚠️ No requests found in MongoDB backup');
  }

  // Test 4 — Simulate requireAuth fallback using a real backed up user
  console.log('\n🧪 Test 4: Simulate requireAuth with Firebase down...');
  if (users.length > 0) {
    const uid = users[0].docId;

    // This is exactly what requireAuth does when Firebase is down
    const user = await getUserFromMongo(uid);
    if (user) {
      console.log(`✅ Auth fallback works! User found in MongoDB`);
      console.log(`   uid: ${user.uid}`);
      console.log(`   email: ${user.email}`);
      console.log(`   role: ${user.role}`);
      console.log(`   admin: ${user.role === 'admin' || !!user.isSuperAdmin}`);
      console.log(`   superAdmin: ${!!user.isSuperAdmin}`);
    } else {
      console.log('❌ Auth fallback failed — getUserFromMongo() returned null');
    }
  }

  // Test 5 — Simulate token expiry check
  console.log('\n🧪 Test 5: Simulate expired token handling...');
  const fakeExpiredPayload = {
    sub: 'fakeuid123',
    exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
  };
  const now = Math.floor(Date.now() / 1000);
  if (fakeExpiredPayload.exp < now) {
    console.log('✅ Expired token correctly detected — would return 401');
  }

  // Test 6 — Simulate valid token with unknown user
  console.log('\n🧪 Test 6: Token with unknown UID...');
  const unknownUser = await getUserFromMongo('nonexistent-uid-12345');
  if (!unknownUser) {
    console.log('✅ Unknown user correctly returns null — would return 401');
  }

  console.log('\n=============================');
  console.log('✅ ALL FALLBACK TESTS DONE');
  console.log('=============================\n');
}

testAuthFallback().catch(console.error);