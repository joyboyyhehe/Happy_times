import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Parse .env manually
const envText = readFileSync('.env', 'utf-8');
const envConfig = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    if (key) envConfig[key] = value;
  }
});

const firebaseConfig = {
  apiKey: envConfig.VITE_FIREBASE_API_KEY,
  authDomain: envConfig.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: envConfig.VITE_FIREBASE_PROJECT_ID,
  storageBucket: envConfig.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envConfig.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: envConfig.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function assertFails(promise, description) {
  try {
    await promise;
    console.log(`❌ FAIL: ${description} (expected failure but succeeded)`);
    return false;
  } catch (err) {
    if (err.code === 'permission-denied') {
      console.log(`✅ PASS: ${description} (blocked by rules as expected)`);
      return true;
    } else {
      console.log(`❌ FAIL: ${description} (expected permission-denied but got code: ${err.code}, message: ${err.message})`);
      return false;
    }
  }
}

async function assertSucceeds(promise, description) {
  try {
    await promise;
    console.log(`✅ PASS: ${description}`);
    return true;
  } catch (err) {
    console.log(`❌ FAIL: ${description} (failed with: ${err.code || err.message})`);
    return false;
  }
}

async function runSecurityTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Firestore Telemetry Security & Abuse Verification');
  console.log('═══════════════════════════════════════════════════════\n');

  let allPassed = true;

  // Test 1: Valid Anonymous Telemetry Write
  const validDoc = {
    event: 'install_prompt_shown',
    browser: 'Chrome',
    userAgent: 'Mozilla/5.0 Chrome/120.0',
    standalone: false,
    fingerprint: 'fp_test_12345',
    timestamp: serverTimestamp()
  };
  const t1 = await assertSucceeds(
    addDoc(collection(db, 'install_telemetry'), validDoc),
    'Valid telemetry write (anonymous allowed)'
  );
  if (!t1) allPassed = false;

  // Test 2: Anonymous Write to /logs (should fail now!)
  const invalidLogsDoc = {
    actionType: 'install_gate_event',
    event: 'test_anonymous',
    details: 'Should fail because logs is protected by isAuthenticated()',
    timestamp: serverTimestamp()
  };
  const t2 = await assertFails(
    addDoc(collection(db, 'logs'), invalidLogsDoc),
    'Anonymous write to logs collection (must be blocked)'
  );
  if (!t2) allPassed = false;

  // Test 3: Extra Keys / Malicious Payload
  const extraKeysDoc = {
    ...validDoc,
    maliciousField: 'exploit_value',
    nestedObject: { block_this: true }
  };
  const t3 = await assertFails(
    addDoc(collection(db, 'install_telemetry'), extraKeysDoc),
    'Malicious write with extra keys/nested fields (blocked)'
  );
  if (!t3) allPassed = false;

  // Test 4: Oversized string field (event > 50 characters)
  const oversizedEventDoc = {
    ...validDoc,
    event: 'A'.repeat(51)
  };
  const t4 = await assertFails(
    addDoc(collection(db, 'install_telemetry'), oversizedEventDoc),
    'Oversized event field (> 50 chars) (blocked)'
  );
  if (!t4) allPassed = false;

  // Test 5: Oversized fingerprint (> 120 characters)
  const oversizedFingerprintDoc = {
    ...validDoc,
    fingerprint: 'F'.repeat(121)
  };
  const t5 = await assertFails(
    addDoc(collection(db, 'install_telemetry'), oversizedFingerprintDoc),
    'Oversized fingerprint field (> 120 chars) (blocked)'
  );
  if (!t5) allPassed = false;

  // Test 6: Future Timestamp
  // Firestore rules: request.resource.data.timestamp <= request.time
  // Setting timestamp 2 hours in the future
  const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const futureTimestampDoc = {
    ...validDoc,
    timestamp: Timestamp.fromDate(futureDate)
  };
  const t6 = await assertFails(
    addDoc(collection(db, 'install_telemetry'), futureTimestampDoc),
    'Future timestamp rejection (blocked)'
  );
  if (!t6) allPassed = false;

  // Test 7: Abuse / Rate limit testing (100 rapid writes)
  console.log('\n--- Running Abuse / Rate Limit (100 Writes) ---');
  let successCount = 0;
  let failCount = 0;
  const promises = [];
  
  for (let i = 0; i < 100; i++) {
    promises.push(
      addDoc(collection(db, 'install_telemetry'), {
        event: 'abuse_load_test',
        browser: 'Chrome',
        userAgent: 'Abuse script',
        standalone: false,
        fingerprint: 'fp_abuse_test',
        timestamp: serverTimestamp()
      })
      .then(() => { successCount++; })
      .catch(() => { failCount++; })
    );
  }
  
  await Promise.all(promises);
  console.log(`Result: ${successCount} successful writes, ${failCount} rejected`);
  console.log('---------------------------------------------\n');

  if (allPassed) {
    console.log('✅ ALL TELEMETRY SECURITY AUDIT TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TELEMETRY SECURITY AUDIT TESTS FAILED!');
    process.exit(1);
  }
}

runSecurityTests().catch(err => {
  console.error('Fatal security test execution failure:', err);
  process.exit(1);
});
