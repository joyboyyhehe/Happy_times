import { initNotifications as fbInitNotifications } from './notifications.js';

/**
 * Initialize PWA Push Notifications and FCM token uploads.
 */
export async function initializePushNotifications() {
  try {
    await fbInitNotifications();
  } catch (error) {
    console.error('[notificationService] Failed to initialize push notifications:', error);
    // Silent catch: push notifications are optional, login should never fail due to notification permission blocks.
  }
}
