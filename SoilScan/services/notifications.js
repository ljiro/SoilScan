import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@soilscan_push_token';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register for push notifications
export async function registerForPushNotifications() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'SoilScan Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#5D9C59',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token - permission not granted');
      return null;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: 'your-project-id', // Replace with your Expo project ID
      })).data;

      // Save token for later use
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    } catch (error) {
      console.log('Error getting push token:', error);
    }
  } else {
    console.log('Push notifications require a physical device');
  }

  return token;
}

// Get stored push token
export async function getPushToken() {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

// Schedule a local notification
export async function scheduleLocalNotification({
  title,
  body,
  data = {},
  trigger = null, // null = immediate, or { seconds: 60 } for delay
}) {
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger,
  });
  return id;
}

// Cancel a scheduled notification
export async function cancelNotification(notificationId) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// Cancel all scheduled notifications
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Notification types for the app
export const NotificationTypes = {
  SCAN_COMPLETE: 'scan_complete',
  FERTILIZER_REMINDER: 'fertilizer_reminder',
  WEATHER_ALERT: 'weather_alert',
};

// Send scan completion notification
export async function notifyScanComplete(soilType, confidence) {
  return scheduleLocalNotification({
    title: 'Soil Analysis Complete',
    body: `Detected ${soilType} soil with ${Math.round(confidence * 100)}% confidence`,
    data: { type: NotificationTypes.SCAN_COMPLETE, soilType, confidence },
  });
}

// Send fertilizer reminder notification
export async function notifyFertilizerReminder(recommendation) {
  return scheduleLocalNotification({
    title: 'Fertilizer Reminder',
    body: `Time to apply ${recommendation} to your soil`,
    data: { type: NotificationTypes.FERTILIZER_REMINDER, recommendation },
    trigger: { seconds: 1 }, // Can be customized
  });
}

// Send weather alert notification
export async function notifyWeatherAlert(condition, impact) {
  return scheduleLocalNotification({
    title: 'Weather Alert',
    body: `${condition} - ${impact}`,
    data: { type: NotificationTypes.WEATHER_ALERT, condition, impact },
  });
}

// Add notification listeners
export function addNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

// Get badge count
export async function getBadgeCount() {
  return await Notifications.getBadgeCountAsync();
}

// Set badge count
export async function setBadgeCount(count) {
  await Notifications.setBadgeCountAsync(count);
}

// Clear badge
export async function clearBadge() {
  await Notifications.setBadgeCountAsync(0);
}

export default {
  registerForPushNotifications,
  getPushToken,
  scheduleLocalNotification,
  cancelNotification,
  cancelAllNotifications,
  notifyScanComplete,
  notifyFertilizerReminder,
  notifyWeatherAlert,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getBadgeCount,
  setBadgeCount,
  clearBadge,
  NotificationTypes,
};
