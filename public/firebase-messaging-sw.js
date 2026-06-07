/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker
// Handles background push notifications + notification click → app navigation

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDixFR1hkz9rqEr8rcUen8r7aosAHXXgT0',
  authDomain: 'happytimes-preschool-pwa.firebaseapp.com',
  projectId: 'happytimes-preschool-pwa',
  storageBucket: 'happytimes-preschool-pwa.firebasestorage.app',
  messagingSenderId: '390518602758',
  appId: '1:390518602758:web:bc23ea8bf2ffce9a35d787',
});

const messaging = firebase.messaging();

// ─── Background Message Handler ────────────────────────────────────────────
// Fires when the app is in background / closed / on a different tab.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  if (!title) return;

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',          // Small status-bar icon on Android
    vibrate: [200, 100, 200],        // Vibration pattern: buzz-pause-buzz
    tag: payload.data?.tag || 'ht-notification', // Deduplicate same-type notifications
    renotify: false,                 // Don't buzz again if tag already exists
    data: payload.data || {},        // Pass through for notificationclick handler
    actions: [
      { action: 'open', title: 'View' },
    ],
  });
});

// ─── Notification Click Handler ────────────────────────────────────────────
// Fires when the user taps a notification — focuses the app or opens it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Determine where to navigate: use data.url from the payload, or default to /portal
  const targetUrl = event.notification.data?.url || '/portal';
  const fullUrl = self.location.origin + targetUrl;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the app is already open in a window, focus it and navigate
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          if ('focus' in client) {
            client.navigate(fullUrl);
            return client.focus();
          }
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});
