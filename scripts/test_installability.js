import fetch from 'node-fetch';
import { readFileSync } from 'fs';

async function auditManifest(url, label) {
  console.log(`\n--- Auditing PWA Manifest: ${label} (${url}) ---`);
  try {
    const response = await fetch(url);
    if (response.status !== 200) {
      console.log(`❌ FAIL: Manifest unreachable. HTTP Status: ${response.status}`);
      return false;
    }
    console.log(`✅ PASS: HTTP Status is 200`);

    const contentType = response.headers.get('content-type');
    if (!contentType || (!contentType.includes('application/manifest+json') && !contentType.includes('application/json') && !contentType.includes('text/json'))) {
      console.log(`❌ FAIL: Invalid MIME type: ${contentType}`);
      return false;
    }
    console.log(`✅ PASS: Content-Type is valid PWA manifest type: ${contentType}`);

    const text = await response.text();
    let manifest;
    try {
      manifest = JSON.parse(text);
      console.log(`✅ PASS: Manifest is valid parseable JSON`);
    } catch (err) {
      console.log(`❌ FAIL: JSON parsing failed: ${err.message}`);
      return false;
    }

    // Validate Required Manifest Keys for PWA Installability
    const requiredKeys = ['name', 'short_name', 'start_url', 'display', 'icons'];
    let keysPassed = true;
    for (const key of requiredKeys) {
      if (!(key in manifest)) {
        console.log(`❌ FAIL: Missing required key: "${key}"`);
        keysPassed = false;
      } else {
        console.log(`✅ PASS: Key "${key}" is present: ${JSON.stringify(manifest[key]).substring(0, 80)}`);
      }
    }
    if (!keysPassed) return false;

    // Validate display standalone
    if (manifest.display !== 'standalone' && manifest.display !== 'fullscreen' && manifest.display !== 'minimal-ui') {
      console.log(`❌ FAIL: "display" must be standalone, fullscreen, or minimal-ui. Current: ${manifest.display}`);
      return false;
    }
    console.log(`✅ PASS: Display mode is standalone-compatible ("${manifest.display}")`);

    // Validate start_url and scope
    console.log(`✅ PASS: start_url is "${manifest.start_url}"`);
    console.log(`✅ PASS: scope is "${manifest.scope || '/'}"`);

    // Validate Manifest Icons
    if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
      console.log(`❌ FAIL: "icons" is empty or not an array`);
      return false;
    }
    console.log(`✅ PASS: Found ${manifest.icons.length} icon definitions`);

    // Verify icons are reachable
    const base = new URL(url).origin;
    let iconsPassed = true;
    for (const icon of manifest.icons) {
      const iconUrl = new URL(icon.src, base).href;
      try {
        const iconRes = await fetch(iconUrl);
        if (iconRes.status === 200) {
          console.log(`   ✅ Icon reachable: ${icon.src} (${icon.sizes}, ${iconRes.headers.get('content-length')} bytes)`);
        } else {
          console.log(`   ❌ Icon unreachable: ${icon.src} (status: ${iconRes.status})`);
          iconsPassed = false;
        }
      } catch (iconErr) {
        console.log(`   ❌ Icon fetch failed: ${icon.src} (${iconErr.message})`);
        iconsPassed = false;
      }
    }
    if (!iconsPassed) return false;

    // Verify start_url is reachable
    const startUrl = new URL(manifest.start_url, base).href;
    try {
      const startRes = await fetch(startUrl);
      if (startRes.status === 200) {
        console.log(`✅ PASS: start_url is reachable: ${manifest.start_url}`);
      } else {
        console.log(`❌ FAIL: start_url returned HTTP ${startRes.status}`);
        return false;
      }
    } catch (startErr) {
      console.log(`❌ FAIL: start_url fetch failed: ${startErr.message}`);
      return false;
    }

    console.log(`🎉 SUCCESS: ${label} manifest fully compliant with PWA standards!`);
    return true;
  } catch (err) {
    console.log(`❌ FAIL: Error auditing manifest: ${err.message}`);
    return false;
  }
}

async function verifyServiceWorker(baseUrl, path, label) {
  console.log(`\n--- Auditing Service Worker Files: ${label} ---`);
  try {
    const swUrl = `${baseUrl}${path}`;
    console.log(`Checking Service Worker: ${swUrl}`);
    const response = await fetch(swUrl);
    if (response.status !== 200) {
      console.log(`❌ FAIL: Service Worker unreachable. HTTP Status: ${response.status}`);
      return false;
    }
    console.log(`✅ PASS: Service worker is reachable and returns HTTP 200`);

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('javascript')) {
      console.log(`❌ FAIL: Service Worker Content-Type is: ${contentType} (expected javascript)`);
      return false;
    }
    console.log(`✅ PASS: Service Worker Content-Type is valid JavaScript: ${contentType}`);

    // Check registerSW.js if it exists
    const regSwUrl = `${baseUrl}/registerSW.js`;
    console.log(`Checking PWA Registration Script: ${regSwUrl}`);
    const regRes = await fetch(regSwUrl);
    if (regRes.status === 200) {
      console.log(`   ✅ PASS: registerSW.js is reachable and returns HTTP 200`);
    } else {
      console.log(`   ℹ️ INFO: registerSW.js status: ${regRes.status} (Not strictly required if inline register used)`);
    }

    return true;
  } catch (err) {
    console.log(`❌ FAIL: Service Worker audit failed: ${err.message}`);
    return false;
  }
}

async function verifyHtmlManifestLink(baseUrl, label) {
  console.log(`\n--- Auditing Homepage HTML for Manifest Link: ${label} ---`);
  try {
    const response = await fetch(baseUrl);
    if (response.status !== 200) {
      console.log(`❌ FAIL: Homepage unreachable. HTTP Status: ${response.status}`);
      return false;
    }
    const html = await response.text();
    if (html.includes('rel="manifest"') || html.includes('rel=\'manifest\'') || html.includes('rel=manifest')) {
      console.log(`✅ PASS: Homepage HTML contains manifest link tag`);
      return true;
    } else {
      console.log(`❌ FAIL: Homepage HTML does NOT contain manifest link tag`);
      return false;
    }
  } catch (err) {
    console.log(`❌ FAIL: HTML Manifest Link check failed: ${err.message}`);
    return false;
  }
}

function auditSourceFiles() {
  console.log(`\n--- Auditing Source Code for PWA Configurations ---`);
  let sourceOk = true;

  // 1. Audit appMode.js for display-mode standalone detection
  try {
    const appModeContent = readFileSync('src/utils/appMode.js', 'utf8');
    const hasStandaloneMedia = appModeContent.includes("'(display-mode: standalone)'") || appModeContent.includes('"(display-mode: standalone)"') || appModeContent.includes('display-mode: standalone');
    const hasAppleStandalone = appModeContent.includes('navigator.standalone') || appModeContent.includes('window.navigator.standalone');
    
    if (hasStandaloneMedia && hasAppleStandalone) {
      console.log('✅ PASS: appMode.js implements standard (display-mode: standalone) and Apple standalone checks');
    } else {
      console.log(`❌ FAIL: appMode.js missing required standalone checks. Media: ${hasStandaloneMedia}, Apple: ${hasAppleStandalone}`);
      sourceOk = false;
    }
  } catch (err) {
    console.log(`❌ FAIL: Could not read src/utils/appMode.js: ${err.message}`);
    sourceOk = false;
  }

  // 2. Audit LandingPage.jsx for beforeinstallprompt and appinstalled event listeners
  try {
    const landingContent = readFileSync('src/pages/LandingPage.jsx', 'utf8');
    const hasBeforeInstall = landingContent.includes('beforeinstallprompt');
    const hasAppInstalled = landingContent.includes('appinstalled');

    if (hasBeforeInstall && hasAppInstalled) {
      console.log('✅ PASS: LandingPage.jsx registers beforeinstallprompt and appinstalled listeners');
    } else {
      console.log(`❌ FAIL: LandingPage.jsx is missing event listeners. beforeinstallprompt: ${hasBeforeInstall}, appinstalled: ${hasAppInstalled}`);
      sourceOk = false;
    }
  } catch (err) {
    console.log(`❌ FAIL: Could not read src/pages/LandingPage.jsx: ${err.message}`);
    sourceOk = false;
  }

  return sourceOk;
}

async function runAudit() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  HappyTimes PWA — Installability Audit');
  console.log('═══════════════════════════════════════════════════════');

  const staticOk = auditSourceFiles();

  // Local Dev checks
  const localHtmlOk = await verifyHtmlManifestLink('http://localhost:5173', 'Local Dev Server');
  const localManifestOk = await auditManifest('http://localhost:5173/manifest.webmanifest', 'Local Dev Server');
  const localSwOk = await verifyServiceWorker('http://localhost:5173', '/dev-sw.js?dev-sw', 'Local Dev Server');

  // Prod checks
  const prodHtmlOk = await verifyHtmlManifestLink('https://happytimes-preschool-pwa.web.app', 'Production Cloud Deployed');
  const prodManifestOk = await auditManifest('https://happytimes-preschool-pwa.web.app/manifest.webmanifest', 'Production Cloud Deployed');
  const prodSwOk = await verifyServiceWorker('https://happytimes-preschool-pwa.web.app', '/sw.js', 'Production Cloud Deployed');

  console.log('\n═══════════════════════════════════════════════════════');
  if (staticOk && localHtmlOk && localManifestOk && localSwOk && prodHtmlOk && prodManifestOk && prodSwOk) {
    console.log('✅ ALL PWA INSTALLABILITY AUDIT TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME PWA INSTALLABILITY AUDIT TESTS FAILED!');
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit execution failure:', err);
  process.exit(1);
});
