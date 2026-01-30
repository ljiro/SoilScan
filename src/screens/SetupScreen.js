import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Animated,
  Easing,
  Alert,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { saveConfig, loadConfig, initStorage, createLabelBasedDirectories } from '../services/storageService';
import { generateUUID } from '../utils/uuid';
import * as Device from 'expo-device';
import { MUNICIPALITIES, BARANGAYS } from '../constants/locations';
import { CROPS, getDefaultCrops } from '../constants/crops';
import { fonts, fontSizes, colors, radius, spacing, shadows, layout } from '../constants/theme';
import LocationSelector from '../components/LocationSelector';
import CropSelector from '../components/CropSelector';

// Save status types
const SAVE_STATUS = {
  IDLE: 'idle',
  SAVING: 'saving',
  SAVED: 'saved',
  ERROR: 'error',
  UNSAVED: 'unsaved',
};

export default function SetupScreen() {
  const [deviceId, setDeviceId] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [farmName, setFarmName] = useState(''); // Optional farm name
  const [selectedCrops, setSelectedCrops] = useState([]);
  const [customCrops, setCustomCrops] = useState([]);
  const [newCropName, setNewCropName] = useState('');
  const [shotsPerSpot, setShotsPerSpot] = useState(5);
  const [imageQuality, setImageQuality] = useState('1080p'); // '720p' or '1080p'
  const [captureMode, setCaptureMode] = useState('field'); // 'field' or 'controlled'

  // Enhanced save state management
  const [saveStatus, setSaveStatus] = useState(SAVE_STATUS.IDLE);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Store initial values for comparison
  const initialConfig = useRef(null);
  const saveTimeoutRef = useRef(null);
  const isMounted = useRef(true);

  // Animation values
  const saveButtonScale = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successRotate = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;
  const statusPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    isMounted.current = true;
    loadExistingConfig();

    // Smooth entrance animation (no bounce)
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(contentSlide, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();

    return () => {
      isMounted.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Detect changes and update save status
  useEffect(() => {
    if (isLoading || !initialConfig.current) return;

    const hasChanges = detectChanges();
    if (hasChanges) {
      setSaveStatus(SAVE_STATUS.UNSAVED);
      // Pulse animation for unsaved indicator
      Animated.loop(
        Animated.sequence([
          Animated.timing(statusPulse, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(statusPulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      statusPulse.stopAnimation();
      statusPulse.setValue(1);
    }
  }, [selectedMunicipality, selectedBarangay, farmName, selectedCrops, customCrops, shotsPerSpot, imageQuality, captureMode, isLoading]);

  const detectChanges = () => {
    if (!initialConfig.current) return false;

    const currentConfig = {
      municipalityId: selectedMunicipality?.id,
      barangayId: selectedBarangay?.id,
      farmName: farmName.trim(),
      cropIds: selectedCrops.map(c => c.id).sort().join(','),
      customCropIds: customCrops.map(c => c.id).sort().join(','),
      shotsPerSpot: shotsPerSpot,
      imageQuality: imageQuality,
      captureMode: captureMode,
    };
    const savedConfig = {
      municipalityId: initialConfig.current.municipalityId,
      barangayId: initialConfig.current.barangayId,
      farmName: (initialConfig.current.farmName || '').trim(),
      cropIds: (initialConfig.current.selectedCropIds || []).sort().join(','),
      customCropIds: (initialConfig.current.customCrops || []).map(c => c.id).sort().join(','),
      shotsPerSpot: initialConfig.current.shotsPerSpot || 5,
      imageQuality: initialConfig.current.imageQuality || '1080p',
      captureMode: initialConfig.current.captureMode || 'field',
    };

    return (
      currentConfig.municipalityId !== savedConfig.municipalityId ||
      currentConfig.barangayId !== savedConfig.barangayId ||
      currentConfig.farmName !== savedConfig.farmName ||
      currentConfig.cropIds !== savedConfig.cropIds ||
      currentConfig.customCropIds !== savedConfig.customCropIds ||
      currentConfig.shotsPerSpot !== savedConfig.shotsPerSpot ||
      currentConfig.imageQuality !== savedConfig.imageQuality ||
      currentConfig.captureMode !== savedConfig.captureMode
    );
  };

  const loadExistingConfig = async () => {
    try {
      // Ensure storage is initialized first
      await initStorage();

      const config = await loadConfig('user_config');

      if (config) {
        setDeviceId(config.deviceId || '');
        initialConfig.current = config;

        if (config.municipalityId) {
          const muni = MUNICIPALITIES.find(m => m.id === config.municipalityId);
          if (muni) setSelectedMunicipality(muni);
        }

        if (config.barangayId && config.municipalityId) {
          const barangayList = BARANGAYS[config.municipalityId] || [];
          const brgy = barangayList.find(b => b.id === config.barangayId);
          if (brgy) setSelectedBarangay(brgy);
        }

        // Load farm name (optional)
        if (config.farmName) {
          setFarmName(config.farmName);
        }

        if (config.selectedCropIds && Array.isArray(config.selectedCropIds)) {
          // Include both predefined crops and custom crops in selection
          const predefinedCrops = CROPS.filter(c => config.selectedCropIds.includes(c.id));
          const selectedCustomCrops = (config.customCrops || []).filter(c => config.selectedCropIds.includes(c.id));
          setSelectedCrops([...predefinedCrops, ...selectedCustomCrops]);
        } else {
          setSelectedCrops(getDefaultCrops());
        }

        // Load custom crops
        if (config.customCrops && Array.isArray(config.customCrops)) {
          setCustomCrops(config.customCrops);
        }

        if (config.shotsPerSpot) {
          setShotsPerSpot(config.shotsPerSpot);
        }

        if (config.imageQuality) {
          setImageQuality(config.imageQuality);
        }

        if (config.captureMode) {
          setCaptureMode(config.captureMode);
        }

        // Mark as saved if complete config exists
        if (config.municipalityId && config.barangayId && config.selectedCropIds?.length > 0) {
          setSaveStatus(SAVE_STATUS.SAVED);
          setLastSavedAt(config.setupDate);
        }
      } else {
        // No config exists, apply defaults
        setSelectedCrops(getDefaultCrops());
        initialConfig.current = {
          municipalityId: null,
          barangayId: null,
          farmName: '',
          selectedCropIds: getDefaultCrops().map(c => c.id),
          customCrops: [],
          shotsPerSpot: 5,
          imageQuality: '1080p',
          captureMode: 'field',
        };
      }

      // Generate device ID if needed
      if (!config?.deviceId) {
        const brand = Device.brand || 'Unknown';
        const model = (Device.modelName || Device.modelId || 'Device').replace(/\s+/g, '_');
        const randomSuffix = generateUUID().substring(0, 6).toUpperCase();
        const newDeviceId = `${brand}_${model}_${randomSuffix}`;
        setDeviceId(newDeviceId);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setSelectedCrops(getDefaultCrops());
      initialConfig.current = {
        municipalityId: null,
        barangayId: null,
        selectedCropIds: [],
        customCrops: [],
      };
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const saveSetup = async () => {
    if (!selectedMunicipality || !selectedBarangay || selectedCrops.length === 0) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {
        // Haptics may not be available on all devices - safe to ignore
      }
      Alert.alert(
        'Incomplete Setup',
        'Please select a municipality, barangay, and at least one crop before saving.'
      );
      return;
    }

    // Button press animation
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Haptics may not be available on all devices - safe to ignore
    }

    // Smooth press animation (no bounce)
    Animated.sequence([
      Animated.timing(saveButtonScale, {
        toValue: 0.96,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(saveButtonScale, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();

    setSaveStatus(SAVE_STATUS.SAVING);

    const config = {
      deviceId,
      municipalityId: selectedMunicipality.id,
      municipalityLabel: selectedMunicipality.label,
      barangayId: selectedBarangay.id,
      barangayLabel: selectedBarangay.label,
      farmName: farmName.trim(), // Optional farm name
      selectedCropIds: selectedCrops.map(c => c.id.toLowerCase()),
      selectedCropLabels: selectedCrops.map(c => c.label),
      customCrops: customCrops,
      shotsPerSpot: shotsPerSpot,
      imageQuality: imageQuality,
      captureMode: captureMode,
      setupDate: new Date().toISOString(),
    };

    // Save with the new robust method
    const result = await saveConfig('user_config', config);

    if (!isMounted.current) return;

    if (result.success) {
      // Create directories based on user labels
      console.log('[SetupScreen] Creating label-based directories...');
      const dirResult = await createLabelBasedDirectories();
      if (dirResult.success) {
        console.log('[SetupScreen] Directories created successfully:', dirResult.directories?.length || 0);
      } else {
        console.warn('[SetupScreen] Directory creation had issues:', dirResult.error);
        // Don't fail the save if directory creation has issues - directories will be created on first image save
      }

      // Update initial config reference
      initialConfig.current = config;
      setLastSavedAt(config.setupDate);

      // Success haptic
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Haptics may not be available on all devices - safe to ignore
      }

      // Smooth success popup animation (no bounce)
      successScale.setValue(0.8);
      successRotate.setValue(0);
      setShowSuccess(true);

      Animated.parallel([
        Animated.timing(successScale, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(successRotate, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();

      setSaveStatus(SAVE_STATUS.SAVED);

      // Stop pulse animation
      statusPulse.stopAnimation();
      statusPulse.setValue(1);

      // Auto-hide success after 1.5 seconds
      setTimeout(() => {
        if (!isMounted.current) return;
        Animated.timing(successScale, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          if (isMounted.current) {
            setShowSuccess(false);
          }
        });
      }, 1500);
    } else {
      // Error haptic
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {
        // Haptics may not be available on all devices - safe to ignore
      }

      setSaveStatus(SAVE_STATUS.ERROR);

      Alert.alert(
        'Save Failed',
        `Could not save your setup. ${result.error || 'Please try again.'}\n\nMake sure the app has storage permissions.`,
        [
          { text: 'Retry', onPress: saveSetup },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const isComplete = selectedMunicipality && selectedBarangay && selectedCrops.length > 0;
  const canSave = isComplete && (saveStatus === SAVE_STATUS.UNSAVED || saveStatus === SAVE_STATUS.ERROR);

  const spinInterpolate = successRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getSaveButtonStyle = () => {
    switch (saveStatus) {
      case SAVE_STATUS.SAVING:
        return styles.saveButtonSaving;
      case SAVE_STATUS.SAVED:
        return styles.saveButtonSaved;
      case SAVE_STATUS.ERROR:
        return styles.saveButtonError;
      case SAVE_STATUS.UNSAVED:
        return styles.saveButtonUnsaved;
      default:
        return null;
    }
  };

  const getSaveButtonText = () => {
    switch (saveStatus) {
      case SAVE_STATUS.SAVING:
        return 'Saving...';
      case SAVE_STATUS.SAVED:
        return 'Saved';
      case SAVE_STATUS.ERROR:
        return 'Retry Save';
      case SAVE_STATUS.UNSAVED:
        return 'Save Changes';
      default:
        return 'Save Setup';
    }
  };

  const getSaveButtonIcon = () => {
    switch (saveStatus) {
      case SAVE_STATUS.SAVING:
        return 'hourglass-outline';
      case SAVE_STATUS.SAVED:
        return 'checkmark-circle';
      case SAVE_STATUS.ERROR:
        return 'alert-circle';
      default:
        return 'checkmark-circle-outline';
    }
  };

  // Add a new custom crop
  const addCustomCrop = () => {
    const trimmedName = newCropName.trim();
    if (!trimmedName) {
      Alert.alert('Invalid', 'Please enter a crop name');
      return;
    }

    // Check for duplicates
    const cropId = `custom_${trimmedName.toLowerCase().replace(/\s+/g, '_')}`;
    const existsInCustom = customCrops.some(c => c.id === cropId);
    const existsInPredefined = CROPS.some(c => c.label.toLowerCase() === trimmedName.toLowerCase());

    if (existsInCustom || existsInPredefined) {
      Alert.alert('Duplicate', 'This crop already exists');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newCrop = {
      id: cropId,
      label: trimmedName,
    };

    setCustomCrops([...customCrops, newCrop]);
    setSelectedCrops([...selectedCrops, newCrop]); // Auto-select new crop
    setNewCropName('');
  };

  // Delete a custom crop
  const deleteCustomCrop = (cropId) => {
    Alert.alert(
      'Delete Custom Crop',
      'Are you sure you want to remove this custom crop?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setCustomCrops(customCrops.filter(c => c.id !== cropId));
            setSelectedCrops(selectedCrops.filter(c => c.id !== cropId));
          },
        },
      ]
    );
  };

  const getStatusIndicator = () => {
    if (saveStatus === SAVE_STATUS.SAVED && lastSavedAt) {
      const date = new Date(lastSavedAt);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return (
        <View style={styles.statusBar}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.statusText}>Last saved at {timeStr}</Text>
        </View>
      );
    }
    if (saveStatus === SAVE_STATUS.UNSAVED) {
      return (
        <Animated.View style={[styles.statusBar, styles.statusBarUnsaved, { opacity: statusPulse }]}>
          <Ionicons name="ellipse" size={12} color={colors.warning} />
          <Text style={[styles.statusText, { color: colors.warning }]}>Unsaved changes</Text>
        </Animated.View>
      );
    }
    if (saveStatus === SAVE_STATUS.ERROR) {
      return (
        <View style={[styles.statusBar, styles.statusBarError]}>
          <Ionicons name="alert-circle" size={16} color="#c62828" />
          <Text style={[styles.statusText, { color: '#c62828' }]}>Save failed - tap to retry</Text>
        </View>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <View style={[styles.wrapper, styles.loadingContainer]}>
        <Ionicons name="settings-outline" size={48} color={colors.primary} />
        <Text style={styles.loadingText}>Loading setup...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Setup</Text>
        <Text style={styles.headerSubtitle}>Configure your data collection</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: contentSlide }],
          }}
        >
          {/* Status Indicator */}
          {getStatusIndicator()}

          {/* Instructions */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color={colors.secondary} />
            <Text style={styles.infoText}>
              Set your location and crops before capturing. These will be applied to all photos until you change them.
            </Text>
          </View>

          {/* Device ID */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="phone-portrait-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Device ID</Text>
            </View>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{deviceId}</Text>
            </View>
          </View>

          {/* Location Selector */}
          <View style={styles.section}>
            <LocationSelector
              municipalities={MUNICIPALITIES}
              barangays={BARANGAYS}
              selectedMunicipality={selectedMunicipality}
              selectedBarangay={selectedBarangay}
              onMunicipalityChange={(muni) => {
                setSelectedMunicipality(muni);
                setSelectedBarangay(null); // Reset barangay when municipality changes
              }}
              onBarangayChange={setSelectedBarangay}
            />
          </View>

          {/* Farm Name (Optional) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="home-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Farm Name (Optional)</Text>
            </View>
            <Text style={styles.settingDescription}>
              Add a farm name to include in the file naming: (municipality)(barangay)(farm)(spot)
            </Text>
            <TextInput
              style={styles.farmNameInput}
              placeholder="e.g., Garcia Farm, Lot 5, etc."
              placeholderTextColor={colors.text.tertiary}
              value={farmName}
              onChangeText={setFarmName}
              maxLength={50}
              autoCapitalize="words"
            />
            {farmName.trim() && (
              <Text style={styles.farmNameHint}>
                Farm name will be included in captured file names
              </Text>
            )}
          </View>

          {/* Crop Selector */}
          <View style={styles.section}>
            <CropSelector
              crops={CROPS}
              selectedCrops={selectedCrops}
              onCropsChange={setSelectedCrops}
              customCrops={customCrops}
              onDeleteCustomCrop={deleteCustomCrop}
            />

            {/* Add Custom Crop */}
            <View style={styles.customCropSection}>
              <Text style={styles.customCropTitle}>Add Custom Crop</Text>
              <View style={styles.customCropInputRow}>
                <TextInput
                  style={styles.customCropInput}
                  placeholder="Enter crop name"
                  placeholderTextColor={colors.text.tertiary}
                  value={newCropName}
                  onChangeText={setNewCropName}
                  onSubmitEditing={addCustomCrop}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[
                    styles.addCropButton,
                    !newCropName.trim() && styles.addCropButtonDisabled,
                  ]}
                  onPress={addCustomCrop}
                  disabled={!newCropName.trim()}
                >
                  <Ionicons
                    name="add"
                    size={20}
                    color={newCropName.trim() ? colors.text.inverse : colors.text.muted}
                  />
                </TouchableOpacity>
              </View>
              {customCrops.length > 0 && (
                <Text style={styles.customCropHint}>
                  {customCrops.length} custom crop{customCrops.length !== 1 ? 's' : ''} added (tap X to delete)
                </Text>
              )}
            </View>
          </View>

          {/* Shots Per Spot Setting */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="images-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Shots Per Spot</Text>
            </View>
            <Text style={styles.settingDescription}>
              Number of photos to take at each spot before auto-advancing
            </Text>
            <View style={styles.numberSelector}>
              <TouchableOpacity
                style={[styles.numberBtn, shotsPerSpot <= 1 && styles.numberBtnDisabled]}
                onPress={() => {
                  if (shotsPerSpot > 1) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShotsPerSpot(shotsPerSpot - 1);
                  }
                }}
                disabled={shotsPerSpot <= 1}
              >
                <Ionicons name="remove" size={24} color={shotsPerSpot > 1 ? colors.primary : colors.text.muted} />
              </TouchableOpacity>
              <View style={styles.numberDisplay}>
                <Text style={styles.numberValue}>{shotsPerSpot}</Text>
                <Text style={styles.numberLabel}>shots</Text>
              </View>
              <TouchableOpacity
                style={[styles.numberBtn, shotsPerSpot >= 20 && styles.numberBtnDisabled]}
                onPress={() => {
                  if (shotsPerSpot < 20) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShotsPerSpot(shotsPerSpot + 1);
                  }
                }}
                disabled={shotsPerSpot >= 20}
              >
                <Ionicons name="add" size={24} color={shotsPerSpot < 20 ? colors.primary : colors.text.muted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Image Quality Setting */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="image-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Image Quality</Text>
            </View>
            <Text style={styles.settingDescription}>
              Resolution for captured photos (uniform for all captures)
            </Text>
            <View style={styles.qualitySelector}>
              <TouchableOpacity
                style={[
                  styles.qualityOption,
                  imageQuality === '720p' && styles.qualityOptionSelected,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setImageQuality('720p');
                }}
              >
                <Text style={[
                  styles.qualityLabel,
                  imageQuality === '720p' && styles.qualityLabelSelected,
                ]}>720p</Text>
                <Text style={[
                  styles.qualityDimension,
                  imageQuality === '720p' && styles.qualityDimensionSelected,
                ]}>1280 × 720</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.qualityOption,
                  imageQuality === '1080p' && styles.qualityOptionSelected,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setImageQuality('1080p');
                }}
              >
                <Text style={[
                  styles.qualityLabel,
                  imageQuality === '1080p' && styles.qualityLabelSelected,
                ]}>1080p</Text>
                <Text style={[
                  styles.qualityDimension,
                  imageQuality === '1080p' && styles.qualityDimensionSelected,
                ]}>1920 × 1080</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Capture Mode Setting */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="camera-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Capture Mode</Text>
            </View>
            <Text style={styles.settingDescription}>
              Field mode captures GPS and weather data. Controlled mode is for indoor/studio captures without GPS or temperature.
            </Text>
            <View style={styles.qualitySelector}>
              <TouchableOpacity
                style={[
                  styles.qualityOption,
                  captureMode === 'field' && styles.qualityOptionSelected,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCaptureMode('field');
                }}
              >
                <Ionicons
                  name="sunny-outline"
                  size={24}
                  color={captureMode === 'field' ? colors.primary : colors.text.tertiary}
                  style={{ marginBottom: spacing.xs }}
                />
                <Text style={[
                  styles.qualityLabel,
                  captureMode === 'field' && styles.qualityLabelSelected,
                ]}>Field</Text>
                <Text style={[
                  styles.qualityDimension,
                  captureMode === 'field' && styles.qualityDimensionSelected,
                ]}>GPS + Weather</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.qualityOption,
                  captureMode === 'controlled' && styles.qualityOptionSelected,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCaptureMode('controlled');
                }}
              >
                <Ionicons
                  name="bulb-outline"
                  size={24}
                  color={captureMode === 'controlled' ? colors.primary : colors.text.tertiary}
                  style={{ marginBottom: spacing.xs }}
                />
                <Text style={[
                  styles.qualityLabel,
                  captureMode === 'controlled' && styles.qualityLabelSelected,
                ]}>Controlled</Text>
                <Text style={[
                  styles.qualityDimension,
                  captureMode === 'controlled' && styles.qualityDimensionSelected,
                ]}>No GPS/Weather</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Save Button - fixed-size wrapper so button never changes size (gray vs orange) */}
          <View style={styles.saveButtonWrapper}>
            <TouchableOpacity
              style={styles.saveButtonTouchable}
              onPress={saveSetup}
              disabled={!canSave && saveStatus !== SAVE_STATUS.ERROR}
              activeOpacity={0.9}
            >
              <Animated.View
                style={[
                  styles.saveButton,
                  getSaveButtonStyle(),
                  (!canSave && saveStatus !== SAVE_STATUS.ERROR) && styles.saveButtonDisabled,
                  { transform: [{ scale: saveButtonScale }] },
                ]}
              >
                <Ionicons
                  name={getSaveButtonIcon()}
                  size={22}
                  color={colors.text.inverse}
                />
                <Text style={styles.saveButtonText} numberOfLines={1}>
                  {getSaveButtonText()}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          </View>

          {!isComplete && (
            <View style={styles.hintBox}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <Text style={styles.hint}>
                Please select location and at least one crop
              </Text>
            </View>
          )}

          {/* Setup Summary - show whenever complete so panel height stays consistent (gray vs orange) */}
          {isComplete && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>
                {saveStatus === SAVE_STATUS.SAVED ? 'Current Setup' : 'Setup (unsaved)'}
              </Text>
              <View style={styles.summaryRow}>
                <Ionicons name="location-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.summaryText}>
                  {selectedMunicipality.label}, {selectedBarangay.label}
                </Text>
              </View>
              {farmName.trim() && (
                <View style={styles.summaryRow}>
                  <Ionicons name="home-outline" size={16} color={colors.text.secondary} />
                  <Text style={styles.summaryText}>
                    Farm: {farmName.trim()}
                  </Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Ionicons name="leaf-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.summaryText}>
                  {selectedCrops.length} crop{selectedCrops.length !== 1 ? 's' : ''} selected
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="images-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.summaryText}>
                  {shotsPerSpot} shot{shotsPerSpot !== 1 ? 's' : ''} per spot
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="image-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.summaryText}>
                  {imageQuality} quality ({imageQuality === '1080p' ? '1920×1080' : '1280×720'})
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name={captureMode === 'field' ? 'sunny-outline' : 'bulb-outline'} size={16} color={colors.text.secondary} />
                <Text style={styles.summaryText}>
                  {captureMode === 'field' ? 'Field mode (GPS + Weather)' : 'Controlled mode (No GPS/Weather)'}
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: layout.contentPaddingBottom }} />
        </Animated.View>
      </ScrollView>

      {/* Success Popup Modal */}
      <Modal
        visible={showSuccess}
        transparent
        animationType="fade"
      >
        <View style={styles.successOverlay}>
          <Animated.View
            style={[
              styles.successBox,
              {
                transform: [{ scale: successScale }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.successIconCircle,
                {
                  transform: [{ rotate: spinInterpolate }],
                },
              ]}
            >
              <Ionicons name="checkmark" size={40} color={colors.text.inverse} />
            </Animated.View>
            <Text style={styles.successTitle}>Saved!</Text>
            <Text style={styles.successText}>Configuration saved successfully</Text>
            <Text style={styles.successSubtext}>You can now start capturing</Text>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: colors.primary,
    ...shadows.header,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.text.inverse,
  },
  headerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.md,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
  statusBarUnsaved: {
    backgroundColor: colors.warningLight,
  },
  statusBarError: {
    backgroundColor: colors.errorLight,
  },
  statusText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.secondaryLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    marginLeft: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.secondary,
    lineHeight: 18,
  },
  section: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.background.tertiary,
  },
  readOnlyText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
  },
  saveButtonWrapper: {
    width: Dimensions.get('window').width - spacing.lg * 2,
    height: 52,
    alignSelf: 'center',
  },
  saveButtonTouchable: {
    width: '100%',
    height: '100%',
  },
  saveButton: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 0,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  saveButtonDisabled: {
    backgroundColor: colors.text.muted,
  },
  saveButtonSaved: {
    backgroundColor: colors.primaryDark,
  },
  saveButtonSaving: {
    backgroundColor: colors.secondary,
  },
  saveButtonError: {
    backgroundColor: colors.error,
  },
  saveButtonUnsaved: {
    backgroundColor: colors.warning,
  },
  saveButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.text.inverse,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.tertiary,
  },
  summaryBox: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    ...shadows.sm,
  },
  summaryTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
  },
  // Success Modal
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBox: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    marginHorizontal: 40,
    ...shadows.lg,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  successText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.text.secondary,
  },
  successSubtext: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  // Shots per spot styles
  settingDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
  },
  numberSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  numberBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBtnDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  numberDisplay: {
    alignItems: 'center',
    minWidth: 80,
  },
  numberValue: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.primary,
  },
  numberLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.tertiary,
  },
  // Image quality selector styles
  qualitySelector: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  qualityOption: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
  },
  qualityOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  qualityLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  qualityLabelSelected: {
    color: colors.primary,
  },
  qualityDimension: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
  },
  qualityDimensionSelected: {
    color: colors.primaryDark,
  },
  // Custom crop styles
  customCropSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  customCropTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  customCropInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  customCropInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
  },
  addCropButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCropButtonDisabled: {
    backgroundColor: colors.background.tertiary,
  },
  customCropHint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
  },
  // Farm name input styles
  farmNameInput: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.secondary,
  },
  farmNameHint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.primary,
    marginTop: spacing.sm,
  },
});
