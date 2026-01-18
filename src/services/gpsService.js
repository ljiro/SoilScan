import * as Location from 'expo-location';
import * as Network from 'expo-network';

// Benguet Province approximate bounds for validation
const BENGUET_BOUNDS = {
  minLat: 16.25,
  maxLat: 16.65,
  minLng: 120.45,
  maxLng: 120.95,
};

// Accuracy thresholds (meters)
const ACCURACY = {
  EXCELLENT: 5,
  GOOD: 10,
  FAIR: 20,
  POOR: 50,
};

// Configuration - optimized for speed
const CONFIG = {
  maxReadings: 3, // Reduced from 5 for speed
  maxReadingsAccurate: 5, // For accurate location requests
  readingInterval: 500, // Reduced from 800
  watchInterval: 3000,
  watchDistance: 2,
  highAccuracyTimeout: 2000,
  balancedAccuracyTimeout: 2000,
  lowAccuracyTimeout: 1000,
  cacheExpiryMs: 30000, // 30 seconds cache validity
  maxRetries: 3,
  retryBaseDelayMs: 500,
};

// Location cache
let locationCache = {
  location: null,
  timestamp: null,
  source: null,
};

// Background fetch promise (for returning cached while fetching fresh)
let backgroundFetchPromise = null;

/**
 * Check network connectivity
 */
export const isOnline = async () => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected && networkState.isInternetReachable;
  } catch (error) {
    console.warn('Network check failed:', error.message);
    // Assume online if check fails - better to try than not
    return true;
  }
};

/**
 * Update the location cache
 */
const updateCache = (location, source = 'gps') => {
  if (location && validateLocationData(location)) {
    locationCache = {
      location: { ...location },
      timestamp: Date.now(),
      source,
    };
  }
};

/**
 * Get cached location immediately
 */
export const getCachedLocation = () => {
  if (!locationCache.location) {
    return null;
  }

  const age = Date.now() - locationCache.timestamp;
  return {
    ...locationCache.location,
    cached: true,
    cacheAge: age,
    cacheSource: locationCache.source,
    isExpired: age > CONFIG.cacheExpiryMs,
  };
};

/**
 * Validate location data before returning
 */
const validateLocationData = (location) => {
  if (!location) return false;

  // Check required fields exist
  if (location.latitude == null || location.longitude == null) {
    return false;
  }

  // Check values are valid numbers
  if (isNaN(location.latitude) || isNaN(location.longitude)) {
    return false;
  }

  // Check latitude is in valid range
  if (location.latitude < -90 || location.latitude > 90) {
    return false;
  }

  // Check longitude is in valid range
  if (location.longitude < -180 || location.longitude > 180) {
    return false;
  }

  // Check for obviously bad coordinates (0,0)
  if (location.latitude === 0 && location.longitude === 0) {
    return false;
  }

  return true;
};

/**
 * Request location permissions
 */
export const requestPermissions = async () => {
  try {
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    return { granted: status === 'granted', canAskAgain };
  } catch (error) {
    console.error('Permission request error:', error);
    return { granted: false, canAskAgain: false };
  }
};

/**
 * Check if permissions are already granted
 */
export const checkPermissions = async () => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

// Legacy export for compatibility
export const requestLocationPermission = async () => {
  const result = await requestPermissions();
  return result.granted;
};

/**
 * Check if location services are enabled
 */
const checkLocationServices = async () => {
  try {
    const enabled = await Location.hasServicesEnabledAsync();
    return enabled;
  } catch (error) {
    console.warn('Location services check failed:', error.message);
    return false;
  }
};

/**
 * Get location with specific accuracy and timeout
 * Returns null on failure instead of throwing
 */
const getLocationWithAccuracy = async (accuracy, timeoutMs) => {
  // Create a timeout promise that resolves to null
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  // Create the location fetch promise
  const locationPromise = (async () => {
    try {
      const result = await Location.getCurrentPositionAsync({
        accuracy,
        maximumAge: 1000, // Accept readings up to 1 second old for speed
      });

      if (result && result.coords) {
        const location = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          altitude: result.coords.altitude,
          accuracy: result.coords.accuracy,
          altitudeAccuracy: result.coords.altitudeAccuracy,
          heading: result.coords.heading,
          speed: result.coords.speed,
          timestamp: result.timestamp,
        };

        if (validateLocationData(location)) {
          return location;
        }
        return null;
      }
      return null;
    } catch (error) {
      console.warn(`Location fetch failed (accuracy: ${accuracy}):`, error.message);
      return null;
    }
  })();

  // Race the location fetch against the timeout
  return Promise.race([locationPromise, timeoutPromise]);
};

/**
 * Race multiple location requests - first valid result wins
 */
const raceLocationRequests = async (requests) => {
  return new Promise((resolve) => {
    let resolved = false;
    let completedCount = 0;

    requests.forEach(async (request) => {
      try {
        const result = await request();
        if (!resolved && result && validateLocationData(result)) {
          resolved = true;
          resolve(result);
        }
      } catch {
        // Ignore individual failures
      } finally {
        completedCount++;
        // If all requests completed and nothing resolved, return null
        if (completedCount === requests.length && !resolved) {
          resolve(null);
        }
      }
    });

    // Fallback timeout in case something hangs
    setTimeout(() => {
      if (!resolved) {
        resolve(null);
      }
    }, 6000);
  });
};

/**
 * Get location with cascading fallbacks
 * Tries multiple strategies from high to low accuracy
 */
const getLocationWithFallbacks = async () => {
  // Check if location services are enabled first
  const servicesEnabled = await checkLocationServices();
  if (!servicesEnabled) {
    console.warn('Location services are disabled');
    return getCachedLocation();
  }

  // Check permissions
  const hasPermission = await checkPermissions();
  if (!hasPermission) {
    console.warn('Location permissions not granted');
    return getCachedLocation();
  }

  // Strategy 1: Try high accuracy with short timeout
  let location = await getLocationWithAccuracy(
    Location.Accuracy.BestForNavigation,
    CONFIG.highAccuracyTimeout
  );

  if (location) {
    updateCache(location, 'high_accuracy');
    return location;
  }

  // Strategy 2: Fall back to balanced accuracy
  location = await getLocationWithAccuracy(
    Location.Accuracy.Balanced,
    CONFIG.balancedAccuracyTimeout
  );

  if (location) {
    updateCache(location, 'balanced_accuracy');
    return location;
  }

  // Strategy 3: Fall back to low accuracy
  location = await getLocationWithAccuracy(
    Location.Accuracy.Low,
    CONFIG.lowAccuracyTimeout
  );

  if (location) {
    updateCache(location, 'low_accuracy');
    return location;
  }

  // Strategy 4: Use cached location as last resort
  const cached = getCachedLocation();
  if (cached) {
    console.warn('Using cached location as fallback');
    return cached;
  }

  return null;
};

/**
 * Get location with retry logic and exponential backoff
 */
const getLocationWithRetry = async (maxRetries = CONFIG.maxRetries) => {
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const location = await getLocationWithFallbacks();
      if (location) {
        return location;
      }
    } catch (error) {
      lastError = error;
    }

    // Exponential backoff before retry
    if (attempt < maxRetries - 1) {
      const delay = CONFIG.retryBaseDelayMs * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  console.warn('All location attempts failed:', lastError?.message);
  return getCachedLocation();
};

/**
 * Get a single location reading with specified accuracy
 */
const getSingleReading = async (accuracy = Location.Accuracy.BestForNavigation) => {
  return Location.getCurrentPositionAsync({
    accuracy,
  });
};

/**
 * Get averaged location from multiple readings for higher accuracy
 * Critical for thesis data correlating with satellite imagery
 */
export const getAveragedLocation = async (onProgress = null, maxReadings = CONFIG.maxReadings) => {
  const readings = [];

  for (let i = 0; i < maxReadings; i++) {
    try {
      const reading = await getSingleReading();
      const { coords } = reading;

      if (coords.accuracy <= ACCURACY.POOR) {
        readings.push({
          latitude: coords.latitude,
          longitude: coords.longitude,
          altitude: coords.altitude,
          accuracy: coords.accuracy,
          altitudeAccuracy: coords.altitudeAccuracy,
          heading: coords.heading,
          speed: coords.speed,
          timestamp: reading.timestamp,
        });
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: maxReadings,
          bestAccuracy: readings.length > 0
            ? Math.min(...readings.map(r => r.accuracy))
            : null,
        });
      }

      // Early exit with excellent accuracy
      if (readings.length >= 2 && readings[readings.length - 1].accuracy <= ACCURACY.EXCELLENT) {
        break;
      }

      if (i < maxReadings - 1) {
        await new Promise(r => setTimeout(r, CONFIG.readingInterval));
      }
    } catch (error) {
      console.warn(`Reading ${i + 1} failed:`, error.message);
    }
  }

  if (readings.length === 0) return null;

  const averaged = averageReadings(readings);
  if (averaged) {
    updateCache(averaged, 'averaged');
  }
  return averaged;
};

/**
 * Average multiple GPS readings
 */
const averageReadings = (readings) => {
  const n = readings.length;

  const avgLat = readings.reduce((sum, r) => sum + r.latitude, 0) / n;
  const avgLng = readings.reduce((sum, r) => sum + r.longitude, 0) / n;

  const altReadings = readings.filter(r => r.altitude != null);
  const avgAlt = altReadings.length > 0
    ? altReadings.reduce((sum, r) => sum + r.altitude, 0) / altReadings.length
    : null;

  const bestAccuracy = Math.min(...readings.map(r => r.accuracy));

  const altAccReadings = readings.filter(r => r.altitudeAccuracy != null);
  const avgAltAcc = altAccReadings.length > 0
    ? altAccReadings.reduce((sum, r) => sum + r.altitudeAccuracy, 0) / altAccReadings.length
    : null;

  return {
    latitude: avgLat,
    longitude: avgLng,
    altitude: avgAlt,
    accuracy: bestAccuracy,
    altitudeAccuracy: avgAltAcc,
    heading: readings[readings.length - 1].heading,
    speed: readings[readings.length - 1].speed,
    timestamp: Date.now(),
    readingCount: n,
    isAveraged: n > 1,
  };
};

/**
 * Get location as fast as possible with all fallbacks
 * Returns cached location immediately, fetches fresh in background
 */
export const getFastLocation = async (returnCachedImmediately = true) => {
  // Check if we're offline - use cache only
  const online = await isOnline();
  if (!online) {
    const cached = getCachedLocation();
    if (cached) {
      return { ...cached, offlineMode: true };
    }
    return null;
  }

  // Return cached immediately if available and requested
  const cached = getCachedLocation();
  if (returnCachedImmediately && cached && !cached.isExpired) {
    // Start background fetch for next request
    if (!backgroundFetchPromise) {
      backgroundFetchPromise = getLocationWithRetry().finally(() => {
        backgroundFetchPromise = null;
      });
    }
    return { ...cached, backgroundRefreshing: true };
  }

  // Race parallel location requests for fastest result
  const location = await raceLocationRequests([
    () => getLocationWithAccuracy(Location.Accuracy.High, CONFIG.highAccuracyTimeout),
    () => getLocationWithAccuracy(Location.Accuracy.Balanced, CONFIG.balancedAccuracyTimeout + 500),
  ]);

  if (location) {
    updateCache(location, 'fast');
    return location;
  }

  // Fall back to full retry logic
  return getLocationWithRetry();
};

/**
 * Get location with higher accuracy (takes more time)
 * Uses more readings for averaging
 */
export const getAccurateLocation = async (onProgress = null) => {
  // Check network and permissions first
  const online = await isOnline();
  const hasPermission = await checkPermissions();
  const servicesEnabled = await checkLocationServices();

  if (!hasPermission) {
    console.warn('Location permissions not granted for accurate location');
    return null;
  }

  if (!servicesEnabled) {
    console.warn('Location services disabled for accurate location');
    return null;
  }

  // If offline, try to get what we can quickly
  if (!online) {
    const cached = getCachedLocation();
    if (cached) {
      return { ...cached, offlineMode: true };
    }
  }

  // Get averaged location with more readings
  const location = await getAveragedLocation(onProgress, CONFIG.maxReadingsAccurate);

  if (location) {
    updateCache(location, 'accurate');
    return location;
  }

  // Fall back to fast location if averaging fails
  return getFastLocation(false);
};

/**
 * Legacy getCurrentLocation for compatibility
 * @param {number} _maxRetries - Deprecated, kept for backward compatibility
 */
export const getCurrentLocation = async (_maxRetries = 3) => {
  return getAveragedLocation();
};

/**
 * Get quick single location for display
 */
export const getQuickLocation = async () => {
  try {
    // Try fast location first
    const fast = await getFastLocation(true);
    if (fast) return fast;

    // Fall back to direct API call
    const { coords, timestamp } = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const location = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      altitude: coords.altitude,
      accuracy: coords.accuracy,
      altitudeAccuracy: coords.altitudeAccuracy,
      heading: coords.heading,
      speed: coords.speed,
      timestamp,
    };

    updateCache(location, 'quick');
    return location;
  } catch (error) {
    console.error('Quick location error:', error);
    return getCachedLocation();
  }
};

/**
 * Watch location with debounced updates
 * Returns unsubscribe function
 */
export const watchLocation = async (callback, options = {}) => {
  const interval = options.timeInterval || CONFIG.watchInterval;
  const distance = options.distanceInterval || CONFIG.watchDistance;

  let lastUpdate = 0;

  try {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: interval,
        distanceInterval: distance,
      },
      (location) => {
        const now = Date.now();
        if (now - lastUpdate < 1500) return; // Debounce
        lastUpdate = now;

        const locationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          accuracy: location.coords.accuracy,
          altitudeAccuracy: location.coords.altitudeAccuracy,
          heading: location.coords.heading,
          speed: location.coords.speed,
          timestamp: location.timestamp,
        };

        // Update cache with watched location
        updateCache(locationData, 'watch');

        callback(locationData);
      }
    );

    return subscription;
  } catch (error) {
    console.error('Watch location error:', error);
    return null;
  }
};

/**
 * Validate coordinates are within Benguet Province
 */
export const validateBenguetBounds = (latitude, longitude) => {
  const { minLat, maxLat, minLng, maxLng } = BENGUET_BOUNDS;

  const isValid =
    latitude >= minLat && latitude <= maxLat &&
    longitude >= minLng && longitude <= maxLng;

  return {
    isValid,
    message: isValid ? null : 'Coordinates are outside Benguet Province.',
  };
};

/**
 * Get accuracy quality for UI
 */
export const getAccuracyQuality = (accuracyMeters) => {
  if (accuracyMeters == null) {
    return { level: 'unknown', color: '#999', label: 'Unknown', score: 0 };
  }
  if (accuracyMeters <= ACCURACY.EXCELLENT) {
    return { level: 'excellent', color: '#4CAF50', label: 'Excellent', score: 5 };
  }
  if (accuracyMeters <= ACCURACY.GOOD) {
    return { level: 'good', color: '#8BC34A', label: 'Good', score: 4 };
  }
  if (accuracyMeters <= ACCURACY.FAIR) {
    return { level: 'fair', color: '#FF9800', label: 'Fair', score: 3 };
  }
  if (accuracyMeters <= ACCURACY.POOR) {
    return { level: 'poor', color: '#FF5722', label: 'Poor', score: 2 };
  }
  return { level: 'very_poor', color: '#F44336', label: 'Very Poor', score: 1 };
};

/**
 * Format coordinate for display
 */
export const formatCoordinate = (value, decimals = 6) => {
  if (value == null) return '--';
  return value.toFixed(decimals);
};

/**
 * Format accuracy for display
 */
export const formatAccuracy = (meters) => {
  if (meters == null) return '--';
  if (meters < 1) return '< 1m';
  if (meters < 10) return `${meters.toFixed(1)}m`;
  return `${Math.round(meters)}m`;
};

/**
 * Check if location is suitable for data collection
 */
export const isLocationSuitable = (location) => {
  if (!location) return { suitable: false, reason: 'No location data' };

  if (location.accuracy == null) {
    return { suitable: false, reason: 'Accuracy unknown' };
  }

  if (location.accuracy > ACCURACY.FAIR) {
    return {
      suitable: false,
      reason: `Low accuracy (${Math.round(location.accuracy)}m). Move to open area.`,
    };
  }

  const bounds = validateBenguetBounds(location.latitude, location.longitude);
  if (!bounds.isValid) {
    return { suitable: false, reason: bounds.message };
  }

  return { suitable: true, reason: null };
};

/**
 * Create location data for CSV storage
 */
export const createLocationData = (location) => {
  if (!location) {
    return {
      latitude: '',
      longitude: '',
      altitude_m: '',
      altitude_accuracy_m: '',
      gps_accuracy_m: '',
      gps_reading_count: '',
    };
  }

  return {
    latitude: formatCoordinate(location.latitude, 6),
    longitude: formatCoordinate(location.longitude, 6),
    altitude_m: location.altitude != null ? Math.round(location.altitude) : '',
    altitude_accuracy_m: location.altitudeAccuracy != null
      ? Math.round(location.altitudeAccuracy) : '',
    gps_accuracy_m: location.accuracy != null ? location.accuracy.toFixed(1) : '',
    gps_reading_count: location.readingCount || 1,
  };
};

/**
 * Clear the location cache (useful for testing or forcing fresh location)
 */
export const clearLocationCache = () => {
  locationCache = {
    location: null,
    timestamp: null,
    source: null,
  };
};

/**
 * Get cache status for debugging
 */
export const getCacheStatus = () => {
  return {
    hasCache: locationCache.location !== null,
    timestamp: locationCache.timestamp,
    age: locationCache.timestamp ? Date.now() - locationCache.timestamp : null,
    source: locationCache.source,
    isExpired: locationCache.timestamp
      ? (Date.now() - locationCache.timestamp) > CONFIG.cacheExpiryMs
      : true,
  };
};
