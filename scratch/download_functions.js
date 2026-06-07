import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import https from 'https';
import { execSync } from 'child_process';

const configPath = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const raw = readFileSync(configPath, 'utf8');
const parsed = JSON.parse(raw);
const tokens = parsed.tokens;
const accessToken = tokens.access_token;

function makeRequest(url, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let data = [];
      res.on('data', (chunk) => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(buffer);
        } else {
          reject(new Error(`Status ${res.statusCode}: ${buffer.toString()}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getFunctionSource(functionName) {
  try {
    console.log(`Describing function ${functionName}...`);
    const url = `https://cloudfunctions.googleapis.com/v2/projects/happytimes-preschool-pwa/locations/us-central1/functions/${functionName}`;
    const descBuffer = await makeRequest(url);
    const desc = JSON.parse(descBuffer.toString());

    const storageSource = desc.buildConfig?.source?.storageSource;
    if (!storageSource) {
      throw new Error(`No storageSource found for ${functionName}`);
    }

    const { bucket, object } = storageSource;
    console.log(`Found source zip in bucket: ${bucket}, object: ${object}`);

    console.log(`Downloading source zip...`);
    const downloadUrl = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(object)}?alt=media`;
    const zipBuffer = await makeRequest(downloadUrl);

    const zipPath = join('scratch', `${functionName}.zip`);
    writeFileSync(zipPath, zipBuffer);
    console.log(`Saved to ${zipPath}`);

    const destDir = join('scratch', functionName);
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    console.log(`Extracting zip to ${destDir}...`);
    // Use powershell Expand-Archive on Windows
    execSync(`powershell Expand-Archive -Path ${zipPath} -DestinationPath ${destDir} -Force`);
    console.log(`Extracted successfully!`);

  } catch (err) {
    console.error(`Error processing ${functionName}:`, err.message);
  }
}

async function run() {
  if (!existsSync('scratch')) {
    mkdirSync('scratch');
  }
  await getFunctionSource('onPostCreated');
  await getFunctionSource('onAttendanceCreated');
}

run();
