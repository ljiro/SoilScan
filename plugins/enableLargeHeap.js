/**
 * Expo config plugin: enables android:largeHeap in AndroidManifest.
 * Reduces OOM when exporting large ZIPs (many images) on low-memory devices.
 * Rebuild required: eas build -p android --clear-cache (or local run)
 */

const { withAndroidManifest } = require('@expo/config-plugins');

function withLargeHeap(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest?.application?.[0];
    if (app?.$) {
      app.$['android:largeHeap'] = 'true';
    }
    return config;
  });
}

module.exports = withLargeHeap;
