/* eslint-disable no-undef */
// Firebase Cloud Messaging Service Worker
// This runs in the background to receive push notifications even when the app is closed

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

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  if (title) {
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data,
    });
  }
});
