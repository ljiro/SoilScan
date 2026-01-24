import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import JSZip from 'jszip';
import { getCSVPath, readCSV, parseCSVContent } from '../services/csvService';
import { getImagesDir } from '../services/storageService';
import { isSAFInitialized, getStorageLocationInfo } from '../services/publicStorageService';
import { fonts, fontSizes, colors, radius, spacing, shadows, layout } from '../constants/theme';

// Debug logging helper - __DEV__ is a React Native global
// eslint-disable-next-line no-undef
const DEBUG_MODE = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
const logDebug = (message, data = null) => {
  if (DEBUG_MODE) {
    if (data) {
      console.log(`[ExportScreen] ${message}`, data);
    } else {
      console.log(`[ExportScreen] ${message}`);
    }
  }
};

export default function ExportScreen({ navigation }) {
  const [stats, setStats] = useState({ records: 0, images: 0, csvSize: 0, imagesSize: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState('');

  // SAF status
  const [safEnabled, setSafEnabled] = useState(false);
  const [storagePath, setStoragePath] = useState('');

  // Municipality selection state
  const [availableMunicipalities, setAvailableMunicipalities] = useState([]);
  const [selectedMunicipalities, setSelectedMunicipalities] = useState([]);
  const [municipalityStats, setMunicipalityStats] = useState({});

  // Animation values
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadStats();
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
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadStats();
    });
    return unsubscribe;
  }, [navigation]);

  const loadStats = async () => {
    try {
      logDebug('Loading export stats...');

      // Check SAF status
      try {
        const hasSAF = await isSAFInitialized();
        setSafEnabled(hasSAF);
        if (hasSAF) {
          const info = await getStorageLocationInfo();
          setStoragePath(info.displayPath || '');
        }
        logDebug('SAF enabled:', hasSAF);
      } catch (e) {
        logDebug('Error checking SAF:', e.message);
      }

      // Count CSV records using proper parser (handles newlines in quoted fields)
      const csvContent = await readCSV();
      const rows = parseCSVContent(csvContent);

      // Count data rows (exclude header row)
      const recordCount = Math.max(0, rows.length - 1);

      logDebug(`CSV record count: ${recordCount} (total rows: ${rows.length})`);

      // Extract municipalities and their stats
      if (rows.length > 1) {
        const headers = rows[0];
        const municipalityIndex = headers.indexOf('municipality');
        const muniStats = {};

        for (let i = 1; i < rows.length; i++) {
          const municipality = rows[i][municipalityIndex] || 'Unknown';
          if (!muniStats[municipality]) {
            muniStats[municipality] = { records: 0 };
          }
          muniStats[municipality].records++;
        }

        const muniList = Object.keys(muniStats).sort();
        setAvailableMunicipalities(muniList);
        setMunicipalityStats(muniStats);

        // Select all by default
        setSelectedMunicipalities(muniList);

        logDebug('Municipality stats:', muniStats);
      } else {
        setAvailableMunicipalities([]);
        setSelectedMunicipalities([]);
        setMunicipalityStats({});
      }

      // Get CSV file size
      const csvPath = getCSVPath();
      logDebug('CSV path:', csvPath);

      let csvSize = 0;
      try {
        const csvInfo = await FileSystem.getInfoAsync(csvPath);
        csvSize = csvInfo.exists ? (csvInfo.size / 1024).toFixed(1) : 0;
        logDebug('CSV file info:', { exists: csvInfo.exists, size: csvInfo.size });
      } catch (csvErr) {
        logDebug('Error getting CSV info:', csvErr.message);
      }

      // Count images and calculate total size
      const imagesDir = getImagesDir();
      logDebug('Images directory:', imagesDir);

      let imageCount = 0;
      let totalImagesSize = 0;

      try {
        const countImages = async (dir) => {
          const dirInfo = await FileSystem.getInfoAsync(dir);
          if (!dirInfo.exists) {
            logDebug('Directory does not exist:', dir);
            return;
          }

          const items = await FileSystem.readDirectoryAsync(dir);
          logDebug(`Found ${items.length} items in ${dir}`);

          for (const item of items) {
            const itemPath = `${dir}${item}`;
            const info = await FileSystem.getInfoAsync(itemPath);
            if (info.isDirectory) {
              await countImages(`${itemPath}/`);
            } else if (item.toLowerCase().endsWith('.jpg') || item.toLowerCase().endsWith('.jpeg')) {
              imageCount++;
              totalImagesSize += info.size || 0;
            }
          }
        };
        await countImages(imagesDir);
        logDebug(`Image count: ${imageCount}, Total size: ${totalImagesSize} bytes`);
      } catch (e) {
        logDebug('Error counting images:', e.message);
      }

      const newStats = {
        records: recordCount,
        images: imageCount,
        csvSize,
        imagesSize: (totalImagesSize / (1024 * 1024)).toFixed(1),
      };

      logDebug('Final stats:', newStats);
      setStats(newStats);
    } catch (error) {
      console.error('[ExportScreen] Error loading stats:', error);
      logDebug('Error details:', { message: error.message, stack: error.stack });
    }
  };

  const exportCSV = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics may not be available on all devices - safe to ignore
    }

    setIsExporting(true);
    try {
      const csvPath = getCSVPath();
      const fileInfo = await FileSystem.getInfoAsync(csvPath);

      if (!fileInfo.exists) {
        Alert.alert('No Data', 'No data to export yet. Capture some photos first.');
        setIsExporting(false);
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(csvPath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export CSV Data',
          UTI: 'public.comma-separated-values-text',
        });
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // Haptics may not be available on all devices - safe to ignore
        }
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export CSV');
      console.error(error);
    }
    setIsExporting(false);
  };

  /**
   * Group CSV records by municipality
   * @param {Array<Array<string>>} rows - Parsed CSV rows (including header)
   * @returns {Object} Records grouped by municipality
   */
  const groupRecordsByMunicipality = (rows) => {
    if (rows.length <= 1) return {};

    const headers = rows[0];
    const municipalityIndex = headers.indexOf('municipality');
    const grouped = {};

    // Skip header row, process data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const municipality = row[municipalityIndex] || 'Unknown';

      if (!grouped[municipality]) {
        grouped[municipality] = [];
      }
      grouped[municipality].push(row);
    }

    logDebug('Grouped records by municipality:', Object.keys(grouped).map(m => `${m}: ${grouped[m].length} records`));
    return grouped;
  };

  /**
   * Build CSV content from rows
   * @param {Array<string>} headers - CSV headers
   * @param {Array<Array<string>>} dataRows - Data rows (without header)
   * @returns {string} CSV content string
   */
  const buildCSVContent = (headers, dataRows) => {
    const csvLines = [headers.join(',')];

    for (const row of dataRows) {
      const csvRow = row.map(val => {
        const strVal = String(val || '');
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(',');
      csvLines.push(csvRow);
    }

    return csvLines.join('\n') + '\n';
  };

  const exportZip = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Haptics may not be available on all devices - safe to ignore
    }

    setIsExportingZip(true);
    setExportProgress(0);
    setExportStatus('Preparing...');

    try {
      const zip = new JSZip();

      // Read and parse CSV
      const csvPath = getCSVPath();
      const csvInfo = await FileSystem.getInfoAsync(csvPath);

      if (!csvInfo.exists) {
        Alert.alert('No Data', 'No data to export yet. Capture some photos first.');
        setIsExportingZip(false);
        return;
      }

      const csvContent = await FileSystem.readAsStringAsync(csvPath);
      const rows = parseCSVContent(csvContent);

      if (rows.length <= 1) {
        Alert.alert('No Data', 'No data to export yet. Capture some photos first.');
        setIsExportingZip(false);
        return;
      }

      const headers = rows[0];
      const imageFilenameIndex = headers.indexOf('image_filename');

      // Group records by municipality
      const allGroupedRecords = groupRecordsByMunicipality(rows);

      // Filter to only selected municipalities
      const groupedRecords = {};
      for (const municipality of selectedMunicipalities) {
        if (allGroupedRecords[municipality]) {
          groupedRecords[municipality] = allGroupedRecords[municipality];
        }
      }

      const municipalities = Object.keys(groupedRecords);

      if (municipalities.length === 0) {
        Alert.alert('No Selection', 'Please select at least one municipality to export.');
        setIsExportingZip(false);
        return;
      }

      logDebug(`Exporting ${municipalities.length} selected municipalities`);
      setExportProgress(5);
      setExportStatus('Building CSVs...');

      // Animate progress bar
      Animated.timing(progressWidth, {
        toValue: 5,
        duration: 200,
        useNativeDriver: false,
      }).start();

      // Create a map of image filenames to their municipality for quick lookup
      const imageToMunicipality = {};
      for (const [municipality, records] of Object.entries(groupedRecords)) {
        for (const record of records) {
          const imageFilename = record[imageFilenameIndex];
          if (imageFilename) {
            imageToMunicipality[imageFilename] = municipality;
          }
        }
      }

      // Add CSV files per municipality (5-15% progress)
      let municipalityProgress = 0;
      for (const municipality of municipalities) {
        const records = groupedRecords[municipality];
        const municipalityCsvContent = buildCSVContent(headers, records);

        // Create municipality folder and add CSV
        const municipalityFolder = zip.folder(municipality);
        municipalityFolder.file('agricapture_data.csv', municipalityCsvContent);

        municipalityProgress++;
        const progress = 5 + (municipalityProgress / municipalities.length) * 10;
        setExportProgress(Math.round(progress));

        Animated.timing(progressWidth, {
          toValue: progress,
          duration: 100,
          useNativeDriver: false,
        }).start();
      }

      logDebug('CSV files created for all municipalities');

      // RAM-efficient image processing: process one image at a time
      // This allows GC to free memory between reads instead of holding all images in memory
      setExportStatus('Adding images...');

      const imagesDir = getImagesDir();
      let totalImages = 0;
      let processedImages = 0;

      // First pass: count images (without loading them)
      const countImagesRecursive = async (dir) => {
        let count = 0;
        try {
          const dirInfo = await FileSystem.getInfoAsync(dir);
          if (!dirInfo.exists) return 0;

          const items = await FileSystem.readDirectoryAsync(dir);
          for (const item of items) {
            const itemPath = `${dir}${item}`;
            const info = await FileSystem.getInfoAsync(itemPath);
            if (info.isDirectory) {
              count += await countImagesRecursive(`${itemPath}/`);
            } else if (item.toLowerCase().endsWith('.jpg') || item.toLowerCase().endsWith('.jpeg')) {
              count++;
            }
          }
        } catch (e) {
          logDebug('Error counting images:', e.message);
        }
        return count;
      };

      totalImages = await countImagesRecursive(imagesDir);
      logDebug(`Found ${totalImages} images to process (RAM-efficient mode)`);

      // Second pass: process images one at a time (RAM-efficient)
      const processImagesRecursive = async (dir, baseDir) => {
        try {
          const dirInfo = await FileSystem.getInfoAsync(dir);
          if (!dirInfo.exists) return;

          const items = await FileSystem.readDirectoryAsync(dir);
          for (const item of items) {
            const itemPath = `${dir}${item}`;
            const info = await FileSystem.getInfoAsync(itemPath);

            if (info.isDirectory) {
              await processImagesRecursive(`${itemPath}/`, baseDir);
            } else if (item.toLowerCase().endsWith('.jpg') || item.toLowerCase().endsWith('.jpeg')) {
              // Get relative path from images directory
              const relativePath = itemPath.replace(baseDir, '');

              // Find which municipality this image belongs to
              const municipality = imageToMunicipality[relativePath] || imageToMunicipality[item] || 'Unknown';

              // Skip if municipality not in selection
              if (!selectedMunicipalities.includes(municipality)) {
                processedImages++;
                continue;
              }

              // Read image as base64 (one at a time - allows GC to free memory)
              const imageData = await FileSystem.readAsStringAsync(itemPath, {
                encoding: FileSystem.EncodingType.Base64,
              });

              // Add to zip under municipality folder
              const municipalityFolder = zip.folder(municipality);
              const imagesFolder = municipalityFolder.folder('images');
              imagesFolder.file(relativePath, imageData, { base64: true });

              // Update progress (15-90% for images)
              processedImages++;
              const progress = 15 + (processedImages / totalImages) * 75;
              setExportProgress(Math.round(progress));
              setExportStatus(`Adding images... ${processedImages}/${totalImages}`);

              Animated.timing(progressWidth, {
                toValue: progress,
                duration: 100,
                useNativeDriver: false,
              }).start();

              // imageData goes out of scope here, eligible for GC
            }
          }
        } catch (error) {
          logDebug('Error processing images:', error.message);
        }
      };

      if (totalImages > 0) {
        await processImagesRecursive(imagesDir, imagesDir);
      }

      setExportProgress(95);
      setExportStatus('Creating ZIP...');
      Animated.timing(progressWidth, {
        toValue: 95,
        duration: 100,
        useNativeDriver: false,
      }).start();

      // Generate ZIP file with compression (streamFiles for better memory usage)
      logDebug('Generating ZIP file...');
      const zipFileContent = await zip.generateAsync({
        type: 'base64',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // Create timestamp for filename
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

      // Write ZIP file
      const zipPath = `${FileSystem.cacheDirectory}AgriCapture_${timestamp}.zip`;
      await FileSystem.writeAsStringAsync(zipPath, zipFileContent, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Verify ZIP file was created successfully
      const zipFileInfo = await FileSystem.getInfoAsync(zipPath);
      if (!zipFileInfo.exists || zipFileInfo.size === 0) {
        throw new Error('Failed to create ZIP file - file is empty or does not exist');
      }
      logDebug('ZIP file created successfully', { path: zipPath, size: zipFileInfo.size, municipalities: municipalities.length });

      setExportProgress(100);
      setExportStatus('Complete!');
      Animated.timing(progressWidth, {
        toValue: 100,
        duration: 200,
        useNativeDriver: false,
      }).start();

      // Share the ZIP file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // Haptics may not be available on all devices - safe to ignore
        }

        await Sharing.shareAsync(zipPath, {
          mimeType: 'application/zip',
          dialogTitle: 'Export to Google Drive',
          UTI: 'public.zip-archive',
        });
        logDebug('ZIP file shared successfully');
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }

      // Clean up cache file after export
      try {
        await FileSystem.deleteAsync(zipPath, { idempotent: true });
      } catch {
        // Safe to ignore cleanup errors
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create ZIP file: ' + error.message);
      console.error(error);
    }

    setIsExportingZip(false);
    setExportProgress(0);
    setExportStatus('');
    progressWidth.setValue(0);
  };

  const clearAllData = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Haptics may not be available on all devices - safe to ignore
    }

    Alert.alert(
      'Clear All Data',
      'This will permanently delete all captured data and images. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: performClearData,
        },
      ]
    );
  };

  const performClearData = async () => {
    try {
      const csvPath = getCSVPath();
      const imagesDir = getImagesDir();

      // Delete CSV
      await FileSystem.deleteAsync(csvPath, { idempotent: true });

      // Delete images directory
      await FileSystem.deleteAsync(imagesDir, { idempotent: true });

      // Reload stats
      await loadStats();

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Haptics may not be available on all devices - safe to ignore
      }

      Alert.alert('Success', 'All data has been cleared');
    } catch (error) {
      Alert.alert('Error', 'Failed to clear data');
      console.error(error);
    }
  };

  const progressInterpolate = progressWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  // Toggle a single municipality selection
  const toggleMunicipality = (municipality) => {
    setSelectedMunicipalities(prev => {
      if (prev.includes(municipality)) {
        return prev.filter(m => m !== municipality);
      }
      return [...prev, municipality];
    });
  };

  // Select or deselect all municipalities
  const toggleAllMunicipalities = () => {
    if (selectedMunicipalities.length === availableMunicipalities.length) {
      setSelectedMunicipalities([]);
    } else {
      setSelectedMunicipalities([...availableMunicipalities]);
    }
  };

  // Calculate selected stats
  const selectedRecordCount = selectedMunicipalities.reduce((sum, m) => sum + (municipalityStats[m]?.records || 0), 0);

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Export</Text>
        <Text style={styles.headerSubtitle}>Backup and share your data</Text>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: contentSlide }],
          }}
        >
          {/* Stats */}
          <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Data Summary</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.records}</Text>
              <Text style={styles.statLabel}>Records</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.images}</Text>
              <Text style={styles.statLabel}>Images</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.csvSize}</Text>
              <Text style={styles.statLabel}>KB (CSV)</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.imagesSize}</Text>
              <Text style={styles.statLabel}>MB (Images)</Text>
            </View>
          </View>
          {/* SAF Status Indicator */}
          {Platform.OS === 'android' && (
            <View style={[styles.safStatus, safEnabled ? styles.safEnabled : styles.safDisabled]}>
              <Ionicons
                name={safEnabled ? 'folder-open' : 'folder-outline'}
                size={16}
                color={safEnabled ? colors.primary : colors.text.tertiary}
              />
              <View style={styles.safStatusContent}>
                <Text style={[styles.safStatusText, safEnabled && styles.safStatusTextEnabled]}>
                  {safEnabled
                    ? 'Public Storage Enabled'
                    : 'Internal Storage Only'}
                </Text>
                {safEnabled && storagePath ? (
                  <Text style={styles.safPathText} numberOfLines={1}>
                    {storagePath}
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        </View>

        {/* Municipality Selection */}
        {availableMunicipalities.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionTitle}>Select Municipalities</Text>
            </View>
            <Text style={styles.sectionDescription}>
              Choose which municipalities to include in the export. Each will have its own folder with CSV and images.
            </Text>

            {/* Select All Toggle */}
            <TouchableOpacity
              style={styles.selectAllRow}
              onPress={toggleAllMunicipalities}
            >
              <View style={[
                styles.checkbox,
                selectedMunicipalities.length === availableMunicipalities.length && styles.checkboxSelected
              ]}>
                {selectedMunicipalities.length === availableMunicipalities.length && (
                  <Ionicons name="checkmark" size={14} color={colors.text.inverse} />
                )}
              </View>
              <Text style={styles.selectAllText}>
                {selectedMunicipalities.length === availableMunicipalities.length ? 'Deselect All' : 'Select All'}
              </Text>
              <Text style={styles.selectedCount}>
                {selectedMunicipalities.length}/{availableMunicipalities.length} selected
              </Text>
            </TouchableOpacity>

            {/* Municipality List */}
            <View style={styles.municipalityList}>
              {availableMunicipalities.map((municipality) => (
                <TouchableOpacity
                  key={municipality}
                  style={styles.municipalityItem}
                  onPress={() => toggleMunicipality(municipality)}
                >
                  <View style={[
                    styles.checkbox,
                    selectedMunicipalities.includes(municipality) && styles.checkboxSelected
                  ]}>
                    {selectedMunicipalities.includes(municipality) && (
                      <Ionicons name="checkmark" size={14} color={colors.text.inverse} />
                    )}
                  </View>
                  <Text style={styles.municipalityName}>{municipality}</Text>
                  <Text style={styles.municipalityRecords}>
                    {municipalityStats[municipality]?.records || 0} records
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Google Drive Export */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Export to Google Drive</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Create a ZIP file organized by municipality, each with its own CSV and images folder.
          </Text>

          <TouchableOpacity
            style={[
              styles.exportButton,
              styles.zipButton,
              (isExportingZip || selectedMunicipalities.length === 0) && styles.disabled,
            ]}
            onPress={exportZip}
            disabled={isExportingZip || selectedMunicipalities.length === 0}
          >
            {isExportingZip ? (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <Animated.View
                    style={[
                      styles.progressFill,
                      { width: progressInterpolate },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {exportStatus || `${exportProgress}%`}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.iconCircle}>
                  <Ionicons name="archive-outline" size={24} color={colors.text.inverse} />
                </View>
                <View style={styles.exportTextContainer}>
                  <Text style={styles.exportButtonText}>
                    Export Selected ({selectedMunicipalities.length})
                  </Text>
                  <Text style={styles.exportSubtext}>
                    {selectedRecordCount} records from {selectedMunicipalities.length} municipalities
                  </Text>
                </View>
                <Ionicons name="share-outline" size={22} color={colors.text.inverse} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* CSV Only Export */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text-outline" size={22} color={colors.secondary} />
            <Text style={styles.sectionTitle}>Export CSV Only</Text>
          </View>

          <TouchableOpacity
            style={[styles.exportButton, styles.csvButton, (isExporting || stats.records === 0) && styles.disabled]}
            onPress={exportCSV}
            disabled={isExporting || stats.records === 0}
          >
            {isExporting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="document-outline" size={24} color={colors.text.inverse} />
                </View>
                <View style={styles.exportTextContainer}>
                  <Text style={styles.exportButtonText}>Export CSV</Text>
                  <Text style={styles.exportSubtext}>Data only ({stats.csvSize} KB)</Text>
                </View>
                <Ionicons name="share-outline" size={22} color={colors.text.inverse} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* CSV Location Info */}
        <View style={styles.pathBox}>
          <Ionicons name="folder-outline" size={18} color={colors.text.secondary} />
          <View style={styles.pathContent}>
            <Text style={styles.pathLabel}>CSV Location:</Text>
            <Text style={styles.pathText} numberOfLines={2}>
              AgriCapture/data/agricapture_collections.csv
            </Text>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.tipBox}>
          <Ionicons name="bulb-outline" size={20} color={colors.warning} />
          <Text style={styles.tipText}>
            After exporting, select "Google Drive" from the share menu to upload your data for backup and sharing.
          </Text>
        </View>

        {/* Danger Zone */}
        <View style={styles.dangerSection}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={[styles.clearButton, stats.records === 0 && styles.disabledClear]}
            onPress={clearAllData}
            disabled={stats.records === 0}
          >
            <Ionicons name="trash-outline" size={18} color="#c62828" />
            <Text style={styles.clearButtonText}> Clear All Data</Text>
          </TouchableOpacity>
          <Text style={styles.dangerHint}>
            Export your data first before clearing
          </Text>
        </View>

        <View style={{ height: layout.contentPaddingBottom }} />
      </Animated.View>
      </ScrollView>
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
  statsCard: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  statsTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxl,
    color: colors.primary,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
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
    fontSize: fontSizes.md,
    color: colors.text.primary,
  },
  sectionDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    ...shadows.md,
  },
  zipButton: {
    backgroundColor: colors.primary,
  },
  csvButton: {
    backgroundColor: colors.secondary,
  },
  disabled: {
    opacity: 0.5,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  exportTextContainer: {
    flex: 1,
  },
  exportButtonText: {
    fontFamily: fonts.semiBold,
    color: colors.text.inverse,
    fontSize: fontSizes.md,
  },
  exportSubtext: {
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.8)',
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  progressContainer: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.text.inverse,
    borderRadius: radius.sm,
  },
  progressText: {
    fontFamily: fonts.medium,
    color: colors.text.inverse,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  pathBox: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pathContent: {
    flex: 1,
  },
  pathLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  pathText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
  },
  tipBox: {
    flexDirection: 'row',
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
    lineHeight: 20,
  },
  dangerSection: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.errorLight,
    ...shadows.sm,
  },
  dangerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.error,
    marginBottom: spacing.md,
  },
  clearButton: {
    flexDirection: 'row',
    backgroundColor: colors.errorLight,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  disabledClear: {
    opacity: 0.5,
  },
  clearButtonText: {
    fontFamily: fonts.semiBold,
    color: colors.error,
    fontSize: fontSizes.base,
  },
  dangerHint: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // Municipality selection styles
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  selectAllText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  selectedCount: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  municipalityList: {
    gap: spacing.xs,
  },
  municipalityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
  },
  municipalityName: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  municipalityRecords: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  // SAF status styles
  safStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  safEnabled: {
    // Additional styling for enabled state if needed
  },
  safDisabled: {
    opacity: 0.7,
  },
  safStatusText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
  },
  safStatusTextEnabled: {
    color: colors.primary,
  },
  safStatusContent: {
    flex: 1,
  },
  safPathText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
