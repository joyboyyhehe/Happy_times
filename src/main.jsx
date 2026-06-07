import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { ToastProvider } from './components/Toast.jsx';
import App from './App.jsx';
import './index.css';
import { initGlobalErrorTracking } from './services/telemetry.js';

// Initialize production observability error tracking
initGlobalErrorTracking();

// iOS Standalone PWA adjustments & keyboard snap-back fix
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

if (isIOS) {
  document.documentElement.classList.add('is-ios');
  if (isStandalone) {
    document.documentElement.classList.add('ios-standalone');
  }
  
  // Force WebKit to reset scroll position on input blur, resolving the shifted layout/notch overlay bug
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      window.scrollTo(0, 0);
    }, 40);
  });
}


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
