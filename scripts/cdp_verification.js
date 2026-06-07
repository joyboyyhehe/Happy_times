import { readFileSync, writeFileSync } from 'fs';
import http from 'http';

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

const SCREENSHOT_DIR = 'C:/Users/prath/.gemini/antigravity-ide/brain/c4fe90b1-9de7-4e74-8b7f-496a7cfe04b9';

const results = [];
let idCounter = 1;
const pendingRequests = new Map();
let ws;
const browserConsoleLogs = [];

function logConsole(type, text) {
  browserConsoleLogs.push({ type, text, timestamp: new Date().toISOString() });
  console.log(`[BROWSER CONSOLE] ${type.toUpperCase()}: ${text}`);
}

function getWebSocketUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const targets = JSON.parse(data);
          console.log('Discovered Chrome targets:', targets.map(t => ({ id: t.id, title: t.title, url: t.url, type: t.type })));
          
          const pwaTargets = targets.filter(t => t.type === 'page' && t.url && t.url.includes('happytimes-preschool-pwa.web.app'));
          
          if (pwaTargets.length > 1) {
            const keepTarget = pwaTargets[0];
            const toClose = pwaTargets.slice(1);
            console.log(`Found ${pwaTargets.length} PWA tabs. Keeping target ID: ${keepTarget.id}. Closing others:`, toClose.map(t => t.id));
            
            for (const t of toClose) {
              await new Promise((r) => {
                http.get(`http://127.0.0.1:9222/json/close/${t.id}`, (closeRes) => {
                  closeRes.resume();
                  closeRes.on('end', () => {
                    console.log(`Closed duplicate tab: ${t.id}`);
                    r();
                  });
                }).on('error', (err) => {
                  console.error(`Failed to close tab ${t.id}:`, err.message);
                  r();
                });
              });
            }
            // Wait a moment for tabs to close
            await new Promise(r => setTimeout(r, 1000));
            
            // Re-fetch targets to get updated list
            http.get('http://127.0.0.1:9222/json', (res2) => {
              let data2 = '';
              res2.on('data', chunk => data2 += chunk);
              res2.on('end', () => {
                try {
                  const targets2 = JSON.parse(data2);
                  const target = targets2.find(t => t.id === keepTarget.id) || targets2.find(t => t.type === 'page' && t.url && t.url.includes('happytimes-preschool-pwa.web.app')) || targets2.find(t => t.type === 'page');
                  if (target && target.webSocketDebuggerUrl) {
                    resolve(target.webSocketDebuggerUrl);
                  } else {
                    reject(new Error('No matching debugger target page found after closing duplicates'));
                  }
                } catch (e) {
                  reject(e);
                }
              });
            }).on('error', (err) => {
              reject(new Error(`Failed to re-fetch targets after closing: ${err.message}`));
            });
          } else {
            const target = pwaTargets[0] || targets.find(t => t.type === 'page');
            if (target && target.webSocketDebuggerUrl) {
              resolve(target.webSocketDebuggerUrl);
            } else {
              reject(new Error('No matching debugger target page found'));
            }
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Could not connect to Chrome debugging port. Make sure Chrome is running with remote debugging enabled on port 9222. Error: ${err.message}`));
    });
  });
}

async function connect() {
  const targetWsUrl = await getWebSocketUrl();
  console.log(`Connecting to Chrome at ${targetWsUrl}...`);
  ws = new WebSocket(targetWsUrl);
  
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  console.log('Connected to Chrome successfully.');

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pendingRequests.has(data.id)) {
      const { resolve, reject } = pendingRequests.get(data.id);
      pendingRequests.delete(data.id);
      if (data.error) {
        reject(data.error);
      } else {
        resolve(data.result);
      }
    } else if (data.method === 'Runtime.consoleAPICalled') {
      const args = data.params.args.map(a => a.value || a.description || '').join(' ');
      logConsole(data.params.type, args);
    } else if (data.method === 'Runtime.exceptionThrown') {
      logConsole('error', `Exception: ${data.params.exceptionDetails.text} ${data.params.exceptionDetails.exception?.description || ''}`);
    }
  };

  ws.onclose = (event) => {
    console.log(`WebSocket connection closed: code=${event.code}, reason=${event.reason}`);
    for (const [id, { reject }] of pendingRequests) {
      reject(new Error('WebSocket connection closed'));
    }
    pendingRequests.clear();
  };

  ws.onerror = (err) => {
    console.error('WebSocket connection error:', err);
    for (const [id, { reject }] of pendingRequests) {
      reject(err);
    }
    pendingRequests.clear();
  };

  // Enable Page, Runtime, Network and Console APIs
  await sendCommand('Page.enable');
  await sendCommand('Runtime.enable');
  await sendCommand('Network.enable');
  await sendCommand('Network.clearBrowserCache');
  await sendCommand('Network.setBypassServiceWorker', { bypass: true });
  console.log('Page, Runtime and Network domains enabled, service worker bypassed.');

  // Set up auto-mocking of Notification API on every document load
  console.log('Registering Notification API mock and browser login bypass...');
  await sendCommand('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      try {
        sessionStorage.setItem('browser_login_allowed', 'true');
      } catch (e) {
        console.warn('Failed to set browser_login_allowed:', e);
      }
      window.Notification = window.Notification || {};
      window.Notification.requestPermission = async () => {
        console.log('NOTIFICATION_PERMISSION_REQUESTED');
        return 'granted';
      };
      Object.defineProperty(window.Notification, 'permission', { get: () => 'granted' });
    `
  });
}

function sendCommand(method, params = {}) {
  const id = idCounter++;
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error(`CDP Command timeout: ${method} (${id})`));
      }
    }, 10000); // 10s command timeout
    
    pendingRequests.set(id, {
      resolve: (res) => {
        clearTimeout(timeoutId);
        resolve(res);
      },
      reject: (err) => {
        clearTimeout(timeoutId);
        reject(err);
      }
    });
    
    try {
      ws.send(JSON.stringify({ id, method, params }));
    } catch (err) {
      clearTimeout(timeoutId);
      pendingRequests.delete(id);
      reject(err);
    }
  });
}

async function navigate(url) {
  console.log(`Navigating to ${url}...`);
  await sendCommand('Page.navigate', { url });
  await new Promise(r => setTimeout(r, 2000)); // wait for navigation
}

async function evaluate(expression) {
  const res = await sendCommand('Runtime.evaluate', { expression, returnByValue: true });
  if (res.exceptionDetails) {
    throw new Error(`JS Exception: ${res.exceptionDetails.exception.description}`);
  }
  return res.result.value;
}

async function waitForSelector(selector, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const exists = await evaluate(`!!document.querySelector('${selector}')`);
    if (exists) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for selector: ${selector}`);
}

async function click(selector) {
  await waitForSelector(selector);
  await evaluate(`document.querySelector('${selector}').click()`);
  await new Promise(r => setTimeout(r, 500));
}

async function clickTopBack() {
  await evaluate(`(() => {
    const panels = Array.from(document.querySelectorAll('.overlay-panel.open'));
    if (panels.length > 0) {
      const btn = panels[panels.length - 1].querySelector('.overlay-panel-back');
      if (btn) {
        btn.click();
      } else {
        console.error('No back button found in top-most panel');
      }
    } else {
      console.error('No open overlay panels found');
    }
  })()`);
  await new Promise(r => setTimeout(r, 500));
}

async function waitForText(text, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const exists = await evaluate(`(() => {
      const overlays = Array.from(document.querySelectorAll('.overlay-panel.open, .bottom-sheet.open, .modal-overlay, .modal'));
      let container = document;
      if (overlays.length > 0) {
        container = overlays[overlays.length - 1];
      }
      const elements = Array.from(container.querySelectorAll('*'));
      return elements.some(el => el.textContent.trim().toLowerCase().includes("${text.toLowerCase()}"));
    })()`);
    if (exists) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Timeout waiting for text: ${text}`);
}

async function clickByText(text) {
  const clicked = await evaluate(`(() => {
    const targetText = "${text.toLowerCase()}";
    const overlays = Array.from(document.querySelectorAll('.overlay-panel.open, .bottom-sheet.open, .modal-overlay, .modal'));
    let container = document;
    if (overlays.length > 0) {
      container = overlays[overlays.length - 1];
    }
    const elements = Array.from(container.querySelectorAll('*'));
    const match = elements.find(el => {
      const hasText = el.textContent.trim().toLowerCase().includes(targetText);
      if (!hasText) return false;
      const children = Array.from(el.children);
      const childHasText = children.some(child => child.textContent.trim().toLowerCase().includes(targetText));
      return !childHasText;
    });
    if (match) {
      match.click();
      return true;
    }
    // Fallback to document search if container didn't have it (e.g. clicking header back button outside the container)
    if (container !== document) {
      const globalElements = Array.from(document.querySelectorAll('*'));
      const globalMatch = globalElements.find(el => {
        const hasText = el.textContent.trim().toLowerCase().includes(targetText);
        if (!hasText) return false;
        const children = Array.from(el.children);
        const childHasText = children.some(child => child.textContent.trim().toLowerCase().includes(targetText));
        return !childHasText;
      });
      if (globalMatch) {
        globalMatch.click();
        return true;
      }
    }
    return false;
  })()`);
  if (!clicked) {
    throw new Error(`Could not find or click element with text: ${text}`);
  }
  await new Promise(r => setTimeout(r, 500));
}

async function type(selector, text) {
  await waitForSelector(selector);
  await evaluate(`(() => {
    const el = document.querySelector('${selector}');
    if (!el) return;
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, "${text}");
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}

async function takeScreenshot(name) {
  try {
    const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    writeFileSync(path, buffer);
    console.log(`Screenshot captured: ${name}.png`);
  } catch (err) {
    console.error('Failed to capture screenshot:', err);
  }
}

async function getHistoryLength() {
  return await evaluate('window.history.length');
}

async function checkExitedOrBlank() {
  const href = await evaluate('window.location.href');
  const isBlank = await evaluate('document.body.innerHTML.trim() === ""');
  return { href, isBlank };
}

async function runTests() {
  await connect();

  // Navigate to landing page first to establish the origin context
  await navigate('https://happytimes-preschool-pwa.web.app/');

  // Clean state reset
  console.log('Clearing browser storage and data via CDP Storage.clearDataForOrigin...');
  try {
    await sendCommand('Storage.clearDataForOrigin', {
      origin: 'https://happytimes-preschool-pwa.web.app',
      storageTypes: 'all'
    });
    console.log('CDP Storage clear completed.');
  } catch (err) {
    console.error('CDP Storage clear failed:', err);
  }
  await new Promise(r => setTimeout(r, 1000)); // wait for storage engine to settle
  
  // Test credentials
  const superadminEmail = 'usharanijuniordps@gmail.com';
  const superadminPassword = 'happytimes_admin_6754';
  const branchadminEmail = 'test_branchadmin@happytimes.com';
  const branchadminPassword = 'happytimes_admin_6754';
  const parentEmail = 'qa_parent_manual@happytimes.com';
  const parentPassword = 'happytimes_admin_6754';

  console.log('\n=============================================');
  console.log('RUNNING P0 SEQUENCE: 1. SUPER ADMIN');
  console.log('=============================================');

  // Navigate to login
  await navigate('https://happytimes-preschool-pwa.web.app/login?test=true');
  const allowed = await evaluate("sessionStorage.getItem('browser_login_allowed')");
  console.log(`Value of browser_login_allowed on /login: ${allowed}`);
  await type('input[type="email"]', superadminEmail);
  await type('input[type="password"]', superadminPassword);
  await click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 3500));
  await takeScreenshot('sa_logged_in');

  let saUrl = await evaluate('window.location.href');
  if (saUrl.includes('/super-admin')) {
    results.push({ test: 'Super Admin Login & Redirection', status: 'PASS', details: saUrl });
  } else {
    results.push({ test: 'Super Admin Login & Redirection', status: 'FAIL', details: `Unexpected URL: ${saUrl}` });
    throw new Error('Super Admin redirection failed');
  }

  // 1. Pending Leaves opens/closes correctly
  try {
    console.log('Testing Pending Leaves...');
    await clickByText('Pending Leaves');
    await new Promise(r => setTimeout(r, 1000));
    const isLeavesOpen = await evaluate('!!document.querySelector(".overlay-panel.open")');
    if (isLeavesOpen) {
      results.push({ test: 'SA Pending Leaves opens', status: 'PASS' });
      await takeScreenshot('sa_pending_leaves_open');
      // Close it
      await clickTopBack();
      await new Promise(r => setTimeout(r, 600));
      const closed = await evaluate('!document.querySelector(".overlay-panel.open")');
      if (closed) {
        results.push({ test: 'SA Pending Leaves closes', status: 'PASS' });
      } else {
        results.push({ test: 'SA Pending Leaves closes', status: 'FAIL', details: 'Overlay still open' });
      }
    } else {
      results.push({ test: 'SA Pending Leaves opens', status: 'FAIL', details: 'Overlay drawer not found open' });
    }
  } catch (err) {
    results.push({ test: 'SA Pending Leaves opens/closes', status: 'FAIL', details: err.message });
  }

  // 2. Posts -> New Post opens and we create the targeted posts
  try {
    console.log('Testing Posts -> New Post...');
    await clickByText('Posts');
    await new Promise(r => setTimeout(r, 800));
    
    // Create Global Post
    console.log('Creating Global Post...');
    await clickByText('+ New');
    await new Promise(r => setTimeout(r, 1000));
    await clickByText('All Branches');
    await type('input[placeholder="Post title"]', 'qa_P0_global_post');
    await type('textarea[placeholder="Write your announcement..."]', 'Global announcement for all branches.');
    await click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));
    console.log('Global Post created.');

    // Create ORR Branch Post
    console.log('Creating ORR Branch Post...');
    await clickByText('+ New');
    await new Promise(r => setTimeout(r, 1000));
    await clickByText('Specific Branch');
    await evaluate(`document.querySelector("select").value = "outer-ring-road"; document.querySelector("select").dispatchEvent(new Event(\'change\', { bubbles: true }));`);
    await new Promise(r => setTimeout(r, 500));
    await type('input[placeholder="Post title"]', 'qa_P0_orr_post');
    await type('textarea[placeholder="Write your announcement..."]', 'Announcement for Outer Ring Road branch.');
    await click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));
    console.log('ORR Branch Post created.');

    // Create Mont-2 Class Post under ORR
    console.log('Creating Mont-2 Class Post under ORR...');
    await clickByText('+ New');
    await new Promise(r => setTimeout(r, 1000));
    await clickByText('Specific Class');
    await evaluate(`document.querySelector("select").value = "outer-ring-road"; document.querySelector("select").dispatchEvent(new Event(\'change\', { bubbles: true }));`);
    await new Promise(r => setTimeout(r, 500));
    await evaluate(`document.querySelectorAll("select")[1].value = "Mont-2"; document.querySelectorAll("select")[1].dispatchEvent(new Event(\'change\', { bubbles: true }));`);
    await new Promise(r => setTimeout(r, 500));
    await type('input[placeholder="Post title"]', 'qa_P0_mont2_post');
    await type('textarea[placeholder="Write your announcement..."]', 'Announcement for Mont-2 class.');
    await click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));
    console.log('Mont-2 Class Post created.');

    results.push({ test: 'SA Create Targeted Posts (Global, Branch, Class)', status: 'PASS' });
    await takeScreenshot('sa_posts_created');
  } catch (err) {
    results.push({ test: 'SA Create Targeted Posts', status: 'FAIL', details: err.message });
  }

  // 3. Open Fee Recorder and Refresh page on Fee Recorder route
  try {
    console.log('Navigating directly to Fee Recorder...');
    await navigate('https://happytimes-preschool-pwa.web.app/super-admin/fees');
    await waitForSelector('h1');
    const feeTitle = await evaluate('document.querySelector("h1").textContent');
    if (feeTitle.includes('Fee Recorder')) {
      results.push({ test: 'SA Fee Recorder URL Navigation', status: 'PASS' });
      await takeScreenshot('sa_fee_recorder_direct_url');
      
      // Refresh page on route
      console.log('Refreshing page on Fee Recorder route...');
      await sendCommand('Page.reload');
      await new Promise(r => setTimeout(r, 3000));
      await waitForSelector('h1');
      const feeTitleAfter = await evaluate('document.querySelector("h1").textContent');
      if (feeTitleAfter.includes('Fee Recorder')) {
        results.push({ test: 'SA Fee Recorder Route Refresh', status: 'PASS' });
        await takeScreenshot('sa_fee_recorder_after_refresh');
        
        // Go back
        await click('.app-header-glass button');
        await new Promise(r => setTimeout(r, 1500));
        const finalUrl = await evaluate('window.location.href');
        if (finalUrl.includes('/super-admin') && !finalUrl.includes('/fees')) {
          results.push({ test: 'SA Fee Recorder Back Arrow Navigation', status: 'PASS' });
        } else {
          results.push({ test: 'SA Fee Recorder Back Arrow Navigation', status: 'FAIL', details: `Unexpected URL: ${finalUrl}` });
        }
      } else {
        results.push({ test: 'SA Fee Recorder Route Refresh', status: 'FAIL', details: `Header text mismatch: ${feeTitleAfter}` });
      }
    } else {
      results.push({ test: 'SA Fee Recorder URL Navigation', status: 'FAIL', details: `Header text: ${feeTitle}` });
    }
  } catch (err) {
    results.push({ test: 'SA Fee Recorder URL Navigation / Refresh', status: 'FAIL', details: err.message });
  }

  // Clear session before next test
  console.log('Clearing SA session via CDP...');
  await sendCommand('Storage.clearDataForOrigin', {
    origin: 'https://happytimes-preschool-pwa.web.app',
    storageTypes: 'all'
  });
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n=============================================');
  console.log('RUNNING P0 SEQUENCE: 2. BRANCH ADMIN');
  console.log('=============================================');

  // Log in as Branch Admin
  await navigate('https://happytimes-preschool-pwa.web.app/login?test=true');
  await type('input[type="email"]', branchadminEmail);
  await type('input[type="password"]', branchadminPassword);
  await click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 3500));
  await takeScreenshot('ba_logged_in');

  let baUrl = await evaluate('window.location.href');
  if (baUrl.includes('/branch-admin')) {
    results.push({ test: 'Branch Admin Login & Redirection', status: 'PASS', details: baUrl });
  } else {
    results.push({ test: 'Branch Admin Login & Redirection', status: 'FAIL', details: `Unexpected URL: ${baUrl}` });
    throw new Error('Branch Admin login failed');
  }

  // Wait for hydration and Firestore data to load
  await new Promise(r => setTimeout(r, 2000));

  // Run the overlay drilldown chain twice: Classes -> Mont-2 -> Mont-2 -> Abhinav -> Close -> Back x3
  for (let i = 1; i <= 2; i++) {
    try {
      console.log(`Running overlay stack drilldown iteration ${i}/2...`);
      
      // Tap Classes
      await clickByText('Classes');
      await waitForText('Class Management');
      
      // Tap Mont-2 inside Classes (opens Student Management class list)
      await clickByText('Mont-2');
      await waitForText('Student Management');

      // Tap Mont-2 inside Student Management class list (opens students of Mont-2)
      await clickByText('Mont-2');
      await waitForText('Mont-2 Students');
      await waitForText('Abhinav Surya Kamble', 10000);
      
      // Tap Abhinav Surya Kamble (opens Profile sheet)
      await clickByText('Abhinav Surya Kamble');
      await waitForText('Date of Birth:');
      
      await takeScreenshot(`ba_overlay_drilldown_iter_${i}_open`);
      
      // Close profile sheet
      await clickByText('Close');
      await new Promise(r => setTimeout(r, 600));

      // Back 1: go back to Class list inside Student Management
      await clickTopBack();
      await waitForText('Student Management');

      // Back 2: go back to Class Management overlay
      await clickTopBack();
      await waitForText('Class Management');

      // Back 3: go back to Dashboard
      await clickTopBack();
      await new Promise(r => setTimeout(r, 1000));

      // Verify dashboard visible
      const isDashboardVisible = await evaluate('!!document.querySelector(".action-grid")');
      const isOverlayOpen = await evaluate('!!document.querySelector(".overlay-panel.open")');
      
      if (isDashboardVisible && !isOverlayOpen) {
        results.push({ test: `BA Overlay Drilldown Iteration ${i}`, status: 'PASS' });
      } else {
        results.push({ test: `BA Overlay Drilldown Iteration ${i}`, status: 'FAIL', details: `Dashboard visible: ${isDashboardVisible}, Overlay open: ${isOverlayOpen}` });
      }
    } catch (err) {
      results.push({ test: `BA Overlay Drilldown Iteration ${i}`, status: 'FAIL', details: err.message });
      throw err; // Stop sequence on P0 failure
    }
  }

  // Repeat fast: Dashboard -> Classes -> Mont-2 -> Mont-2 -> Student -> Profile -> Browser Back x4 rapidly
  try {
    console.log('Running rapid history unwind stress test (Browser Back x4)...');
    
    // Tap Classes
    await clickByText('Classes');
    await waitForText('Class Management');
    
    // Tap Mont-2 inside Class Management
    await clickByText('Mont-2');
    await waitForText('Student Management');

    // Tap Mont-2 inside Student Management
    await clickByText('Mont-2');
    await waitForText('Mont-2 Students');
    await waitForText('Abhinav Surya Kamble', 10000);
    
    // Tap Abhinav Surya Kamble
    await clickByText('Abhinav Surya Kamble');
    await waitForText('Date of Birth:');

    const h1 = await getHistoryLength();
    console.log(`History length at maximum depth: ${h1}`);
    await takeScreenshot('ba_rapid_back_before');

    // Trigger Browser Back x4 rapidly
    console.log('Triggering rapid history back operations...');
    await evaluate('window.history.back()');
    await new Promise(r => setTimeout(r, 50));
    await evaluate('window.history.back()');
    await new Promise(r => setTimeout(r, 50));
    await evaluate('window.history.back()');
    await new Promise(r => setTimeout(r, 50));
    await evaluate('window.history.back()');
    await new Promise(r => setTimeout(r, 1500)); // wait for routing to settle

    const finalState = await checkExitedOrBlank();
    const h2 = await getHistoryLength();
    console.log(`History length after unwind: ${h2}, URL: ${finalState.href}`);
    await takeScreenshot('ba_rapid_back_after');

    const dashboardVisible = await evaluate('!!document.querySelector(".action-grid") || !!document.querySelector(".action-card")');
    const isOverlayOpen = await evaluate('!!document.querySelector(".overlay-panel.open")');
    const isProfileSheetOpen = await evaluate('!!document.querySelector(".bottom-sheet.open")');

    // Check conditions
    if (!finalState.isBlank && (finalState.href.includes('/branch-admin') || finalState.href.includes('/login'))) {
      if (!isOverlayOpen && !isProfileSheetOpen) {
        results.push({ test: 'BA Rapid Back Unwind Stress', status: 'PASS', details: `Dashboard/Login visible. Overlays closed. URL: ${finalState.href}` });
      } else {
        results.push({ test: 'BA Rapid Back Unwind Stress', status: 'FAIL', details: `Overlay/Profile sheet stuck. Overlay: ${isOverlayOpen}, Profile: ${isProfileSheetOpen}` });
      }
    } else {
      results.push({ test: 'BA Rapid Back Unwind Stress', status: 'FAIL', details: `Unwind failed. URL: ${finalState.href}, Blank: ${finalState.isBlank}` });
    }
  } catch (err) {
    results.push({ test: 'BA Rapid Back Unwind Stress', status: 'FAIL', details: err.message });
  }

  // Clear session before parent tests
  console.log('Clearing BA session via CDP...');
  await sendCommand('Storage.clearDataForOrigin', {
    origin: 'https://happytimes-preschool-pwa.web.app',
    storageTypes: 'all'
  });
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n=============================================');
  console.log('RUNNING P0 SEQUENCE: 3. PARENT');
  console.log('=============================================');

  // Log in as Parent
  await navigate('https://happytimes-preschool-pwa.web.app/login?test=true');
  await type('input[type="email"]', parentEmail);
  await type('input[type="password"]', parentPassword);
  await click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 4000));
  await takeScreenshot('parent_logged_in');

  let parentUrl = await evaluate('window.location.href');
  if (parentUrl.includes('/parent')) {
    results.push({ test: 'Parent Login & Redirection', status: 'PASS', details: parentUrl });
  } else {
    results.push({ test: 'Parent Login & Redirection', status: 'FAIL', details: `Unexpected URL: ${parentUrl}` });
    throw new Error('Parent login failed');
  }

  // Wait for hydration and data load
  await new Promise(r => setTimeout(r, 2000));

  // 1. Verify notification permission request console logs
  const fcmRequested = browserConsoleLogs.some(log => log.text.includes('NOTIFICATION_PERMISSION_REQUESTED'));
  if (fcmRequested) {
    results.push({ test: 'Parent Notification Permission Request Trigger', status: 'PASS' });
  } else {
    results.push({ test: 'Parent Notification Permission Request Trigger', status: 'FAIL', details: 'FCM permission request not intercepted.' });
  }

  // 2. Verify post visibility (global + ORR + Mont-2)
  try {
    console.log('Navigating to Feed...');
    await clickByText('Feed');
    await waitForText('qa_P0_global_post', 10000);
    await takeScreenshot('parent_feed_tab');

    // Retrieve all visible post titles in the DOM
    const visibleTitles = await evaluate(`(() => {
      const titles = Array.from(document.querySelectorAll(".post-title, h3, h4")).map(e => e.textContent.trim());
      return titles;
    })()`);
    console.log('Visible post titles in feed:', visibleTitles);

    const hasGlobal = visibleTitles.some(t => t.includes('qa_P0_global_post'));
    const hasBranch = visibleTitles.some(t => t.includes('qa_P0_orr_post'));
    const hasClass = visibleTitles.some(t => t.includes('qa_P0_mont2_post'));

    if (hasGlobal && hasBranch && hasClass) {
      results.push({ test: 'Parent Feed Scoped Posts Visibility', status: 'PASS' });
    } else {
      results.push({ test: 'Parent Feed Scoped Posts Visibility', status: 'FAIL', details: `Global: ${hasGlobal}, Branch: ${hasBranch}, Class: ${hasClass}. Titles: ${JSON.stringify(visibleTitles)}` });
    }
  } catch (err) {
    results.push({ test: 'Parent Feed Scoped Posts Visibility', status: 'FAIL', details: err.message });
  }

  // 3. Verify Leave Request Submission
  try {
    console.log('Navigating to Leaves...');
    await clickByText('Leaves');
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('parent_leaves_tab');

    // Type notes and submit leave
    await type('textarea', 'qa_P0_parent_leave_request_notes');
    await takeScreenshot('parent_leaves_form_filled');
    await clickByText('Submit Leave Request');
    await new Promise(r => setTimeout(r, 2000));
    await takeScreenshot('parent_leaves_submitted_history');

    // Check if redirected to History tab and see the leave
    const isHistoryActive = await evaluate(`(() => {
      const tabButton = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Leave History"));
      return tabButton && tabButton.className.includes("active");
    })()`);

    const hasLeaveInHistory = await evaluate(`(() => {
      return document.body.textContent.includes("qa_P0_parent_leave_request_notes");
    })()`);

    if (isHistoryActive || hasLeaveInHistory) {
      results.push({ test: 'Parent Leave Request Submission', status: 'PASS' });
    } else {
      results.push({ test: 'Parent Leave Request Submission', status: 'FAIL', details: `History active: ${isHistoryActive}, Leave found: ${hasLeaveInHistory}` });
    }
  } catch (err) {
    results.push({ test: 'Parent Leave Request Submission', status: 'FAIL', details: err.message });
  }

  // 4. Verify Fee Visibility
  try {
    console.log('Navigating to Fees...');
    await clickByText('Fees');
    await new Promise(r => setTimeout(r, 1500));
    await takeScreenshot('parent_fees_tab');

    const hasFeesLedger = await evaluate(`(() => {
      return document.body.textContent.includes("Total") && document.body.textContent.includes("Paid") && document.body.textContent.includes("Pending");
    })()`);

    if (hasFeesLedger) {
      results.push({ test: 'Parent Fee Ledger Visibility', status: 'PASS' });
    } else {
      results.push({ test: 'Parent Fee Ledger Visibility', status: 'FAIL', details: 'Total/Paid/Pending text labels not found' });
    }
  } catch (err) {
    results.push({ test: 'Parent Fee Ledger Visibility', status: 'FAIL', details: err.message });
  }

  // Clean up Parent session
  console.log('Clearing Parent session via CDP...');
  await sendCommand('Storage.clearDataForOrigin', {
    origin: 'https://happytimes-preschool-pwa.web.app',
    storageTypes: 'all'
  });
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n=============================================');
  console.log('CDP VERIFICATION RESULTS');
  console.log('=============================================');
  console.log(JSON.stringify(results, null, 2));

  // Save results report
  const resultsReportPath = 'cdp_verification_results.json';
  writeFileSync(resultsReportPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Report written successfully to: ${resultsReportPath}`);
  
  // Close connection
  ws.close();
}

async function runTestsWrapper() {
  try {
    await runTests();
    console.log('Test run completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Test run failed with error:', err);
    try {
      if (ws && ws.readyState === 1) {
        const url = await evaluate('window.location.href');
        console.log('Failure URL:', url);
        const html = await evaluate('document.body.innerHTML');
        console.log('Failure HTML content:', html.slice(0, 1000));
        writeFileSync(`${SCREENSHOT_DIR}/failure_html.html`, html, 'utf-8');
        console.log(`Saved full failure HTML to: ${SCREENSHOT_DIR}/failure_html.html`);
        await takeScreenshot('failure_diagnostics');
      }
    } catch (diagErr) {
      console.error('Failed to capture failure diagnostics:', diagErr);
    }
    if (ws) {
      try {
        ws.close();
      } catch (e) {}
    }
    process.exit(1);
  }
}

runTestsWrapper().catch(console.error);
