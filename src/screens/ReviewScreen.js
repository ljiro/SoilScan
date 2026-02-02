import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  Animated,
  Easing,
  TextInput,
  Modal,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { readCSV, deleteFromCSV, updateCSVField, updateCSVRow, parseCSVToRecords } from '../services/csvService';
import { fonts, fontSizes, colors, radius, spacing, shadows, layout } from '../constants/theme';
import { getAppRootDir, getAppRootDirAsync, getInfoStorage, deleteFileStorage } from '../services/storageService';
import EditMetadataModal from '../components/EditMetadataModal';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Debug logging helper - __DEV__ is a React Native global
// eslint-disable-next-line no-undef
const DEBUG_MODE = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
const logDebug = (message, data = null) => {
  if (DEBUG_MODE) {
    if (data) {
      console.log(`[ReviewScreen] ${message}`, data);
    } else {
      console.log(`[ReviewScreen] ${message}`);
    }
  }
};

/**
 * Resolve image filename to full path.
 * Handles multiple path formats:
 * - Relative path: "images/2024/01/01/image.jpg" -> "{documentDir}AgriCapture/images/..."
 * - Just filename: "image.jpg" -> "{documentDir}AgriCapture/images/image.jpg"
 * - Already full path: returns as-is
 */
const resolveImagePath = (imageFilename, appRootOverride) => {
  if (!imageFilename) {
    logDebug('resolveImagePath: No filename provided');
    return null;
  }

  // Trim whitespace and remove any quotes
  const cleanFilename = imageFilename.trim().replace(/^["']|["']$/g, '');

  const appRoot = appRootOverride != null ? appRootOverride : getAppRootDir();
  logDebug('resolveImagePath input:', cleanFilename);
  logDebug('resolveImagePath appRoot:', appRoot);

  let resolvedPath;

  // If it's already an absolute path (starts with file:// or /)
  if (cleanFilename.startsWith('file://') || cleanFilename.startsWith('/')) {
    resolvedPath = cleanFilename;
  }
  // If it already starts with "images/", append to app root
  else if (cleanFilename.startsWith('images/')) {
    resolvedPath = `${appRoot}${cleanFilename}`;
  }
  // Otherwise, assume it's just a filename and put it in images folder
  else {
    resolvedPath = `${appRoot}images/${cleanFilename}`;
  }

  logDebug('resolveImagePath resolved:', resolvedPath);
  return resolvedPath;
};

const THUMBNAIL_SIZE = 120;

// GPS Accuracy levels
const getGPSAccuracyInfo = (accuracy) => {
  const acc = parseFloat(accuracy);
  if (isNaN(acc)) return { label: 'Unknown', color: colors.text.tertiary, icon: 'help-circle' };
  if (acc <= 5) return { label: 'Excellent', color: colors.success, icon: 'checkmark-circle' };
  if (acc <= 10) return { label: 'Good', color: colors.primary, icon: 'checkmark-circle-outline' };
  if (acc <= 20) return { label: 'Fair', color: colors.warning, icon: 'alert-circle-outline' };
  return { label: 'Poor', color: colors.error, icon: 'close-circle-outline' };
};

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Filter options
const DATE_FILTERS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

export default function ReviewScreen({ navigation }) {
  const [records, setRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, today: 0, thisWeek: 0 });
  const [error, setError] = useState(null);

  // Track if initial load has happened to prevent double-load race
  const hasInitiallyLoaded = useRef(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [cropFilter, setCropFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [spotFilter, setSpotFilter] = useState('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Expanded cards state
  const [expandedCards, setExpandedCards] = useState({});

  // Expanded spots state (for grouped view)
  const [expandedSpots, setExpandedSpots] = useState({});

  // Long-press delete state for spots
  const [spotShowingDelete, setSpotShowingDelete] = useState(null);

  // Spot editing state
  const [editingSpot, setEditingSpot] = useState(null);
  const [spotInputValue, setSpotInputValue] = useState('');

  // Full record editing state
  const [editingRecord, setEditingRecord] = useState(null);

  // Animation values
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;
  const searchBarWidth = useRef(new Animated.Value(0)).current;
  const refreshIndicator = useRef(new Animated.Value(0)).current;

  // Card animation refs
  const cardAnimations = useRef({}).current;

  useEffect(() => {
    // Initial load only once
    if (!hasInitiallyLoaded.current) {
      hasInitiallyLoaded.current = true;
      loadRecords();
    }

    // Smooth entrance animation
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
      Animated.timing(searchBarWidth, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: false,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Only reload on subsequent focus events, not the initial one
      if (hasInitiallyLoaded.current) {
        loadRecords();
      }
    });
    return unsubscribe;
  }, [navigation]);

  // Apply filters when records, search, or filters change
  useEffect(() => {
    applyFilters();
  }, [records, searchQuery, dateFilter, cropFilter, locationFilter, spotFilter]);

  const loadRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      logDebug('=== Starting to load records ===');

      const csvContent = await readCSV();
      logDebug('CSV content length:', csvContent.length);

      // Log first 500 chars of CSV for debugging
      if (csvContent.length > 0) {
        logDebug('CSV preview:', csvContent.substring(0, 500));
      }

      // Use the proper CSV parser that handles newlines in quoted fields
      const parsedRecords = parseCSVToRecords(csvContent);
      logDebug('Parsed records count:', parsedRecords.length);

      if (parsedRecords.length === 0) {
        logDebug('No data rows found');
        setRecords([]);
        setFilteredRecords([]); // Fix race condition - set immediately
        setStats({ total: 0, today: 0, thisWeek: 0 });
        setLoading(false);
        return;
      }

      const data = [];
      const appRoot = await getAppRootDirAsync();

      for (let index = 0; index < parsedRecords.length; index++) {
        const record = { ...parsedRecords[index] };
        record.id = index.toString();

        // Resolve image path for display (use async base for external/SAF storage)
        if (record.image_filename) {
          record._resolvedImagePath = resolveImagePath(record.image_filename, appRoot);
        }

        data.push(record);
      }

      // Sort by most recent first
      const sortedData = data.reverse();

      logDebug('Successfully parsed records:', sortedData.length);
      if (sortedData.length > 0) {
        logDebug('Sample record:', {
          uuid: sortedData[0].uuid,
          image_filename: sortedData[0].image_filename,
          _resolvedImagePath: sortedData[0]._resolvedImagePath,
          _resolvedImagePath: sortedData[0]._resolvedImagePath,
        });
      }

      setRecords(sortedData);
      setFilteredRecords(sortedData); // Fix race condition - set immediately with data

      // Calculate stats
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const todayCount = sortedData.filter(r => {
        if (!r.capture_datetime) return false;
        // Handle both ISO format and other date formats
        const recordDateStr = r.capture_datetime.slice(0, 10);
        return recordDateStr === today;
      }).length;

      const weekCount = sortedData.filter(r => {
        if (!r.capture_datetime) return false;
        try {
          const recordDate = new Date(r.capture_datetime);
          return !isNaN(recordDate.getTime()) && recordDate >= weekAgo;
        } catch {
          return false;
        }
      }).length;

      const newStats = {
        total: sortedData.length,
        today: todayCount,
        thisWeek: weekCount,
      };

      logDebug('Stats calculated:', newStats);
      setStats(newStats);

      setLoading(false);
    } catch (err) {
      console.error('[ReviewScreen] Error loading records:', err);
      logDebug('Error details:', { message: err.message, stack: err.stack });
      setError(`Failed to load records: ${err.message}`);
      setRecords([]);
      setFilteredRecords([]);
      setStats({ total: 0, today: 0, thisWeek: 0 });
      setLoading(false);
    }
  };

  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const applyFilters = useCallback(() => {
    let filtered = [...records];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.municipality?.toLowerCase().includes(query) ||
        r.barangay?.toLowerCase().includes(query) ||
        r.crops?.toLowerCase().includes(query) ||
        r.notes?.toLowerCase().includes(query)
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      filtered = filtered.filter(r => {
        if (!r.capture_datetime) return false;
        const recordDate = new Date(r.capture_datetime);

        switch (dateFilter) {
          case 'today':
            return r.capture_datetime.startsWith(today);
          case 'week': {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return recordDate >= weekAgo;
          }
          case 'month': {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return recordDate >= monthAgo;
          }
          default:
            return true;
        }
      });
    }

    // Crop filter
    if (cropFilter !== 'all') {
      filtered = filtered.filter(r =>
        r.crops?.toLowerCase().includes(cropFilter.toLowerCase())
      );
    }

    // Location filter
    if (locationFilter !== 'all') {
      filtered = filtered.filter(r =>
        r.municipality?.toLowerCase() === locationFilter.toLowerCase()
      );
    }

    // Spot filter
    if (spotFilter !== 'all') {
      filtered = filtered.filter(r =>
        r.spot_number?.toString() === spotFilter.toString()
      );
    }

    setFilteredRecords(filtered);
  }, [records, searchQuery, dateFilter, cropFilter, locationFilter, spotFilter]);

  const onRefresh = async () => {
    setRefreshing(true);

    // Animate refresh indicator
    Animated.sequence([
      Animated.timing(refreshIndicator, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(refreshIndicator, {
        toValue: 0,
        duration: 200,
        delay: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();

    await loadRecords();
    setRefreshing(false);
  };

  const toggleCardExpanded = (id) => {
    // Initialize animation value if not exists
    if (!cardAnimations[id]) {
      cardAnimations[id] = new Animated.Value(0);
    }

    const isCurrentlyExpanded = expandedCards[id];
    const targetValue = isCurrentlyExpanded ? 0 : 1;

    Animated.timing(cardAnimations[id], {
      toValue: targetValue,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.out(Easing.cubic),
    }).start();

    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleDeleteRecord = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Delete Record',
      'Are you sure you want to delete this record? This will remove the image and all associated data. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

              // Delete from CSV
              await deleteFromCSV(item.uuid);

              // Delete the image file
              if (item.image_filename) {
                const appRoot = await getAppRootDirAsync();
                const imagePath = item._resolvedImagePath || resolveImagePath(item.image_filename, appRoot);
                logDebug('Deleting image at:', imagePath);
                try {
                  const fileInfo = await getInfoStorage(imagePath);
                  if (fileInfo.exists) {
                    await deleteFileStorage(imagePath);
                    logDebug('Image deleted successfully');
                  } else {
                    logDebug('Image file not found for deletion');
                  }
                } catch (deleteErr) {
                  logDebug('Error deleting image:', deleteErr.message);
                }
              }

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Reload records
              loadRecords();
            } catch (error) {
              console.error('Error deleting record:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete the record. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEditSpotNumber = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSpotInputValue(item.spot_number?.toString() || '1');
    setEditingSpot(item);
  };

  // Handle retake photo - navigate to Capture screen with retake params
  const handleRetakePhoto = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Navigate to Capture screen with retake mode params
    navigation.navigate('Capture', {
      retakeMode: true,
      retakeRecord: {
        uuid: item.uuid,
        spot_number: item.spot_number,
        shot_number: item.shot_number,
        image_filename: item.image_filename,
        _resolvedImagePath: item._resolvedImagePath,
      },
    });
  };

  const saveSpotNumber = async () => {
    if (!editingSpot) return;

    const spotNum = parseInt(spotInputValue, 10);
    if (isNaN(spotNum) || spotNum < 1) {
      Alert.alert('Invalid', 'Please enter a valid spot number (1 or greater)');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const success = await updateCSVField(editingSpot.uuid, 'spot_number', spotNum);
      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEditingSpot(null);
        loadRecords();
      } else {
        Alert.alert('Error', 'Failed to update spot number');
      }
    } catch (error) {
      console.error('Error updating spot:', error);
      Alert.alert('Error', 'Failed to update spot number');
    }
  };

  // Handle full record editing
  const handleEditRecord = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingRecord(item);
  };

  // Save edited record
  const saveEditedRecord = async (uuid, updates) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await updateCSVRow(uuid, updates);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEditingRecord(null);
        loadRecords();
      } else {
        throw new Error(result.error || 'Failed to update record');
      }
    } catch (error) {
      console.error('Error updating record:', error);
      throw error;
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setDateFilter('all');
    setCropFilter('all');
    setLocationFilter('all');
    setSpotFilter('all');
  };

  const hasActiveFilters = searchQuery || dateFilter !== 'all' || cropFilter !== 'all' || locationFilter !== 'all' || spotFilter !== 'all';

  // Get unique crops from records
  const uniqueCrops = useMemo(() => {
    const crops = new Set();
    records.forEach(r => {
      if (r.crops) {
        r.crops.split(',').forEach(c => crops.add(c.trim()));
      }
    });
    return Array.from(crops).sort();
  }, [records]);

  // Get unique municipalities from records
  const uniqueLocations = useMemo(() => {
    const locations = new Set();
    records.forEach(r => {
      if (r.municipality) {
        locations.add(r.municipality);
      }
    });
    return Array.from(locations).sort();
  }, [records]);

  // Get unique spot numbers from records
  const uniqueSpots = useMemo(() => {
    const spots = new Set();
    records.forEach(r => {
      if (r.spot_number) {
        spots.add(r.spot_number.toString());
      }
    });
    return Array.from(spots).sort((a, b) => Number(a) - Number(b));
  }, [records]);

  // Group filtered records by spot number for section list
  const groupedBySpot = useMemo(() => {
    const groups = {};
    filteredRecords.forEach(record => {
      const spot = record.spot_number?.toString() || 'Unassigned';
      if (!groups[spot]) groups[spot] = [];
      groups[spot].push(record);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return Number(a) - Number(b);
      })
      .map(([spot, data]) => {
        // Get location from first record in the spot
        const firstRecord = data[0];
        const municipality = firstRecord?.municipality || '';
        const barangay = firstRecord?.barangay || '';

        // Create distinctive title like "1/La Trinidad/Puguis"
        let title;
        if (spot === 'Unassigned') {
          title = 'Unassigned';
        } else if (municipality && barangay) {
          title = `${spot}/${municipality}/${barangay}`;
        } else if (municipality) {
          title = `${spot}/${municipality}`;
        } else {
          title = `Spot ${spot}`;
        }

        return {
          title,
          spot,
          data: expandedSpots[spot] ? data : [],
          count: data.length,
          allData: data,
        };
      });
  }, [filteredRecords, expandedSpots]);

  // Toggle spot section (directory-style, no animation)
  const toggleSpotExpanded = (spot) => {
    // If delete button is showing, hide it on tap
    if (spotShowingDelete === spot) {
      setSpotShowingDelete(null);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSpots(prev => ({
      ...prev,
      [spot]: !prev[spot],
    }));
  };

  // Long press on spot to show delete option
  const handleSpotLongPress = (spot) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSpotShowingDelete(spot);
  };

  // Delete all records in a spot
  const handleDeleteSpot = (spot, count) => {
    Alert.alert(
      'Delete Spot',
      `Are you sure you want to delete all ${count} photo${count !== 1 ? 's' : ''} in this spot? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setSpotShowingDelete(null) },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

              // Get all records for this spot
              const spotRecords = records.filter(r => r.spot_number?.toString() === spot);

              // Delete each record
              for (const record of spotRecords) {
                // Delete image file
                if (record._resolvedImagePath) {
                  try {
                    const fileInfo = await getInfoStorage(record._resolvedImagePath);
                    if (fileInfo.exists) {
                      await deleteFileStorage(record._resolvedImagePath);
                    }
                  } catch (err) {
                    console.warn('Could not delete image:', err.message);
                  }
                }
                // Delete CSV row
                await deleteFromCSV(record.uuid);
              }

              // Refresh the list
              setSpotShowingDelete(null);
              loadRecords();

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Error deleting spot:', error);
              Alert.alert('Error', 'Failed to delete some records. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderCard = ({ item, index }) => {
    // Use the pre-resolved path or resolve now
    let imagePath = item._resolvedImagePath || resolveImagePath(item.image_filename);

    // Ensure the path has proper file:// prefix for Image (content:// and http stay as-is)
    if (imagePath && !imagePath.startsWith('file://') && !imagePath.startsWith('content://') && !imagePath.startsWith('http')) {
      imagePath = `file://${imagePath}`;
    }

    // Show image when we have a path; Image component handles missing files via onError
    const imageExists = !!imagePath;
    const gpsInfo = getGPSAccuracyInfo(item.gps_accuracy_m);

    // Debug logging for image display
    if (index === 0) {
      logDebug('First card image path:', imagePath);
      logDebug('First card imageExists:', imageExists);
    }

    // Initialize animation if needed
    if (!cardAnimations[item.id]) {
      cardAnimations[item.id] = new Animated.Value(0);
    }

    const expandedHeight = cardAnimations[item.id].interpolate({
      inputRange: [0, 1],
      outputRange: [0, 420],
    });

    const rotateArrow = cardAnimations[item.id].interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '180deg'],
    });

    const hasWeather = item.temperature_c || item.humidity_percent;

    return (
      <Animated.View
        style={[
          styles.card,
          {
            opacity: contentOpacity,
            transform: [{
              translateY: contentSlide.interpolate({
                inputRange: [0, 20],
                outputRange: [0, 20 + (index * 5)],
              }),
            }],
          },
        ]}
      >
        {/* Main Card Content */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => toggleCardExpanded(item.id)}
          style={styles.cardTouchable}
        >
          <View style={styles.cardMain}>
            {/* Thumbnail */}
            <View style={styles.thumbnailContainer}>
              {imagePath && imageExists ? (
                <Image
                  source={{ uri: imagePath }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                  onError={(e) => {
                    logDebug(`Image load error for ${item.id}:`, e.nativeEvent?.error);
                  }}
                />
              ) : (
                <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                  <Ionicons name="image-outline" size={40} color={colors.text.tertiary} />
                  <Text style={styles.thumbnailPlaceholderText}>No Image</Text>
                </View>
              )}
              {/* Date badge on thumbnail */}
              <View style={styles.dateBadge}>
                <Text style={styles.dateBadgeText}>{formatDate(item.capture_datetime)}</Text>
              </View>
            </View>

            {/* Card Info */}
            <View style={styles.cardContent}>
              {/* Location */}
              <View style={styles.locationRow}>
                <Ionicons name="location" size={16} color={colors.primary} />
                <Text style={styles.location} numberOfLines={1}>
                  {item.municipality || 'Unknown'}
                </Text>
              </View>
              <Text style={styles.barangay} numberOfLines={1}>
                {item.barangay || 'Unknown Barangay'}
              </Text>

              {/* Crops */}
              <View style={styles.cropsContainer}>
                <Ionicons name="leaf" size={14} color={colors.accent} />
                <Text style={styles.crops} numberOfLines={1}>
                  {item.crops || 'No crops specified'}
                </Text>
              </View>

              {/* Time & Spot Info */}
              <View style={styles.timeSpotRow}>
                <Text style={styles.time}>
                  {formatTime(item.capture_datetime)}
                </Text>
                {item.spot_number && (
                  <View style={styles.spotBadge}>
                    <Ionicons name="pin" size={10} color={colors.primary} />
                    <Text style={styles.spotBadgeText}>
                      Spot {item.spot_number}{item.shot_number ? ` / Shot ${item.shot_number}` : ''}
                    </Text>
                  </View>
                )}
              </View>

              {/* Bottom Row - GPS Accuracy & Weather Indicators */}
              <View style={styles.indicatorsRow}>
                {/* GPS Accuracy */}
                <View style={[styles.indicator, { backgroundColor: `${gpsInfo.color}15` }]}>
                  <Ionicons name={gpsInfo.icon} size={12} color={gpsInfo.color} />
                  <Text style={[styles.indicatorText, { color: gpsInfo.color }]}>
                    {gpsInfo.label}
                  </Text>
                </View>

                {/* Weather indicator */}
                {hasWeather && (
                  <View style={[styles.indicator, { backgroundColor: colors.secondaryLight }]}>
                    <Ionicons name="thermometer-outline" size={12} color={colors.secondary} />
                    <Text style={[styles.indicatorText, { color: colors.secondary }]}>
                      Weather
                    </Text>
                  </View>
                )}

                {/* Expand button */}
                <Animated.View style={[styles.expandButton, { transform: [{ rotate: rotateArrow }] }]}>
                  <Ionicons name="chevron-down" size={18} color={colors.text.tertiary} />
                </Animated.View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Expanded Details */}
        <Animated.View style={[styles.expandedContent, { height: expandedHeight }]}>
          <View style={styles.expandedInner}>
            <View style={styles.dividerLine} />

            {/* Spot/Shot Info */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Spot Information</Text>
              <View style={styles.spotEditRow}>
                <View style={styles.spotEditInfo}>
                  <View style={styles.spotEditItem}>
                    <Text style={styles.detailLabel}>Spot #</Text>
                    <Text style={styles.detailValue}>{item.spot_number || 'N/A'}</Text>
                  </View>
                  <View style={styles.spotEditItem}>
                    <Text style={styles.detailLabel}>Shot #</Text>
                    <Text style={styles.detailValue}>{item.shot_number || 'N/A'}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.editSpotButton}
                  onPress={() => handleEditRecord(item)}
                >
                  <Ionicons name="create-outline" size={14} color={colors.primary} />
                  <Text style={styles.editSpotButtonText}>Edit</Text>
                </TouchableOpacity>
              </View>
              {/* Retake Photo Button */}
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={() => handleRetakePhoto(item)}
              >
                <Ionicons name="camera" size={16} color={colors.secondary} />
                <Text style={styles.retakeButtonText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>

            {/* GPS Details */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>GPS Data</Text>
              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Latitude</Text>
                  <Text style={styles.detailValue}>{item.latitude || 'N/A'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Longitude</Text>
                  <Text style={styles.detailValue}>{item.longitude || 'N/A'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Altitude</Text>
                  <Text style={styles.detailValue}>{item.altitude_m ? `${item.altitude_m}m` : 'N/A'}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Accuracy</Text>
                  <Text style={[styles.detailValue, { color: gpsInfo.color }]}>
                    {item.gps_accuracy_m ? `${parseFloat(item.gps_accuracy_m).toFixed(1)}m` : 'N/A'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Weather Details */}
            {hasWeather && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Weather</Text>
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Temperature</Text>
                    <Text style={styles.detailValue}>
                      {item.temperature_c ? `${item.temperature_c}°C` : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Humidity</Text>
                    <Text style={styles.detailValue}>
                      {item.humidity_percent ? `${item.humidity_percent}%` : 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Notes */}
            {item.notes && (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Notes</Text>
                <Text style={styles.notesText}>{item.notes}</Text>
              </View>
            )}

            {/* Delete Button */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteRecord(item)}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={styles.deleteButtonText}>Delete Record</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    );
  };

  // Render section header for grouped view (directory style)
  const renderSectionHeader = ({ section }) => {
    const isExpanded = expandedSpots[section.spot];
    const showDelete = spotShowingDelete === section.spot;

    return (
      <TouchableOpacity
        style={[
          styles.sectionHeader,
          isExpanded && styles.sectionHeaderExpanded,
          showDelete && styles.sectionHeaderDelete,
        ]}
        onPress={() => toggleSpotExpanded(section.spot)}
        onLongPress={() => handleSpotLongPress(section.spot)}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderLeft}>
          {showDelete ? (
            <Ionicons name="alert-circle" size={24} color={colors.error} />
          ) : (
            <Ionicons
              name={isExpanded ? 'folder-open' : 'folder'}
              size={24}
              color={isExpanded ? colors.primary : colors.secondary}
            />
          )}
          <Text
            style={[
              styles.sectionTitle,
              isExpanded && styles.sectionTitleExpanded,
              showDelete && styles.sectionTitleDelete,
            ]}
            numberOfLines={1}
          >
            {section.title}
          </Text>
        </View>
        <View style={styles.sectionHeaderRight}>
          {showDelete ? (
            <TouchableOpacity
              style={styles.spotDeleteButton}
              onPress={() => handleDeleteSpot(section.spot, section.count)}
            >
              <Ionicons name="trash" size={16} color={colors.text.inverse} />
              <Text style={styles.spotDeleteButtonText}>Delete All</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={[styles.sectionBadge, isExpanded && styles.sectionBadgeExpanded]}>
                <Text style={[styles.sectionBadgeText, isExpanded && styles.sectionBadgeTextExpanded]}>
                  {section.count}
                </Text>
              </View>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.text.tertiary}
              />
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // No footer needed for directory-style view
  const renderSectionFooter = () => null;

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setShowFilterModal(false)}
      >
        <Pressable style={styles.filterModal} onPress={(e) => e.stopPropagation()}>
          <View style={styles.filterModalHeader}>
            <Text style={styles.filterModalTitle}>Filters</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          {/* Date Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Date Range</Text>
            <View style={styles.filterOptions}>
              {DATE_FILTERS.map((filter) => (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    styles.filterOption,
                    dateFilter === filter.id && styles.filterOptionActive,
                  ]}
                  onPress={() => setDateFilter(filter.id)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      dateFilter === filter.id && styles.filterOptionTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Crop Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Crop Type</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  cropFilter === 'all' && styles.filterOptionActive,
                ]}
                onPress={() => setCropFilter('all')}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    cropFilter === 'all' && styles.filterOptionTextActive,
                  ]}
                >
                  All Crops
                </Text>
              </TouchableOpacity>
              {uniqueCrops.slice(0, 8).map((crop) => (
                <TouchableOpacity
                  key={crop}
                  style={[
                    styles.filterOption,
                    cropFilter === crop && styles.filterOptionActive,
                  ]}
                  onPress={() => setCropFilter(crop)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      cropFilter === crop && styles.filterOptionTextActive,
                    ]}
                  >
                    {crop}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Location Filter */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>Location</Text>
            <View style={styles.filterOptions}>
              <TouchableOpacity
                style={[
                  styles.filterOption,
                  locationFilter === 'all' && styles.filterOptionActive,
                ]}
                onPress={() => setLocationFilter('all')}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    locationFilter === 'all' && styles.filterOptionTextActive,
                  ]}
                >
                  All Locations
                </Text>
              </TouchableOpacity>
              {uniqueLocations.map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[
                    styles.filterOption,
                    locationFilter === loc && styles.filterOptionActive,
                  ]}
                  onPress={() => setLocationFilter(loc)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      locationFilter === loc && styles.filterOptionTextActive,
                    ]}
                  >
                    {loc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Spot Filter */}
          {uniqueSpots.length > 0 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Spot Number</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[
                    styles.filterOption,
                    spotFilter === 'all' && styles.filterOptionActive,
                  ]}
                  onPress={() => setSpotFilter('all')}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      spotFilter === 'all' && styles.filterOptionTextActive,
                    ]}
                  >
                    All Spots
                  </Text>
                </TouchableOpacity>
                {uniqueSpots.map((spot) => (
                  <TouchableOpacity
                    key={spot}
                    style={[
                      styles.filterOption,
                      spotFilter === spot && styles.filterOptionActive,
                    ]}
                    onPress={() => setSpotFilter(spot)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        spotFilter === spot && styles.filterOptionTextActive,
                      ]}
                    >
                      Spot {spot}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.filterModalActions}>
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={clearFilters}
            >
              <Text style={styles.clearFiltersText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyFiltersButton}
              onPress={() => setShowFilterModal(false)}
            >
              <Text style={styles.applyFiltersText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons
          name={hasActiveFilters ? "search-outline" : "images-outline"}
          size={40}
          color={colors.text.tertiary}
        />
      </View>
      <Text style={styles.emptyText}>
        {hasActiveFilters ? 'No matching records' : 'No records yet'}
      </Text>
      <Text style={styles.emptySubtext}>
        {hasActiveFilters
          ? 'Try adjusting your search or filters'
          : 'Capture some data to see it here'}
      </Text>
      {hasActiveFilters && (
        <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
          <Text style={styles.clearFiltersBtnText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentSlide }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.title}>Review</Text>
              <Text style={styles.subtitle}>View captured data</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={onRefresh}
                disabled={refreshing || loading}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="refresh"
                  size={22}
                  color={colors.text.inverse}
                  style={refreshing ? styles.refreshingIcon : null}
                />
              </TouchableOpacity>
              <Animated.View
                style={[
                  styles.refreshIndicatorContainer,
                  {
                    opacity: refreshIndicator,
                    transform: [{
                      scale: refreshIndicator.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    }],
                  },
                ]}
              >
                <Ionicons name="checkmark-circle" size={24} color={colors.text.inverse} />
              </Animated.View>
            </View>
          </View>
        </View>

        {/* Stats Header */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.today}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.thisWeek}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
        </View>

        {/* Search and Filter Bar */}
        <Animated.View
          style={[
            styles.searchFilterContainer,
            {
              opacity: searchBarWidth,
              transform: [{
                scaleX: searchBarWidth.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              }],
            },
          ]}
        >
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search records..."
              placeholderTextColor={colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[
              styles.filterButton,
              hasActiveFilters && styles.filterButtonActive,
            ]}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons
              name="options"
              size={20}
              color={hasActiveFilters ? colors.text.inverse : colors.primary}
            />
            {hasActiveFilters && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {[dateFilter !== 'all', cropFilter !== 'all', locationFilter !== 'all', spotFilter !== 'all'].filter(Boolean).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <View style={styles.activeFiltersContainer}>
            <Text style={styles.activeFiltersLabel}>
              Showing {filteredRecords.length} of {records.length} records
            </Text>
          </View>
        )}

        {/* Records List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading records...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconCircle}>
              <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
            </View>
            <Text style={styles.errorTitle}>Failed to Load Records</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadRecords}>
              <Ionicons name="refresh" size={18} color={colors.text.inverse} />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : filteredRecords.length === 0 ? (
          renderEmptyState()
        ) : (
          <SectionList
            sections={groupedBySpot}
            keyExtractor={item => item.id}
            renderItem={renderCard}
            renderSectionHeader={renderSectionHeader}
            renderSectionFooter={renderSectionFooter}
            stickySectionHeadersEnabled={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.background.primary}
              />
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={5}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        )}
      </Animated.View>

      {renderFilterModal()}

      {/* Spot Edit Modal */}
      <Modal
        visible={!!editingSpot}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingSpot(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setEditingSpot(null)}
        >
          <Pressable style={styles.spotEditModal} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.spotEditModalTitle}>Edit Spot Number</Text>
            <Text style={styles.spotEditModalSubtitle}>
              Current: Spot {editingSpot?.spot_number || 'N/A'}
            </Text>
            <TextInput
              style={styles.spotEditInput}
              value={spotInputValue}
              onChangeText={setSpotInputValue}
              keyboardType="number-pad"
              placeholder="Enter spot number"
              placeholderTextColor={colors.text.tertiary}
              autoFocus
            />
            <View style={styles.spotEditModalActions}>
              <TouchableOpacity
                style={styles.spotEditCancelButton}
                onPress={() => setEditingSpot(null)}
              >
                <Text style={styles.spotEditCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.spotEditSaveButton}
                onPress={saveSpotNumber}
              >
                <Text style={styles.spotEditSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full Edit Modal */}
      <EditMetadataModal
        visible={!!editingRecord}
        record={editingRecord}
        onClose={() => setEditingRecord(null)}
        onSave={saveEditedRecord}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  content: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.primary,
    ...shadows.header,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshingIcon: {
    opacity: 0.6,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.text.inverse,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  refreshIndicatorContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.full,
    padding: spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: -spacing.lg,
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  statNumber: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.primary,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  searchFilterContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.primary,
    marginLeft: spacing.sm,
    paddingVertical: 0,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: radius.full,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.text.inverse,
  },
  activeFiltersContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  activeFiltersLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: layout.contentPaddingBottom,
  },
  card: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.md,
  },
  cardTouchable: {
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
  },
  thumbnailContainer: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background.tertiary,
  },
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholderText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  dateBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  dateBadgeText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs - 1,
    color: colors.text.inverse,
  },
  cardContent: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  location: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.text.primary,
    flex: 1,
  },
  barangay: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginTop: 2,
    marginLeft: 20,
  },
  cropsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  crops: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.accent,
    flex: 1,
  },
  time: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  indicatorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    gap: 4,
  },
  indicatorText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs - 1,
  },
  expandButton: {
    marginLeft: 'auto',
    padding: spacing.xs,
  },
  expandedContent: {
    overflow: 'hidden',
  },
  expandedInner: {
    padding: spacing.md,
    paddingTop: 0,
  },
  dividerLine: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  detailSection: {
    marginBottom: spacing.md,
  },
  detailSectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailItem: {
    minWidth: 80,
  },
  detailLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
  },
  detailValue: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
    marginTop: 2,
  },
  notesText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    paddingBottom: layout.contentPaddingBottom,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.lg,
    color: colors.text.primary,
  },
  emptySubtext: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  clearFiltersBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
  },
  clearFiltersBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: layout.contentPaddingBottom,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    paddingBottom: layout.contentPaddingBottom,
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.lg,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  retryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.text.inverse,
  },
  // Filter Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  filterModalTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xl,
    color: colors.text.primary,
  },
  filterSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  filterSectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterOptionActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filterOptionText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
  },
  filterOptionTextActive: {
    color: colors.primary,
  },
  filterModalActions: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  clearFiltersButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
  },
  clearFiltersText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.text.secondary,
  },
  applyFiltersButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  applyFiltersText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.text.inverse,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.error,
  },
  // Time & Spot Row
  timeSpotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  spotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    gap: 4,
  },
  spotBadgeText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs - 1,
    color: colors.primary,
  },
  // Spot Edit Row in Expanded Content
  spotEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spotEditInfo: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  spotEditItem: {
    minWidth: 60,
  },
  editSpotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
  editSpotButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  // Spot Edit Modal
  spotEditModal: {
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignSelf: 'center',
    width: '85%',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  spotEditModalTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.lg,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  spotEditModalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  spotEditInput: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xl,
    color: colors.text.primary,
    textAlign: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  spotEditModalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  spotEditCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
  },
  spotEditCancelText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.text.secondary,
  },
  spotEditSaveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  spotEditSaveText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.text.inverse,
  },
  // Section Header Styles (directory style)
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.border,
  },
  sectionHeaderExpanded: {
    borderLeftColor: colors.primary,
    backgroundColor: colors.primaryLight,
    marginBottom: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    flex: 1,
  },
  sectionTitleExpanded: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionBadge: {
    backgroundColor: colors.background.tertiary,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionBadgeExpanded: {
    backgroundColor: colors.primary,
  },
  sectionBadgeText: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  sectionBadgeTextExpanded: {
    color: colors.text.inverse,
  },
  // Section header delete state
  sectionHeaderDelete: {
    borderLeftColor: colors.error,
    backgroundColor: colors.errorLight,
  },
  sectionTitleDelete: {
    color: colors.error,
  },
  spotDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.error,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  spotDeleteButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.text.inverse,
  },
  // Retake button
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.secondaryLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  retakeButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.secondary,
  },
});
