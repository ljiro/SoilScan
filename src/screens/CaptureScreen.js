import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  Animated,
  Easing,
  Dimensions,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { generateUUID } from '../utils/uuid';
import { generateImageFilename } from '../utils/fileNaming';
import {
  watchLocation,
  getAccuracyQuality,
  isLocationSuitable,
  createLocationData,
  checkPermissions,
} from '../services/gpsService';
import { saveImage, loadConfig } from '../services/storageService';
import { saveImageToPublicStorage, isSAFInitialized } from '../services/publicStorageService';
// Note: isSAFInitialized is used in performSave to check if we should save to public storage
import { initCSV, getLastSpotNumber, getNextAvailableShot, updateCSVRow, appendToMunicipalityCSV } from '../services/csvService';
// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import { getWeatherData } from '../services/weatherService';
import {
  startOrientationTracking,
  stopOrientationTracking,
  addOrientationListener,
  getCurrentOrientation,
  getHeadingDirection,
} from '../services/orientationService';
import { fonts, fontSizes, colors, radius, spacing } from '../constants/theme';
import { glow } from '../utils/animations';
import { useNetwork } from '../contexts/NetworkContext';
import * as ImageManipulator from 'expo-image-manipulator';

export default function CaptureScreen({ navigation, route }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const locationSubscription = useRef(null);

  // Network status
  const { isOnline } = useNetwork();

  // Retake mode state
  const [isRetakeMode, setIsRetakeMode] = useState(false);
  const [retakeRecord, setRetakeRecord] = useState(null);

  // Core states
  const [step, setStep] = useState('camera');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [location, setLocation] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [weather, setWeather] = useState(null);

  // Spot tracking states
  const [currentSpot, setCurrentSpot] = useState(1);
  const [currentShot, setCurrentShot] = useState(1);
  const [shotsPerSpot, setShotsPerSpot] = useState(5);
  const [imageQuality, setImageQuality] = useState('1080p'); // '720p' or '1080p'
  const [captureMode, setCaptureMode] = useState('field'); // 'field' or 'controlled'

  // Spot edit modal state
  const [showSpotEditModal, setShowSpotEditModal] = useState(false);
  const [spotEditValue, setSpotEditValue] = useState('');

  // Camera orientation states
  const [orientation, setOrientation] = useState({ pitch: 0, roll: 0, heading: 0 });

  // Config from Setup
  
  const [config, setConfig] = useState({
    municipality: null,
    barangay: null,
    farmName: '',
    crops: [],
    deviceId: '',
  });

  // Animations
  const shutterFlash = useRef(new Animated.Value(0)).current;
  const captureScale = useRef(new Animated.Value(1)).current;
  const gpsGlow = useRef(new Animated.Value(0.5)).current;
  const previewSlide = useRef(new Animated.Value(300)).current;
  const saveScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initialize();
    return cleanup;
  }, []);

  // Handle retake mode from route params
  useEffect(() => {
    if (route?.params?.retakeMode && route?.params?.retakeRecord) {
      console.log('[CaptureScreen] Retake mode activated for:', route.params.retakeRecord);
      setIsRetakeMode(true);
      setRetakeRecord(route.params.retakeRecord);
      setCurrentSpot(parseInt(route.params.retakeRecord.spot_number, 10) || 1);
      setCurrentShot(parseInt(route.params.retakeRecord.shot_number, 10) || 1);
    }
  }, [route?.params?.retakeMode, route?.params?.retakeRecord]);

  // Reload config and shot state when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // reloadConfig now handles both config AND shot state refresh
      reloadConfig();
    });
    return unsubscribe;
  }, [navigation]);

  // Refresh shot state from CSV (handles deletions)
  // Can optionally pass municipality/barangay labels directly to avoid stale state
  const refreshShotState = async (municipalityLabel = null, barangayLabel = null, configShotsPerSpot = null) => {
    if (isRetakeMode) return; // Don't refresh in retake mode

    try {
      // Use passed values or fall back to config state
      const muniLabel = municipalityLabel ?? config.municipality?.label ?? config.municipality ?? null;
      const bgyLabel = barangayLabel ?? config.barangay?.label ?? config.barangay ?? null;
      const shotsCount = configShotsPerSpot ?? shotsPerSpot;

      console.log('[CaptureScreen] Refreshing shot state at', muniLabel, '/', bgyLabel);

      // Get the last spot number for this location
      const lastSpot = await getLastSpotNumber(muniLabel, bgyLabel);
      const spotToCheck = lastSpot > 0 ? lastSpot : 1;

      console.log('[CaptureScreen] Last spot for location:', lastSpot, '-> checking spot:', spotToCheck);

      const shotInfo = await getNextAvailableShot(spotToCheck, shotsCount, muniLabel, bgyLabel);

      if (!shotInfo) {
        console.warn('[CaptureScreen] getNextAvailableShot returned null/undefined');
        setCurrentSpot(1);
        setCurrentShot(1);
        return;
      }

      if (shotInfo.isComplete) {
        // Spot is complete, move to next spot
        const nextSpot = spotToCheck + 1;
        setCurrentSpot(nextSpot);
        const nextSpotInfo = await getNextAvailableShot(nextSpot, shotsCount, muniLabel, bgyLabel);
        setCurrentShot(nextSpotInfo?.nextShot || 1);
        console.log('[CaptureScreen] Spot complete, moved to spot', nextSpot, 'shot', nextSpotInfo?.nextShot || 1);
      } else {
        setCurrentSpot(spotToCheck);
        setCurrentShot(shotInfo.nextShot || 1);
        console.log('[CaptureScreen] Set spot', spotToCheck, 'shot', shotInfo.nextShot || 1);
      }
    } catch (error) {
      console.error('[CaptureScreen] refreshShotState error:', error.message);
      // Reset to safe defaults on error
      setCurrentSpot(1);
      setCurrentShot(1);
    }
  };

  const reloadConfig = async () => {
    const userConfig = await loadConfig('user_config');
    if (userConfig) {
      // Extract labels BEFORE setting state (to use for shot refresh)
      const municipalityLabel = userConfig.municipalityLabel || null;
      const barangayLabel = userConfig.barangayLabel || null;
      const configShotsPerSpot = userConfig.shotsPerSpot || 5;

      setConfig({
        municipality: userConfig.municipalityId
          ? { id: userConfig.municipalityId, label: userConfig.municipalityLabel }
          : null,
        barangay: userConfig.barangayId
          ? { id: userConfig.barangayId, label: userConfig.barangayLabel }
          : null,
        farmName: userConfig.farmName || '',
        crops: userConfig.selectedCropIds?.map((id, i) => ({
          id,
          label: userConfig.selectedCropLabels[i],
        })) || [],
        deviceId: userConfig.deviceId || '',
      });

      if (userConfig.shotsPerSpot) {
        setShotsPerSpot(userConfig.shotsPerSpot);
      }

      if (userConfig.imageQuality) {
        setImageQuality(userConfig.imageQuality);
      }

      if (userConfig.captureMode) {
        setCaptureMode(userConfig.captureMode);
      }

      // Refresh shot state with the FRESH values (not stale React state)
      // This ensures shot counter updates correctly when changing locations
      if (!isRetakeMode) {
        await refreshShotState(municipalityLabel, barangayLabel, configShotsPerSpot);
      }
    }
  };

  const initialize = async () => {
    console.log('[CaptureScreen] === Initializing Capture Screen ===');

    // Load user config
    console.log('[CaptureScreen] Loading user config...');
    const userConfig = await loadConfig('user_config');
    if (userConfig) {
      console.log('[CaptureScreen] User config loaded:', {
        municipality: userConfig.municipalityLabel,
        barangay: userConfig.barangayLabel,
        cropsCount: userConfig.selectedCropIds?.length || 0,
      });
      setConfig({
        municipality: userConfig.municipalityId
          ? { id: userConfig.municipalityId, label: userConfig.municipalityLabel }
          : null,
        barangay: userConfig.barangayId
          ? { id: userConfig.barangayId, label: userConfig.barangayLabel }
          : null,
        farmName: userConfig.farmName || '',
        crops: userConfig.selectedCropIds?.map((id, i) => ({
          id,
          label: userConfig.selectedCropLabels[i],
        })) || [],
        deviceId: userConfig.deviceId || '',
      });

      // Load shots per spot setting
      if (userConfig.shotsPerSpot) {
        setShotsPerSpot(userConfig.shotsPerSpot);
      }

      // Load image quality setting
      if (userConfig.imageQuality) {
        setImageQuality(userConfig.imageQuality);
        console.log('[CaptureScreen] Image quality:', userConfig.imageQuality);
      }

      // Load capture mode setting
      if (userConfig.captureMode) {
        setCaptureMode(userConfig.captureMode);
        console.log('[CaptureScreen] Capture mode:', userConfig.captureMode);
      }
    } else {
      console.log('[CaptureScreen] No user config found');
    }

    // Start GPS watching (permission already granted during onboarding)
    console.log('[CaptureScreen] Checking GPS permissions...');
    const hasPermission = await checkPermissions();
    console.log('[CaptureScreen] GPS permission granted:', hasPermission);
    if (hasPermission) {
      startLocationWatch();
    }

    // Initialize CSV and load last spot for current location
    console.log('[CaptureScreen] Initializing CSV storage...');
    const csvResult = await initCSV();
    console.log('[CaptureScreen] CSV init result:', csvResult);

    // Get municipality and barangay from config for location-specific spot tracking
    const municipality = userConfig?.municipalityLabel || null;
    const barangay = userConfig?.barangayLabel || null;
    console.log('[CaptureScreen] Current location:', municipality, '/', barangay);

    const lastSpot = await getLastSpotNumber(municipality, barangay);
    console.log('[CaptureScreen] Last spot number for location:', lastSpot);
    if (lastSpot > 0) {
      setCurrentSpot(lastSpot);
      // Get next available shot (fills gaps from deletions)
      const configShotsPerSpot = userConfig?.shotsPerSpot || 5;
      const shotInfo = await getNextAvailableShot(lastSpot, configShotsPerSpot, municipality, barangay);
      if (shotInfo.isComplete) {
        // Last spot is complete, move to next
        setCurrentSpot(lastSpot + 1);
        setCurrentShot(1);
        console.log('[CaptureScreen] Last spot complete, starting spot', lastSpot + 1);
      } else {
        setCurrentShot(shotInfo.nextShot);
        console.log('[CaptureScreen] Resuming at spot', lastSpot, 'shot', shotInfo.nextShot);
      }
    }

    // Start orientation tracking
    console.log('[CaptureScreen] Starting orientation tracking...');
    await startOrientationTracking();
    const unsubscribe = addOrientationListener((newOrientation) => {
      setOrientation(newOrientation);
    });

    // Store unsubscribe for cleanup
    orientationUnsubscribe.current = unsubscribe;

    // Start GPS glow animation
    glow(gpsGlow).start();
    console.log('[CaptureScreen] === Initialization Complete ===');
  };

  const orientationUnsubscribe = useRef(null);

  const cleanup = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    stopOrientationTracking();
    if (orientationUnsubscribe.current) {
      orientationUnsubscribe.current();
    }
  };

  const startLocationWatch = async () => {
    const subscription = await watchLocation((loc) => {
      setLocation(loc);
      setGpsLoading(false);

      // Fetch weather on first location
      if (!weather && loc) {
        getWeatherData(loc.latitude, loc.longitude)
          .then(setWeather)
          .catch((err) => {
            console.warn('[CaptureScreen] Weather fetch failed:', err.message);
            // Weather is optional, so we continue without it
          });
      }
    });
    locationSubscription.current = subscription;
  };

  const haptic = (type) => {
    try {
      if (type === 'heavy') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      else if (type === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      else if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (type === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      else if (type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Haptics may not be available on all devices - safe to ignore
    }
  };

  // Spot control functions
  const goToNextSpot = async () => {
    haptic('medium');
    const nextSpot = currentSpot + 1;
    setCurrentSpot(nextSpot);
    setCurrentShot(1);
  };

  const goToPreviousSpot = async () => {
    if (currentSpot <= 1) return;
    haptic('medium');
    const prevSpot = currentSpot - 1;
    setCurrentSpot(prevSpot);

    try {
      // Get next available shot for previous spot (fills gaps) at current location
      const municipalityLabel = config.municipality?.label ?? config.municipality ?? null;
      const barangayLabel = config.barangay?.label ?? config.barangay ?? null;
      const shotInfo = await getNextAvailableShot(prevSpot, shotsPerSpot, municipalityLabel, barangayLabel);
      setCurrentShot(shotInfo?.nextShot || 1);
      console.log('[CaptureScreen] Moved to spot', prevSpot, 'shot', shotInfo?.nextShot || 1);
    } catch (error) {
      console.error('[CaptureScreen] goToPreviousSpot error:', error.message);
      setCurrentShot(1); // Fallback to shot 1
    }
  };

  // Spot edit modal functions
  const openSpotEditModal = () => {
    haptic('light');
    setSpotEditValue(currentSpot.toString());
    setShowSpotEditModal(true);
  };

  const closeSpotEditModal = () => {
    setShowSpotEditModal(false);
    setSpotEditValue('');
  };

  const saveSpotEdit = async () => {
    const newSpot = parseInt(spotEditValue, 10);
    if (isNaN(newSpot) || newSpot < 1) {
      Alert.alert('Invalid Spot', 'Please enter a valid spot number (1 or greater)');
      return;
    }

    haptic('medium');
    setCurrentSpot(newSpot);

    // Get next available shot for this spot at current location
    try {
      const municipalityLabel = config.municipality?.label ?? config.municipality ?? null;
      const barangayLabel = config.barangay?.label ?? config.barangay ?? null;
      const shotInfo = await getNextAvailableShot(newSpot, shotsPerSpot, municipalityLabel, barangayLabel);
      setCurrentShot(shotInfo?.nextShot || 1);
      console.log('[CaptureScreen] Jumped to spot', newSpot, 'shot', shotInfo?.nextShot || 1);
    } catch (error) {
      console.error('[CaptureScreen] saveSpotEdit error:', error.message);
      setCurrentShot(1);
    }

    closeSpotEditModal();
  };

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) {
      console.log('[CaptureScreen] STEP 1: takePicture called but skipped - cameraRef:', !!cameraRef.current, 'isCapturing:', isCapturing);
      return;
    }

    console.log('[CaptureScreen] ========================================');
    console.log('[CaptureScreen] STEP 1: takePicture started');
    console.log('[CaptureScreen] STEP 1: Current spot:', currentSpot, 'Current shot:', currentShot);
    console.log('[CaptureScreen] STEP 1: Image quality setting:', imageQuality);
    console.log('[CaptureScreen] STEP 1: Camera ref available:', !!cameraRef.current);
    haptic('heavy');
    // Subtle scale animation (no bounce)
    Animated.sequence([
      Animated.timing(captureScale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.timing(captureScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setIsCapturing(true);

    try {
      // Target dimensions based on quality: 720p = 1280×720, 1080p = 1920×1080 (16:9)
      const targetWidth = imageQuality === '720p' ? 1280 : 1920;
      const targetHeight = imageQuality === '720p' ? 720 : 1080;
      const targetAspect = targetWidth / targetHeight; // 16:9
      const compressionQuality = imageQuality === '720p' ? 0.7 : 0.85;

      console.log('[CaptureScreen] STEP 2: Taking picture - target dimensions:', targetWidth, 'x', targetHeight);
      console.log('[CaptureScreen] STEP 2: Compression quality:', compressionQuality);

      // Capture at full resolution first
      const captureStartTime = Date.now();
      const rawPhoto = await cameraRef.current.takePictureAsync({
        quality: 1, // Capture at max quality
        exif: true,
        skipProcessing: false,
      });
      const captureEndTime = Date.now();

      console.log('[CaptureScreen] STEP 2: Image captured successfully');
      console.log('[CaptureScreen] STEP 2: Capture duration:', (captureEndTime - captureStartTime), 'ms');
      console.log('[CaptureScreen] STEP 2: Raw photo dimensions:', rawPhoto.width, 'x', rawPhoto.height);
      console.log('[CaptureScreen] STEP 2: Raw photo URI:', rawPhoto.uri);
      console.log('[CaptureScreen] STEP 2: Raw photo has EXIF:', !!rawPhoto.exif);

      // Calculate center crop to match target aspect ratio without distortion
      // Note: ImageManipulator may interpret dimensions differently due to EXIF orientation
      // If EXIF orientation exists, ImageManipulator might swap width/height internally
      const srcWidth = rawPhoto.width;
      const srcHeight = rawPhoto.height;
      const hasExif = !!rawPhoto.exif;
      const exifOrientation = rawPhoto.exif?.Orientation;
      
      console.log('[CaptureScreen] Source image dimensions from camera:', srcWidth, 'x', srcHeight);
      console.log('[CaptureScreen] EXIF present:', hasExif, 'Orientation:', exifOrientation);
      
      // If EXIF orientation is 90 or 270 degrees, dimensions might be swapped by ImageManipulator
      // Be extra conservative in this case, or skip cropping entirely
      const mightSwapDimensions = exifOrientation === 6 || exifOrientation === 8 || 
                                  exifOrientation === 5 || exifOrientation === 7;
      
      // If EXIF orientation exists and might cause issues, skip cropping to avoid ImageManipulator errors
      // We'll just resize instead, which always works
      // TEMPORARY: Skip cropping entirely if EXIF is present to avoid ImageManipulator crashes
      // ImageManipulator seems to have issues with crop bounds when EXIF orientation is present
      const skipCropDueToExif = hasExif; // Skip crop if ANY EXIF data is present
      
      if (skipCropDueToExif) {
        console.warn('[CaptureScreen] EXIF data present - skipping crop to avoid ImageManipulator errors, will just resize');
        console.warn('[CaptureScreen] This ensures reliable image processing without crashes');
      } else if (mightSwapDimensions) {
        console.warn('[CaptureScreen] EXIF orientation may cause dimension swap, using extra conservative crop');
      }
      
      const srcAspect = srcWidth / srcHeight;

      let cropOriginX = 0;
      let cropOriginY = 0;
      let cropWidth = srcWidth;
      let cropHeight = srcHeight;

      if (srcAspect > targetAspect) {
        // Source is wider - crop sides to make it square
        cropWidth = Math.floor(srcHeight * targetAspect);
        cropOriginX = Math.floor((srcWidth - cropWidth) / 2);
      } else if (srcAspect < targetAspect) {
        // Source is taller - crop top/bottom to make it square
        cropHeight = Math.floor(srcWidth / targetAspect);
        cropOriginY = Math.floor((srcHeight - cropHeight) / 2);
      }

      // CRITICAL: Validate and clamp crop bounds to ensure they never exceed image dimensions
      // ImageManipulator can be very strict, so we use a large safety margin
      // Some devices/Android versions may report different bitmap dimensions than expected
      const SAFETY_MARGIN = 10; // Use 10px margin to avoid boundary issues
      
      // Convert to integers immediately
      cropOriginX = Math.floor(cropOriginX);
      cropOriginY = Math.floor(cropOriginY);
      cropWidth = Math.floor(cropWidth);
      cropHeight = Math.floor(cropHeight);

      // Clamp origin to valid range with safety margin
      cropOriginX = Math.max(0, Math.min(cropOriginX, srcWidth - SAFETY_MARGIN - 1));
      cropOriginY = Math.max(0, Math.min(cropOriginY, srcHeight - SAFETY_MARGIN - 1));
      
      // Calculate maximum allowed dimensions from current origin (with safety margin)
      const maxAllowedWidth = Math.max(1, srcWidth - cropOriginX - SAFETY_MARGIN);
      const maxAllowedHeight = Math.max(1, srcHeight - cropOriginY - SAFETY_MARGIN);
      
      // Clamp dimensions to fit within available space
      cropWidth = Math.max(1, Math.min(cropWidth, maxAllowedWidth));
      cropHeight = Math.max(1, Math.min(cropHeight, maxAllowedHeight));

      // Final validation - ensure we never exceed bounds (with safety margin)
      if (cropOriginX + cropWidth > srcWidth - SAFETY_MARGIN) {
        cropWidth = Math.max(1, srcWidth - cropOriginX - SAFETY_MARGIN);
      }
      if (cropOriginY + cropHeight > srcHeight - SAFETY_MARGIN) {
        cropHeight = Math.max(1, srcHeight - cropOriginY - SAFETY_MARGIN);
      }

      // Ensure all values are valid integers
      cropOriginX = Math.floor(Math.max(0, cropOriginX));
      cropOriginY = Math.floor(Math.max(0, cropOriginY));
      cropWidth = Math.floor(Math.max(1, cropWidth));
      cropHeight = Math.floor(Math.max(1, cropHeight));

      // Final bounds check - if still invalid, use full image
      if (cropOriginX + cropWidth > srcWidth - SAFETY_MARGIN || 
          cropOriginY + cropHeight > srcHeight - SAFETY_MARGIN || 
          cropOriginX < 0 || cropOriginY < 0 || cropWidth < 1 || cropHeight < 1) {
        console.warn('[CaptureScreen] Crop validation failed after all checks, using full image');
        cropOriginX = 0;
        cropOriginY = 0;
        cropWidth = srcWidth;
        cropHeight = srcHeight;
      }

      // Final validation before passing to ImageManipulator
      const finalX = cropOriginX;
      const finalY = cropOriginY;
      const finalW = cropWidth;
      const finalH = cropHeight;
      const xPlusWidth = finalX + finalW;
      const yPlusHeight = finalY + finalH;

      console.log('[CaptureScreen] Crop: origin=', finalX, finalY, 'size=', finalW, 'x', finalH);
      console.log('[CaptureScreen] Source dimensions:', srcWidth, 'x', srcHeight);
      console.log('[CaptureScreen] Final validation: x+width=', xPlusWidth, '<=', srcWidth, xPlusWidth <= srcWidth ? '✓' : '✗', 'y+height=', yPlusHeight, '<=', srcHeight, yPlusHeight <= srcHeight ? '✓' : '✗');

      // If validation fails, skip cropping entirely
      if (xPlusWidth > srcWidth || yPlusHeight > srcHeight || finalX < 0 || finalY < 0 || finalW < 1 || finalH < 1) {
        console.error('[CaptureScreen] Crop validation failed - skipping crop, will just resize');
        cropOriginX = 0;
        cropOriginY = 0;
        cropWidth = srcWidth;
        cropHeight = srcHeight;
      }

      // Apply center crop then resize to exact target dimensions
      let processedPhoto;
      try {
        const manipulations = [];
        
        // Only add crop if we have valid bounds and the image needs cropping
        // Skip crop entirely if EXIF orientation might cause issues
        const needsCrop = !skipCropDueToExif && (cropOriginX > 0 || cropOriginY > 0 || cropWidth < srcWidth || cropHeight < srcHeight);
        
        // Very strict validation with additional safety margin for ImageManipulator
        // Use larger safety margin if EXIF might cause dimension issues
        const CROP_SAFETY = mightSwapDimensions ? 20 : 10; // Larger margin if EXIF orientation present
        const cropIsValid = cropOriginX >= 0 && cropOriginY >= 0 && 
                           cropOriginX + cropWidth <= srcWidth - CROP_SAFETY && 
                           cropOriginY + cropHeight <= srcHeight - CROP_SAFETY &&
                           cropWidth > CROP_SAFETY && cropHeight > CROP_SAFETY;

        if (needsCrop && cropIsValid) {
          // Final integer values with additional safety margin
          const safeX = Math.floor(cropOriginX);
          const safeY = Math.floor(cropOriginY);
          // Reduce dimensions by safety margin to ensure we never hit boundaries
          const safeW = Math.floor(Math.max(1, cropWidth - CROP_SAFETY));
          const safeH = Math.floor(Math.max(1, cropHeight - CROP_SAFETY));
          
          // ABSOLUTE FINAL VALIDATION - ensure values are definitely within bounds
          // Use even more conservative bounds if EXIF orientation might cause issues
          const extraMargin = mightSwapDimensions ? 15 : 5;
          const finalX = Math.max(0, Math.min(safeX, srcWidth - extraMargin - 1));
          const finalY = Math.max(0, Math.min(safeY, srcHeight - extraMargin - 1));
          const finalW = Math.max(1, Math.min(safeW, srcWidth - finalX - extraMargin));
          const finalH = Math.max(1, Math.min(safeH, srcHeight - finalY - extraMargin));
          
          // One more absolute check before passing to ImageManipulator
          const xPlusW = finalX + finalW;
          const yPlusH = finalY + finalH;
          
          console.log('[CaptureScreen] Pre-ImageManipulator validation:');
          console.log('[CaptureScreen]   finalX:', finalX, 'finalW:', finalW, 'x+w:', xPlusW, 'srcWidth:', srcWidth, 'margin:', extraMargin);
          console.log('[CaptureScreen]   finalY:', finalY, 'finalH:', finalH, 'y+h:', yPlusH, 'srcHeight:', srcHeight);
          console.log('[CaptureScreen]   Valid:', xPlusW <= srcWidth - extraMargin, yPlusH <= srcHeight - extraMargin);
          
          // Use strict less-than with margin to account for ImageManipulator's internal handling
          if (xPlusW < srcWidth - extraMargin && yPlusH < srcHeight - extraMargin && finalX >= 0 && finalY >= 0 && finalW > 0 && finalH > 0) {
            manipulations.push({
              crop: {
                originX: finalX,
                originY: finalY,
                width: finalW,
                height: finalH,
              },
            });
            console.log('[CaptureScreen] ✓ Crop manipulation added:', { x: finalX, y: finalY, w: finalW, h: finalH });
            console.log('[CaptureScreen] ✓ Final check: x+w=', xPlusW, '<', srcWidth - extraMargin, '✓', 'y+h=', yPlusH, '<', srcHeight - extraMargin, '✓');
          } else {
            console.error('[CaptureScreen] ✗ Crop bounds FAILED final validation, skipping crop');
            console.error('[CaptureScreen]   x+w:', xPlusW, '>=', srcWidth - extraMargin, '?', xPlusW >= srcWidth - extraMargin);
            console.error('[CaptureScreen]   y+h:', yPlusH, '>=', srcHeight - extraMargin, '?', yPlusH >= srcHeight - extraMargin);
          }
        } else {
          console.log('[CaptureScreen] No crop needed or crop invalid, will just resize');
          if (!needsCrop) console.log('[CaptureScreen]   Reason: No crop needed');
          if (!cropIsValid) console.log('[CaptureScreen]   Reason: Crop validation failed');
        }
        
        // Always resize to target dimensions
        manipulations.push({ resize: { width: targetWidth, height: targetHeight } });
        
        processedPhoto = await ImageManipulator.manipulateAsync(
          rawPhoto.uri,
          manipulations,
          { compress: compressionQuality, format: ImageManipulator.SaveFormat.JPEG }
        );
        console.log('[CaptureScreen] Processed photo URI:', processedPhoto.uri);
        console.log('[CaptureScreen] Processed dimensions:', processedPhoto.width, 'x', processedPhoto.height);
      } catch (processError) {
        console.error('[CaptureScreen] Processing failed, using raw photo:', processError.message);
        // Fall back to raw photo if processing fails
        processedPhoto = {
          uri: rawPhoto.uri,
          width: rawPhoto.width,
          height: rawPhoto.height,
        };
      }

      // Create photo object
      const photo = {
        uri: processedPhoto.uri,
        width: processedPhoto.width || targetWidth,
        height: processedPhoto.height || targetHeight,
        exif: rawPhoto.exif, // Preserve EXIF from original
      };

      console.log('[CaptureScreen] Photo ready for preview');
      console.log('[CaptureScreen] Final dimensions:', photo.width, 'x', photo.height);
      console.log('[CaptureScreen] Photo URI:', photo.uri);
      console.log('[CaptureScreen] Photo has EXIF:', !!photo.exif);

      // Shutter flash
      Animated.sequence([
        Animated.timing(shutterFlash, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(shutterFlash, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();

      haptic('success');
      setCapturedImage(photo);
      setStep('preview');

      // Smooth slide in (no bounce)
      previewSlide.setValue(300);
      Animated.timing(previewSlide, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } catch (error) {
      haptic('error');
      console.error('[CaptureScreen] Capture error:', error.message);
      console.error('[CaptureScreen] Full error:', error);
      Alert.alert(
        'Capture Failed',
        `Could not capture image.\n\nError: ${error.message}\n\nPlease check camera permissions.`,
        [{ text: 'OK' }]
      );
    }

    setIsCapturing(false);
  };

  const retryCapture = () => {
    haptic('medium');
    setCapturedImage(null);
    setNotes('');
    setShowNotes(false);
    setStep('camera');
  };

  // Helper: Safely extract label from config object
  const getLabel = (obj) => {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    return obj.label || null;
  };

  // Helper: Validate config has required fields
  const validateConfig = () => {
    const { municipality, barangay, crops } = config;
    const municipalityLabel = getLabel(municipality);
    const barangayLabel = getLabel(barangay);

    if (!municipalityLabel || !barangayLabel) {
      return { valid: false, error: 'Municipality and barangay are required' };
    }
    if (!crops || crops.length === 0) {
      return { valid: false, error: 'At least one crop must be selected' };
    }
    return { valid: true, municipalityLabel, barangayLabel };
  };

  const saveAndContinue = async () => {
    // Validate config first
    const validation = validateConfig();
    if (!validation.valid) {
      haptic('warning');
      Alert.alert('Setup Required', `${validation.error}. Please complete setup first.`, [
        { text: 'Go to Setup', onPress: () => navigation.navigate('Setup') },
      ]);
      return;
    }

    // Validate captured image exists
    if (!capturedImage?.uri) {
      haptic('error');
      Alert.alert('Error', 'No image to save. Please capture an image first.');
      return;
    }

    // Check location suitability (only in field mode)
    if (captureMode === 'field') {
      const locCheck = isLocationSuitable(location);
      if (!locCheck.suitable) {
        haptic('warning');
        Alert.alert('GPS Issue', locCheck.reason, [
          { text: 'Save Anyway', onPress: () => performSave() },
          { text: 'Wait', style: 'cancel' },
        ]);
        return;
      }
    }

    await performSave();
  };

  const performSave = async () => {
    // Prevent double-save
    if (isSaving) {
      console.log('[CaptureScreen] Save already in progress, ignoring');
      return;
    }

    // Extract and validate all required data upfront
    const { municipality, barangay, farmName, crops, deviceId } = config;
    const municipalityLabel = getLabel(municipality);
    const barangayLabel = getLabel(barangay);

    // Final validation - failsafe in case called directly
    if (!municipalityLabel || !barangayLabel) {
      haptic('error');
      Alert.alert('Error', 'Configuration is incomplete. Please complete setup.');
      return;
    }

    if (!capturedImage?.uri) {
      haptic('error');
      Alert.alert('Error', 'No image to save.');
      return;
    }

    haptic('heavy');
    Animated.sequence([
      Animated.timing(saveScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(saveScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setIsSaving(true);

    try {
      console.log('[CaptureScreen] Starting save process...');
      console.log('[CaptureScreen] Retake mode:', isRetakeMode);
      console.log('[CaptureScreen] Location:', municipalityLabel, '/', barangayLabel);

      // Step 1: Generate UUID and filename (use existing UUID if retaking)
      const uuid = isRetakeMode && retakeRecord?.uuid ? retakeRecord.uuid : generateUUID();
      const filename = generateImageFilename(municipalityLabel, barangayLabel, uuid, farmName || '');
      console.log('[CaptureScreen] UUID:', uuid, 'Filename:', filename);

      // Step 2: If retaking, delete the old image first (non-blocking)
      if (isRetakeMode && retakeRecord) {
        const oldImagePath = retakeRecord._resolvedImagePath || retakeRecord.image_filename;
        if (oldImagePath) {
          FileSystem.getInfoAsync(oldImagePath)
            .then(fileInfo => {
              if (fileInfo.exists) {
                return FileSystem.deleteAsync(oldImagePath, { idempotent: true });
              }
            })
            .catch(err => console.warn('[CaptureScreen] Old image cleanup failed:', err.message));
        }
      }

      // Step 3: Save image to app storage
      // Use first crop label for directory organization (or 'mixed_crops' if multiple)
      const cropLabel = crops.length === 1 ? crops[0].label : null;
      console.log('[CaptureScreen] Saving image to storage...');
      console.log('[CaptureScreen] Using crop label for directory:', cropLabel || 'mixed_crops');

      // Validate capturedImage exists before proceeding
      if (!capturedImage || !capturedImage.uri) {
        console.error('[CaptureScreen] No captured image available');
        throw new Error('No captured image available to save');
      }

      // Store image dimensions and URI before any operations
      const imageWidth = capturedImage.width || '';
      const imageHeight = capturedImage.height || '';
      const sourceUri = capturedImage.uri;

      let imagePath;
      try {
        imagePath = await saveImage(sourceUri, filename, cropLabel);
        console.log('[CaptureScreen] Image saved successfully, path:', imagePath);

        // Clean up temporary camera cache file to free disk cache
        // Do this AFTER saving but BEFORE clearing state
        try {
          if (sourceUri && sourceUri.includes('/cache/Camera/')) {
            await FileSystem.deleteAsync(sourceUri, { idempotent: true });
            console.log('[CaptureScreen] Deleted temporary camera cache file');
          }
        } catch (cleanupError) {
          // Non-critical - cache cleanup failure is okay
          console.log('[CaptureScreen] Cache cleanup note:', cleanupError.message);
        }
      } catch (imageError) {
        console.error('[CaptureScreen] Image save failed:', imageError.message);
        throw new Error(`Image save failed: ${imageError.message}`);
      }

      // Step 3b: Also save to public SAF storage (if enabled)
      // This makes files visible in file manager and accessible via USB
      try {
        const safEnabled = await isSAFInitialized();
        if (safEnabled) {
          // Get full path for the saved image
          const fullImagePath = `${FileSystem.documentDirectory}AgriCapture/${imagePath}`;
          const publicResult = await saveImageToPublicStorage(
            fullImagePath,
            filename,
            municipalityLabel
          );
          console.log('[CaptureScreen] Public SAF save:', publicResult.success ? 'OK' : publicResult.error);
        }
      } catch (publicError) {
        console.log('[CaptureScreen] Public storage error:', publicError.message);
        // Don't throw - internal save succeeded, public is optional
      }

      // Step 4: Prepare location data (only for field mode)
      const isFieldMode = captureMode === 'field';
      const locationData = isFieldMode ? createLocationData(location) : {
        latitude: '',
        longitude: '',
        altitude_m: '',
        altitude_accuracy_m: '',
        gps_accuracy_m: '',
        gps_reading_count: '',
      };

      // Step 5: Get current orientation
      const currentOrient = getCurrentOrientation() || { pitch: 0, roll: 0, heading: 0 };

      // Step 6: Prepare CSV data with all values safely extracted
      const cropsString = Array.isArray(crops)
        ? crops.map(c => (c?.id || c || '').toString().toLowerCase()).filter(Boolean).join(',')
        : '';

      const data = {
        uuid,
        spot_number: currentSpot,
        shot_number: currentShot,
        shots_in_spot: shotsPerSpot,
        image_filename: imagePath,
        image_width: imageWidth,
        image_height: imageHeight,
        image_quality: imageQuality || '1080p',
        capture_datetime: new Date().toISOString(),
        ...locationData,
        camera_pitch: currentOrient.pitch ?? 0,
        camera_roll: currentOrient.roll ?? 0,
        camera_heading: currentOrient.heading ?? 0,
        municipality: municipalityLabel,
        barangay: barangayLabel,
        farm_name: farmName || '',
        crops: cropsString,
        temperature_c: isFieldMode ? (weather?.temperature?.toFixed(1) || '') : '',
        humidity_percent: isFieldMode ? (weather?.humidity ?? '') : '',
        notes: (notes || '').replace(/[\r\n]+/g, ' ').trim(),
        device_id: deviceId || '',
        capture_mode: captureMode || 'field',
      };

      // Step 7: Save to CSV (update or append)
      // Uses appendToMunicipalityCSV which saves to both internal and SAF storage
      if (isRetakeMode && retakeRecord?.uuid) {
        const updateResult = await updateCSVRow(retakeRecord.uuid, data);
        if (!updateResult.success) {
          throw new Error(updateResult.error || 'CSV update failed');
        }
      } else {
        // Append to both main CSV and municipality-specific CSV (including SAF if enabled)
        const csvResult = await appendToMunicipalityCSV(data, municipalityLabel);
        if (!csvResult.success) {
          throw new Error('CSV append failed');
        }
        if (csvResult.safSuccess) {
          console.log('[CaptureScreen] SAF CSV append successful');
        }
      }

      console.log('[CaptureScreen] Save completed successfully!');
      haptic('success');

      // Handle retake mode - return to Review screen
      if (isRetakeMode) {
        setIsRetakeMode(false);
        setRetakeRecord(null);
        navigation.goBack();
        return;
      }

      // Update shot counter for next capture
      const shotInfo = await getNextAvailableShot(currentSpot, shotsPerSpot, municipalityLabel, barangayLabel);
      if (shotInfo.isComplete) {
        const nextSpot = currentSpot + 1;
        setCurrentSpot(nextSpot);
        const nextSpotInfo = await getNextAvailableShot(nextSpot, shotsPerSpot, municipalityLabel, barangayLabel);
        setCurrentShot(nextSpotInfo.nextShot || 1);
      } else {
        setCurrentShot(shotInfo.nextShot || 1);
      }

      // Reset for next capture - clear image from memory AFTER everything is done
      // This ensures the preview doesn't crash while saving
      setCapturedImage(null);
      setNotes('');
      setShowNotes(false);
      setStep('camera');
      console.log('[CaptureScreen] Cleared image from memory to free RAM');
    } catch (error) {
      haptic('error');
      console.error('[CaptureScreen] Save error:', error);
      Alert.alert(
        'Save Failed',
        `Could not save the capture.\n\nError: ${error.message || 'Unknown error'}\n\nPlease try again.`,
        [{ text: 'OK' }]
      );
    } finally {
      // Always reset saving state
      setIsSaving(false);
    }
  };

  // Permission states
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>Camera permission required</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { municipality, barangay, crops } = config;
  const accuracy = getAccuracyQuality(location?.accuracy);

  // Camera view
  if (step === 'camera') {
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          {/* Capture box overlay - rendered first so it's behind UI components */}
          <View style={styles.captureBoxOverlay} pointerEvents="none">
            <View style={styles.captureBoxDarkTop} />
            <View style={styles.captureBoxMiddle}>
              <View style={styles.captureBoxDarkSide} />
              <View style={styles.captureBox}>
                {/* Corner markers */}
                <View style={[styles.cornerMarker, styles.cornerTopLeft]} />
                <View style={[styles.cornerMarker, styles.cornerTopRight]} />
                <View style={[styles.cornerMarker, styles.cornerBottomLeft]} />
                <View style={[styles.cornerMarker, styles.cornerBottomRight]} />
                {/* Label */}
                <View style={styles.captureBoxLabel}>
                  <Text style={styles.captureBoxLabelText}>SOIL CAPTURE AREA</Text>
                </View>
              </View>
              <View style={styles.captureBoxDarkSide} />
            </View>
            <View style={styles.captureBoxDarkBottom} />
          </View>

          {/* Setup info */}
          <View style={styles.topBar}>
            {/* Retake mode indicator */}
            {isRetakeMode && (
              <View style={styles.retakeBanner}>
                <Ionicons name="camera" size={14} color={colors.warning} />
                <Text style={styles.retakeBannerText}>
                  RETAKING Spot {currentSpot}, Shot {currentShot}
                </Text>
              </View>
            )}
            {municipality && barangay ? (
              <View style={styles.infoRow}>
                <Ionicons name="location" size={14} color={colors.primary} />
                <Text style={styles.infoText}>
                  {municipality.label} - {barangay.label}
                </Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.infoRow} onPress={() => navigation.navigate('Setup')}>
                <Ionicons name="warning" size={14} color={colors.error} />
                <Text style={[styles.infoText, { color: colors.error }]}>Tap to complete setup</Text>
              </TouchableOpacity>
            )}
            {crops.length > 0 && (
              <View style={styles.infoRow}>
                <Ionicons name="leaf" size={14} color={colors.primary} />
                <Text style={styles.infoText}>{crops.map((c) => c.label).join(', ')}</Text>
              </View>
            )}
          </View>

          {/* Spot control bar */}
          <View style={styles.spotBar}>
            <TouchableOpacity
              style={[styles.spotBtn, currentSpot <= 1 && styles.spotBtnDisabled]}
              onPress={goToPreviousSpot}
              disabled={currentSpot <= 1}
            >
              <Ionicons name="chevron-back" size={20} color={currentSpot > 1 ? '#fff' : 'rgba(255,255,255,0.3)'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.spotInfoTouchable}
              onPress={openSpotEditModal}
              activeOpacity={0.7}
            >
              <View style={styles.spotInfo}>
                <Text style={styles.spotLabel}>SPOT</Text>
                <View style={styles.spotNumberRow}>
                  <Text style={styles.spotNumber}>{currentSpot}</Text>
                  <Ionicons name="pencil" size={12} color="rgba(255,255,255,0.5)" style={styles.spotEditIcon} />
                </View>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.spotBtn} onPress={goToNextSpot}>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
            <View style={styles.shotInfo}>
              <Text style={styles.shotLabel}>SHOT</Text>
              <Text style={styles.shotNumber}>{currentShot}/{shotsPerSpot}</Text>
            </View>
          </View>

          {/* Camera angles display */}
          <View style={styles.angleBar}>
            <View style={styles.angleItem}>
              <Text style={styles.angleLabel}>PITCH</Text>
              <Text style={styles.angleValue}>{orientation.pitch}°</Text>
            </View>
            <View style={styles.angleItem}>
              <Text style={styles.angleLabel}>ROLL</Text>
              <Text style={styles.angleValue}>{orientation.roll}°</Text>
            </View>
            <View style={styles.angleItem}>
              <Text style={styles.angleLabel}>HEAD</Text>
              <Text style={styles.angleValue}>{orientation.heading}° {getHeadingDirection(orientation.heading)}</Text>
            </View>
            <View style={styles.angleItem}>
              <Text style={styles.angleLabel}>QUALITY</Text>
              <Text style={styles.angleValue}>{imageQuality}</Text>
            </View>
          </View>

          
          {/* Offline warning banner - only show in Field mode */}
          {captureMode === 'field' && !isOnline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline" size={14} color={colors.warning} />
              <Text style={styles.offlineText}>
                Offline - GPS may be less accurate
              </Text>
            </View>
          )}

          {/* GPS status - only show in Field mode */}
          {captureMode === 'field' ? (
            <View style={[styles.gpsBar, !isOnline && styles.gpsBarOffline]}>
              {gpsLoading ? (
                <View style={styles.infoRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.gpsText}>Acquiring GPS...</Text>
                </View>
              ) : location ? (
                <>
                  <View style={styles.infoRow}>
                    <Animated.View style={{ opacity: gpsGlow }}>
                      <Ionicons name="location" size={14} color={accuracy.color} />
                    </Animated.View>
                    <Text style={styles.gpsText}>
                      {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </Text>
                  </View>
                  <Text style={[styles.gpsDetail, { color: accuracy.color }]}>
                    {accuracy.label} ({location.accuracy?.toFixed(1)}m)
                    {location.altitude != null && ` | Alt: ${Math.round(location.altitude)}m`}
                  </Text>
                  {!isOnline && (
                    <Text style={styles.offlineGpsNote}>
                      A-GPS unavailable offline
                    </Text>
                  )}
                </>
              ) : (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={14} color={colors.error} />
                  <Text style={[styles.gpsText, { color: colors.error }]}>GPS unavailable</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.gpsBar, styles.controlledModeBar]}>
              <View style={styles.infoRow}>
                <Ionicons name="bulb" size={14} color={colors.secondary} />
                <Text style={styles.gpsText}>Controlled Mode</Text>
              </View>
              <Text style={styles.gpsDetail}>GPS and weather data disabled</Text>
            </View>
          )}

          {/* Capture button */}
          <View style={styles.captureArea}>
            <TouchableOpacity onPress={takePicture} disabled={isCapturing} activeOpacity={1}>
              <Animated.View
                style={[styles.captureBtn, { transform: [{ scale: captureScale }] }]}
              >
                {isCapturing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.captureInner} />
                )}
              </Animated.View>
            </TouchableOpacity>
          </View>

          {/* Shutter flash */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.flash, { opacity: shutterFlash }]}
          />
        </CameraView>

        {/* Spot Edit Modal - also available in camera view */}
        <Modal
          visible={showSpotEditModal}
          transparent
          animationType="fade"
          onRequestClose={closeSpotEditModal}
        >
          <Pressable
            style={styles.spotEditModalOverlay}
            onPress={closeSpotEditModal}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.spotEditModalKeyboard}
            >
              <Pressable
                style={styles.spotEditModalContent}
                onPress={(e) => e.stopPropagation()}
              >
                <Text style={styles.spotEditModalTitle}>Go to Spot</Text>
                <Text style={styles.spotEditModalSubtitle}>
                  Enter spot number (1-999)
                </Text>
                <TextInput
                  style={styles.spotEditModalInput}
                  value={spotEditValue}
                  onChangeText={setSpotEditValue}
                  keyboardType="number-pad"
                  maxLength={3}
                  autoFocus
                  selectTextOnFocus
                />
                <View style={styles.spotEditModalActions}>
                  <TouchableOpacity
                    style={styles.spotEditModalCancelBtn}
                    onPress={closeSpotEditModal}
                  >
                    <Text style={styles.spotEditModalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.spotEditModalSaveBtn}
                    onPress={saveSpotEdit}
                  >
                    <Text style={styles.spotEditModalSaveText}>Go</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // Preview view
  // Safety check - if capturedImage is null, go back to camera
  if (!capturedImage || !capturedImage.uri) {
    console.warn('[CaptureScreen] Preview: capturedImage is null, returning to camera');
    setStep('camera');
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.Image
        source={{ uri: capturedImage.uri }}
        style={[styles.preview, { transform: [{ translateY: previewSlide }] }]}
      />

      {/* Info bar */}
      <View style={styles.topBar}>
        {isRetakeMode && (
          <View style={styles.retakeBanner}>
            <Ionicons name="camera" size={14} color={colors.warning} />
            <Text style={styles.retakeBannerText}>RETAKING</Text>
          </View>
        )}
        <Text style={styles.infoText}>
          {municipality?.label} - {barangay?.label} | {crops.map((c) => c.label).join(', ')}
        </Text>
        <Text style={styles.infoTextSmall}>
          Spot {currentSpot} | Shot {currentShot}/{shotsPerSpot}
        </Text>
      </View>

      {/* Notes */}
      {showNotes ? (
        <View style={styles.notesBox}>
          <TextInput
            style={styles.notesInput}
            placeholder="Add notes..."
            placeholderTextColor={colors.text.tertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <TouchableOpacity onPress={() => setShowNotes(false)}>
            <Ionicons name="close-circle" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.addNotesBtn} onPress={() => setShowNotes(true)}>
          <Ionicons name="document-text-outline" size={16} color="#fff" />
          <Text style={styles.addNotesText}>Add notes</Text>
        </TouchableOpacity>
      )}

      {/* Action buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.retryBtn} onPress={retryCapture}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={saveAndContinue} disabled={isSaving}>
          <Animated.View
            style={[styles.saveBtn, isSaving && styles.disabled, { transform: [{ scale: saveScale }] }]}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.btnText}>Save</Text>
              </>
            )}
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Spot Edit Modal */}
      <Modal
        visible={showSpotEditModal}
        transparent
        animationType="fade"
        onRequestClose={closeSpotEditModal}
      >
        <Pressable
          style={styles.spotEditModalOverlay}
          onPress={closeSpotEditModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.spotEditModalKeyboard}
          >
            <Pressable
              style={styles.spotEditModalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.spotEditModalTitle}>Go to Spot</Text>
              <Text style={styles.spotEditModalSubtitle}>
                Enter the spot number you want to capture
              </Text>
              <TextInput
                style={styles.spotEditModalInput}
                value={spotEditValue}
                onChangeText={setSpotEditValue}
                keyboardType="number-pad"
                placeholder="Enter spot number"
                placeholderTextColor="rgba(255,255,255,0.4)"
                autoFocus
                selectTextOnFocus
              />
              <View style={styles.spotEditModalActions}>
                <TouchableOpacity
                  style={styles.spotEditModalCancelBtn}
                  onPress={closeSpotEditModal}
                >
                  <Text style={styles.spotEditModalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.spotEditModalSaveBtn}
                  onPress={saveSpotEdit}
                >
                  <Text style={styles.spotEditModalSaveText}>Go</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  camera: { flex: 1 },
  preview: { flex: 1, resizeMode: 'contain' },

  // Top info bar - glassmorphism style
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingTop: 50,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    zIndex: 10, // Above overlay
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginVertical: 2,
  },
  infoText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.primary,
    textAlign: 'center',
  },
  infoTextSmall: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs - 1,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 4,
  },

  // Spot control bar
  spotBar: {
    position: 'absolute',
    top: 110,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 10, // Above overlay
  },
  spotBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  spotInfo: {
    alignItems: 'center',
    marginHorizontal: spacing.md,
  },
  spotLabel: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  spotNumber: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.primary,
  },
  shotInfo: {
    alignItems: 'center',
    marginLeft: spacing.lg,
    paddingLeft: spacing.lg,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.2)',
  },
  shotLabel: {
    fontFamily: fonts.regular,
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  shotNumber: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: '#fff',
  },

  // Camera angle display
  angleBar: {
    position: 'absolute',
    top: 170,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 10, // Above overlay
  },
  angleItem: {
    alignItems: 'center',
  },
  angleLabel: {
    fontFamily: fonts.regular,
    fontSize: 8,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
  },
  angleValue: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.secondary,
  },

  // Storage indicator
  storageIndicatorBar: {
    position: 'absolute',
    top: 210,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    zIndex: 10,
  },
  storageIndicatorEnabled: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.4)',
  },
  storageIndicatorDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  storageIndicatorText: {
    fontFamily: fonts.regular,
    fontSize: 10,
  },
  storageTextEnabled: {
    color: colors.primary,
  },
  storageTextDisabled: {
    color: colors.text.muted,
  },
  storageWarningToast: {
    position: 'absolute',
    top: 240,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
    borderRadius: radius.md,
    zIndex: 20,
  },
  storageWarningText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: '#fff',
  },

  // Offline banner
  offlineBanner: {
    position: 'absolute',
    bottom: 290,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    zIndex: 10, // Above overlay
  },
  offlineText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.warning,
  },
  offlineGpsNote: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs - 1,
    color: colors.warning,
    marginTop: 4,
    opacity: 0.9,
  },

  // GPS bar - glassmorphism style
  gpsBar: {
    position: 'absolute',
    bottom: 190,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 10, // Above overlay
  },
  gpsBarOffline: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  controlledModeBar: {
    borderColor: 'rgba(94, 96, 206, 0.3)',
    backgroundColor: 'rgba(94, 96, 206, 0.15)',
  },
  gpsText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.primary,
  },
  gpsDetail: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs - 1,
    marginTop: 2,
  },

  // Capture button
  captureArea: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10, // Above overlay
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  flash: { backgroundColor: '#fff' },

  // Notes - glassmorphism style
  addNotesBtn: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  addNotesText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: '#fff',
  },
  notesBox: {
    position: 'absolute',
    top: 130,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  notesInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: '#fff',
    minHeight: 60,
    textAlignVertical: 'top',
  },

  // Action buttons - modern rounded style
  actionBar: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  retryBtn: {
    flex: 1,
    marginRight: spacing.sm,
    backgroundColor: colors.error,
    padding: spacing.lg,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  saveBtn: {
    flex: 1,
    marginLeft: spacing.sm,
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  btnText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: '#fff',
  },
  disabled: { opacity: 0.6 },

  // Permission
  message: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: '#fff',
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.xl,
  },
  permissionBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: '#fff',
  },

  // Retake mode banner
  retakeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 152, 0, 0.3)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.warning,
    marginBottom: spacing.xs,
  },
  retakeBannerText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Capture box overlay styles
  captureBoxOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1, // Behind UI components
  },
  captureBoxDarkTop: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    minHeight: 220, // Space for top info bars
  },
  captureBoxMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  captureBoxDarkSide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    minWidth: 24,
  },
  captureBoxDarkBottom: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    minHeight: 280, // Space for bottom controls
  },
  captureBox: {
    // Fixed square size - 280px works well on most devices
    width: 280,
    height: 280,
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  cornerMarker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#fff',
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 4,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 4,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 4,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 4,
  },
  captureBoxLabel: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  captureBoxLabelText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.primary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Spot edit touchable and modal styles
  spotInfoTouchable: {
    marginHorizontal: spacing.sm,
  },
  spotNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spotEditIcon: {
    marginTop: 2,
  },
  spotEditModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotEditModalKeyboard: {
    width: '100%',
    alignItems: 'center',
  },
  spotEditModalContent: {
    backgroundColor: 'rgba(30,30,30,0.95)',
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: '80%',
    maxWidth: 300,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  spotEditModalTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: '#fff',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  spotEditModalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  spotEditModalInput: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.primary,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  spotEditModalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  spotEditModalCancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  spotEditModalCancelText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: 'rgba(255,255,255,0.7)',
  },
  spotEditModalSaveBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  spotEditModalSaveText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: '#fff',
  },
});
