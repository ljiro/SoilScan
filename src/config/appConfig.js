export const APP_CONFIG = {
  appName: 'AgriCapture',
  version: '1.0.0',

  camera: {
    targetWidth: 1920,
    targetHeight: 1440,
    quality: 0.75,
    aspectRatio: '4:3',
  },

  gps: {
    accuracyThreshold: 50, // meters
    timeout: 15000, // ms
  },

  storage: {
    maxImageSizeMB: 5,
  },
};
