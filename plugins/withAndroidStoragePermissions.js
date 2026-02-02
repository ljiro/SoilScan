/**
 * Expo config plugin: ensures storage permissions are in the built app's AndroidManifest.
 * This makes file-related permissions show under App permissions and allows "All files access".
 *
 * Important: Run with cache clear so the native project is regenerated:
 *   eas build -p android --profile preview --clear-cache
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const STORAGE_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.MANAGE_EXTERNAL_STORAGE',
];

function addStoragePermissions(androidManifest) {
  if (!androidManifest.manifest) {
    androidManifest.manifest = {};
  }
  if (!Array.isArray(androidManifest.manifest['uses-permission'])) {
    androidManifest.manifest['uses-permission'] = [];
  }
  const list = androidManifest.manifest['uses-permission'];
  const existing = list.map((p) => (p.$ && p.$['android:name']) || '').filter(Boolean);
  for (const perm of STORAGE_PERMISSIONS) {
    if (!existing.includes(perm)) {
      list.push({ $: { 'android:name': perm } });
    }
  }
}

function withAndroidStoragePermissions(config) {
  return withAndroidManifest(config, (config) => {
    addStoragePermissions(config.modResults);
    return config;
  });
}

module.exports = withAndroidStoragePermissions;
