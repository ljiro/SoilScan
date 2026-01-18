import { DeviceMotion } from 'expo-sensors';

let subscription = null;
let currentOrientation = {
  pitch: 0,  // Forward/backward tilt (-90 to 90)
  roll: 0,   // Left/right tilt (-180 to 180)
  heading: 0 // Compass heading (0 to 360)
};

let listeners = [];

/**
 * Start tracking device orientation
 */
export const startOrientationTracking = async () => {
  const isAvailable = await DeviceMotion.isAvailableAsync();
  if (!isAvailable) {
    console.warn('DeviceMotion is not available on this device');
    return false;
  }

  // Set update interval to 100ms for smooth updates
  DeviceMotion.setUpdateInterval(100);

  subscription = DeviceMotion.addListener((data) => {
    if (data.rotation) {
      // Convert radians to degrees
      const toDegrees = (rad) => (rad * 180) / Math.PI;

      // Beta is pitch (forward/backward tilt)
      // Gamma is roll (left/right tilt)
      // Alpha is yaw/heading
      currentOrientation = {
        pitch: Math.round(toDegrees(data.rotation.beta)),
        roll: Math.round(toDegrees(data.rotation.gamma)),
        heading: Math.round(toDegrees(data.rotation.alpha))
      };

      // Normalize heading to 0-360
      if (currentOrientation.heading < 0) {
        currentOrientation.heading += 360;
      }

      // Notify all listeners
      listeners.forEach(callback => callback(currentOrientation));
    }
  });

  return true;
};

/**
 * Stop tracking device orientation
 */
export const stopOrientationTracking = () => {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
};

/**
 * Add a listener for orientation changes
 * @param {Function} callback - Function to call with orientation data
 * @returns {Function} - Unsubscribe function
 */
export const addOrientationListener = (callback) => {
  listeners.push(callback);
  // Return unsubscribe function
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
};

/**
 * Get current orientation synchronously
 */
export const getCurrentOrientation = () => ({ ...currentOrientation });

/**
 * Get pitch description for UI display
 */
export const getPitchDescription = (pitch) => {
  if (pitch >= -10 && pitch <= 10) return 'Level';
  if (pitch > 10 && pitch <= 45) return 'Tilted Down';
  if (pitch > 45) return 'Pointing Down';
  if (pitch < -10 && pitch >= -45) return 'Tilted Up';
  return 'Pointing Up';
};

/**
 * Get heading direction for UI display
 */
export const getHeadingDirection = (heading) => {
  if (heading >= 337.5 || heading < 22.5) return 'N';
  if (heading >= 22.5 && heading < 67.5) return 'NE';
  if (heading >= 67.5 && heading < 112.5) return 'E';
  if (heading >= 112.5 && heading < 157.5) return 'SE';
  if (heading >= 157.5 && heading < 202.5) return 'S';
  if (heading >= 202.5 && heading < 247.5) return 'SW';
  if (heading >= 247.5 && heading < 292.5) return 'W';
  return 'NW';
};
