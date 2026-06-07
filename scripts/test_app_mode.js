// Programmatic Unit & Integration Tests for PWA App Mode Detection Helper
// This script simulates various browser environments, device user agents, and window states 
// to verify that the appMode utility functions correctly.

import { readFileSync } from 'fs';

// Since the file uses ESM exports, let's load it dynamically or evaluate it in a simulated browser context.
const appModeCode = readFileSync('src/utils/appMode.js', 'utf-8');

// Mock window, navigator, document
const testContext = {
  window: {
    matchMedia: (query) => ({
      matches: false,
      media: query,
    }),
    location: {
      search: '',
    },
    navigator: {}
  },
  navigator: {},
  document: {
    referrer: '',
  }
};

// Evaluator function to run the appMode.js code within a mocked environment
function runInContext(ctx) {
  const evalCode = `
    return (function() {
      // Mock globals
      const window = ctx.window;
      const navigator = ctx.window.navigator;
      const document = ctx.document;

      // Extract exports manually from ES module code
      ${appModeCode.replace(/export\s+function/g, 'function')}

      return { isStandalone, isInstalledApp, isBrowserMode };
    })()
  `;
  // Using standard Function constructor to evaluate the sandboxed mock context
  return new Function('ctx', evalCode)(ctx);
}

const testCases = [
  {
    name: 'Android Chrome browser',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: false });
      ctx.window.navigator.standalone = undefined;
      ctx.document.referrer = '';
      ctx.window.location.search = '';
    },
    expectedStandalone: false,
  },
  {
    name: 'Android installed PWA (display-mode: standalone)',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: q.includes('display-mode: standalone') });
      ctx.window.navigator.standalone = undefined;
      ctx.document.referrer = '';
    },
    expectedStandalone: true,
  },
  {
    name: 'Android installed PWA (display-mode: fullscreen)',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: q.includes('display-mode: fullscreen') });
      ctx.window.navigator.standalone = undefined;
      ctx.document.referrer = '';
    },
    expectedStandalone: true,
  },
  {
    name: 'Android installed PWA (display-mode: minimal-ui)',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: q.includes('display-mode: minimal-ui') });
      ctx.window.navigator.standalone = undefined;
      ctx.document.referrer = '';
    },
    expectedStandalone: true,
  },
  {
    name: 'Android PWA launch from custom launcher (TWA referrer)',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: false });
      ctx.window.navigator.standalone = undefined;
      ctx.document.referrer = 'android-app://com.happytimes.pwa';
    },
    expectedStandalone: true,
  },
  {
    name: 'Samsung Internet browser',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: false });
      ctx.window.navigator.standalone = undefined;
      ctx.document.referrer = '';
    },
    expectedStandalone: false,
  },
  {
    name: 'Safari iPhone (browser)',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: false });
      ctx.window.navigator.standalone = false;
      ctx.document.referrer = '';
    },
    expectedStandalone: false,
  },
  {
    name: 'Safari iPhone (Add to Home Screen installed PWA)',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: false });
      ctx.window.navigator.standalone = true;
      ctx.document.referrer = '';
    },
    expectedStandalone: true,
  },
  {
    name: 'iPad Safari (browser)',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: false });
      ctx.window.navigator.standalone = false;
      ctx.document.referrer = '';
    },
    expectedStandalone: false,
  },
  {
    name: 'Desktop Chrome (browser)',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: false });
      ctx.window.navigator.standalone = undefined;
      ctx.document.referrer = '';
    },
    expectedStandalone: false,
  },
  {
    name: 'Desktop Chrome (PWA standalone window)',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: q.includes('display-mode: standalone') });
      ctx.window.navigator.standalone = undefined;
      ctx.document.referrer = '';
    },
    expectedStandalone: true,
  },
  {
    name: 'Desktop Edge (browser)',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: false });
      ctx.window.navigator.standalone = undefined;
      ctx.document.referrer = '';
    },
    expectedStandalone: false,
  },
  {
    name: 'Incognito mode (browser)',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: false });
      ctx.window.navigator.standalone = undefined;
      ctx.document.referrer = '';
    },
    expectedStandalone: false,
  },
  {
    name: 'PWA Launch via custom query parameter',
    setup: (ctx) => {
      ctx.window.matchMedia = (q) => ({ matches: false });
      ctx.window.navigator.standalone = undefined;
      ctx.document.referrer = '';
      ctx.window.location.search = '?mode=standalone';
    },
    expectedStandalone: true,
  }
];

function runTests() {
  console.log('--- STARTING PWA DETECT APP MODE UNIT TESTS ---');
  let passedCount = 0;

  testCases.forEach((tc) => {
    // Reset test context
    const ctx = JSON.parse(JSON.stringify(testContext));
    ctx.window.matchMedia = testContext.window.matchMedia; // Preserve function reference
    
    // Apply test case setup
    tc.setup(ctx);

    // Evaluate
    const { isStandalone, isBrowserMode } = runInContext(ctx);
    const result = isStandalone();

    const passed = result === tc.expectedStandalone;
    if (passed) {
      console.log(`✅ [PASS] ${tc.name} -> Expected standalone: ${tc.expectedStandalone}, got: ${result}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${tc.name} -> Expected standalone: ${tc.expectedStandalone}, got: ${result}`);
    }
  });

  console.log(`\nTEST RESULTS: ${passedCount}/${testCases.length} Passed`);
  
  if (passedCount === testCases.length) {
    console.log('🎉 ALL PWA DETECTION UNIT TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runTests();
