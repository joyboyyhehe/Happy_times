import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');

if (existsSync(configPath)) {
  console.log('Firebase config file exists.');
  try {
    const raw = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    console.log('Keys in firebase-tools:', Object.keys(parsed));
    if (parsed.tokens) {
      console.log('Tokens object keys:', Object.keys(parsed.tokens));
    }
    if (parsed.user) {
      console.log('User email:', parsed.user.email);
    }
  } catch (err) {
    console.error('Failed to parse firebase-tools.json:', err);
  }
} else {
  console.log('Firebase config file does not exist at:', configPath);
}
