import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';

// 1. Read token from firebase-tools.json
const configPath = 'C:\\Users\\prath\\.config\\configstore\\firebase-tools.json';
const config = JSON.parse(readFileSync(configPath, 'utf-8'));
const tokens = config.tokens;

async function getValidAccessToken() {
  // If token is expired or close to expiring, refresh it
  const now = Date.now();
  if (tokens.expires_at && now < tokens.expires_at - 60000) {
    console.log('Using existing active access token...');
    return tokens.access_token;
  }

  console.log('Access token expired or near expiry. Refreshing...');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to refresh token: ${JSON.stringify(data)}`);
  }
  console.log('Token refreshed successfully.');
  return data.access_token;
}

async function main() {
  const token = await getValidAccessToken();

  // Create custom credential
  const credential = {
    getAccessToken: async () => {
      return {
        access_token: token,
        expires_in: 3600,
      };
    },
  };

  admin.initializeApp({
    credential,
    projectId: 'happytimes-preschool-pwa',
  });

  const auth = admin.auth();

  const QA_PARENT_UID = 'KxyQom31c8hDyhaDhoWTMjX3Kf02';
  const QA_PHONE = '+919999999999';

  console.log('\n══ Link test phone number ══');
  try {
    // Check if the phone number is already linked to another account
    try {
      const existing = await auth.getUserByPhoneNumber(QA_PHONE);
      if (existing.uid !== QA_PARENT_UID) {
        console.log(`Phone is linked to uid ${existing.uid}. Removing it...`);
        await auth.updateUser(existing.uid, { phoneNumber: null });
      }
    } catch (err) {
      if (err.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    // Link phone to target QA parent UID
    await auth.updateUser(QA_PARENT_UID, { phoneNumber: QA_PHONE });
    console.log(`✅ Phone ${QA_PHONE} linked successfully to QA parent UID ${QA_PARENT_UID}`);
  } catch (err) {
    console.error('❌ Error linking phone:', err);
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
