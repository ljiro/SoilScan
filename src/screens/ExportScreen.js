import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import JSZip from 'jszip';
import { getCSVPathAsync, readCSV, parseCSVContent, parseCSVToRecords, getCSVHeaders } from '../services/csvService';
import * as FileSystem from 'expo-file-system/legacy';
import { getImagesDirAsync, getAppRootDirAsync, loadConfig, ensureDir, getInfoStorage, readFileStorage, writeFileStorage, listDirStorage, deleteFileStorage } from '../services/storageService';
import { writeZipWithChunkedFallback } from '../utils/zipChunkedWrite';
import { fonts, fontSizes, colors, radius, spacing, shadows, layout } from '../constants/theme';
import ExportRecordSelector from '../components/ExportRecordSelector';
import ExportRecordsList from '../components/ExportRecordsList';

const MAX_GROUPS_SELECTABLE = 20;
const YIELD_MS = 50;

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

const yieldToUI = () => new Promise((r) => setTimeout(r, YIELD_MS));

/**
 * Build location groups from records, matching ReviewScreen organization:
 * Group by spot_number + municipality + barangay. Title = "1/La Trinidad/Balili".
 */
function buildLocationGroups(records) {
  const map = new Map();
  records.forEach((record) => {
    const spot = record.spot_number?.toString()?.trim() || 'Unassigned';
    const municipality = (record.municipality || '').trim();
    const barangay = (record.barangay || '').trim();
    const key = `${spot}|${municipality}|${barangay}`;
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
    if (!map.has(key)) {
      map.set(key, { key, title, spot, municipality, barangay, records: [] });
    }
    map.get(key).records.push(record);
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.spot === 'Unassigned') return 1;
    if (b.spot === 'Unassigned') return -1;
    const spotA = parseInt(a.spot, 10) || 0;
    const spotB = parseInt(b.spot, 10) || 0;
    return spotA - spotB || (a.title || '').localeCompare(b.title || '');
  });
}

export default function ExportScreen({ navigation }) {
  const [stats, setStats] = useState({ records: 0, images: 0, csvSize: 0, imagesSize: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [organizerInfo, setOrganizerInfo] = useState(null);
  const [records, setRecords] = useState([]);
  const [selectedGroupKeys, setSelectedGroupKeys] = useState(new Set());
  const [zipProgress, setZipProgress] = useState(null);
  const [recordsLoaded, setRecordsLoaded] = useState(false);

  const groups = React.useMemo(() => buildLocationGroups(records), [records]);
  const selectedRecords = React.useMemo(
    () => groups.filter((g) => selectedGroupKeys.has(g.key)).flatMap((g) => g.records),
    [groups, selectedGroupKeys]
  );
  const selectedRecordCount = selectedRecords.length;

  // Animation values
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadStats();
    loadOrganizerInfo();
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
      loadOrganizerInfo();
      loadRecords();
    });
    return unsubscribe;
  }, [navigation]);

  const loadRecords = useCallback(async () => {
    try {
      setRecordsLoaded(false);
      const csvContent = await readCSV();
      const list = parseCSVToRecords(csvContent);
      setRecords(list);
      setSelectedGroupKeys(new Set());
    } catch (error) {
      console.error('[ExportScreen] Error loading records:', error);
      setRecords([]);
    }
    setRecordsLoaded(true);
  }, []);

  const resolveImagePath = useCallback(async (imageFilename) => {
    if (!imageFilename || !imageFilename.trim()) return null;
    const clean = imageFilename.trim().replace(/^["']|["']$/g, '');
    if (clean.startsWith('file://') || clean.startsWith('/')) return clean;
    const appRoot = await getAppRootDirAsync();
    const path = clean.startsWith('images/') ? `${appRoot}${clean}` : `${appRoot}images/${clean}`;
    return path;
  }, []);

  const toggleGroup = useCallback((groupKey) => {
    setSelectedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else if (next.size < MAX_GROUPS_SELECTABLE) next.add(groupKey);
      return next;
    });
  }, []);

  const selectAllGroups = useCallback(() => {
    const keys = new Set(groups.slice(0, MAX_GROUPS_SELECTABLE).map((g) => g.key));
    setSelectedGroupKeys(keys);
  }, [groups]);

  const clearSelection = useCallback(() => setSelectedGroupKeys(new Set()), []);

  const buildCsvSubset = useCallback((headers, selectedRecords) => {
    const escape = (v) => {
      if (v == null || v === undefined) return '';
      v = String(v).replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ');
      if (v.includes(',') || v.includes('"')) v = `"${v.replace(/"/g, '""')}"`;
      return v;
    };
    const headerLine = headers.join(',');
    const rows = selectedRecords.map((r) => headers.map((h) => escape(r[h])).join(','));
    return [headerLine, ...rows].join('\n');
  }, []);

  const exportZIP = useCallback(async () => {
    if (selectedRecordCount === 0) {
      Alert.alert('No selection', 'Select at least one location (e.g. 1/La Trinidad/Balili) to export its records and images.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
    setIsExporting(true);
    setZipProgress({ current: 0, total: selectedRecordCount, phase: 'Preparing...' });
    await yieldToUI();

    try {
      const headers = getCSVHeaders();
      const csvSubset = buildCsvSubset(headers, selectedRecords);

      const zip = new JSZip();
      zip.file('agricapture_collections.csv', csvSubset);

      const appRoot = await getAppRootDirAsync();
      const exportsDir = `${appRoot}exports/`;
      await ensureDir(exportsDir);

      let done = 0;
      for (let i = 0; i < selectedRecords.length; i++) {
        setZipProgress({ current: i + 1, total: selectedRecords.length, phase: 'Adding images...' });
        await yieldToUI();
        const record = selectedRecords[i];
        const fn = record.image_filename;
        if (!fn || !fn.trim()) {
          done++;
          continue;
        }
        const path = await resolveImagePath(fn);
        if (!path) {
          done++;
          continue;
        }
        try {
          const info = await getInfoStorage(path);
          if (!info.exists) {
            done++;
            continue;
          }
          const base64 = await readFileStorage(path, { encoding: 'base64' });
          const baseName = fn.replace(/^.*[/\\]/, '') || `image_${record.uuid || i}.jpg`;
          zip.file(baseName, base64, { base64: true });
        } catch (_) {
          // Skip missing or unreadable image
        }
        done++;
      }

      const fileName = `SoilScan_export_${new Date().toISOString().slice(0, 10)}.zip`;
      const outPath = await writeZipWithChunkedFallback(
        fileName,
        zip,
        FileSystem.cacheDirectory,
        (phase) => setZipProgress((p) => (p ? { ...p, phase } : null))
      );

      setZipProgress(null);
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(outPath, {
          mimeType: 'application/zip',
          dialogTitle: 'Export ZIP',
        });
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (_) {}
      } else {
        Alert.alert('Export saved', `ZIP saved: ${fileName}`);
      }
    } catch (error) {
      console.error('[ExportScreen] ZIP export error:', error);
      Alert.alert('Export failed', error.message || 'Could not create ZIP.');
    } finally {
      setIsExporting(false);
      setZipProgress(null);
    }
  }, [selectedRecords, selectedRecordCount, resolveImagePath, buildCsvSubset]);

  const loadOrganizerInfo = async () => {
    try {
      const config = await loadConfig('user_config');
      if (config) {
        setOrganizerInfo({
          municipality: config.municipalityLabel || 'Not set',
          barangay: config.barangayLabel || 'Not set',
          farm: config.farmName || 'No farm name',
          crops: config.selectedCropLabels || [],
        });
      }
    } catch (error) {
      console.error('[ExportScreen] Error loading organizer info:', error);
    }
  };

  const loadStats = async () => {
    try {
      logDebug('Loading export stats...');

      // Count CSV records using proper parser (handles newlines in quoted fields)
      const csvContent = await readCSV();
      const rows = parseCSVContent(csvContent);

      // Count data rows (exclude header row)
      const recordCount = Math.max(0, rows.length - 1);

      logDebug(`CSV record count: ${recordCount} (total rows: ${rows.length})`);

      // Get CSV file size (async path so external storage is included)
      const csvPath = await getCSVPathAsync();
      logDebug('CSV path:', csvPath);

      let csvSize = 0;
      try {
        const csvInfo = await getInfoStorage(csvPath);
        csvSize = csvInfo.exists ? (csvInfo.size / 1024).toFixed(1) : 0;
        logDebug('CSV file info:', { exists: csvInfo.exists, size: csvInfo.size });
      } catch (csvErr) {
        logDebug('Error getting CSV info:', csvErr.message);
      }

      // Count images and calculate total size (async path for external storage)
      const imagesDir = await getImagesDirAsync();
      logDebug('Images directory:', imagesDir);

      let imageCount = 0;
      let totalImagesSize = 0;

      try {
        const countImages = async (dir) => {
          const dirInfo = await getInfoStorage(dir);
          if (!dirInfo.exists) {
            logDebug('Directory does not exist:', dir);
            return;
          }

          const items = await listDirStorage(dir);
          logDebug(`Found ${items.length} items in ${dir}`);

          for (const item of items) {
            const itemPath = item.type === 'directory' ? item.uri + '/' : item.uri;
            if (item.type === 'directory') {
              await countImages(itemPath);
            } else if (item.name.toLowerCase().endsWith('.jpg') || item.name.toLowerCase().endsWith('.jpeg')) {
              imageCount++;
              totalImagesSize += item.size || 0;
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
      const csvPath = await getCSVPathAsync();
      const fileInfo = await getInfoStorage(csvPath);

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

  // ZIP export removed - images are now automatically organized in directories
  // Users can access images directly from the organized folder structure

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
      const csvPath = await getCSVPathAsync();
      const imagesDir = await getImagesDirAsync();

      // Delete CSV
      await deleteFileStorage(csvPath);

      // Delete images directory
      await deleteFileStorage(imagesDir);

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

  // Progress bar removed - no longer needed without ZIP export

  const listHeader = (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: contentOpacity,
          transform: [{ translateY: contentSlide }],
        },
      ]}
    >
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
      </View>

      <ExportRecordSelector
        maxSelectable={MAX_GROUPS_SELECTABLE}
        recordsLoaded={recordsLoaded}
        groups={groups}
        selectedGroupKeys={selectedGroupKeys}
        selectedRecordCount={selectedRecordCount}
        onSelectAll={selectAllGroups}
        onClear={clearSelection}
      />
    </Animated.View>
  );

  const listFooter = (
    <View style={styles.container}>
      {groups.length > 0 && (
        <TouchableOpacity
          style={[
            styles.exportButton,
            styles.zipButton,
            (isExporting || selectedRecordCount === 0) && styles.disabled,
          ]}
          onPress={exportZIP}
          disabled={isExporting || selectedRecordCount === 0}
        >
          {zipProgress ? (
            <>
              <ActivityIndicator color="#fff" size="small" />
              <View style={styles.exportTextContainer}>
                <Text style={styles.exportButtonText}>{zipProgress.phase}</Text>
                <Text style={styles.exportSubtext}>
                  {zipProgress.current} / {zipProgress.total}
                </Text>
              </View>
            </>
          ) : isExporting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="archive-outline" size={24} color={colors.text.inverse} />
              </View>
              <View style={styles.exportTextContainer}>
                <Text style={styles.exportButtonText}>Export selected as ZIP</Text>
                <Text style={styles.exportSubtext}>
                  {selectedRecordCount} record(s) · images + CSV
                </Text>
              </View>
              <Ionicons name="share-outline" size={22} color={colors.text.inverse} />
            </>
          )}
        </TouchableOpacity>
      )}

      <View style={[styles.section, styles.sectionFirst]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="folder-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Image Organization</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Images are automatically organized in directories based on your setup labels. No export needed - images are stored directly on your device.
          </Text>

          {organizerInfo && (
            <View style={styles.organizerInfo}>
              <View style={styles.organizerRow}>
                <Ionicons name="location-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.organizerLabel}>Location:</Text>
                <Text style={styles.organizerValue}>
                  {organizerInfo.municipality} / {organizerInfo.barangay}
                </Text>
              </View>
              <View style={styles.organizerRow}>
                <Ionicons name="home-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.organizerLabel}>Farm:</Text>
                <Text style={styles.organizerValue}>{organizerInfo.farm}</Text>
              </View>
              <View style={styles.organizerRow}>
                <Ionicons name="leaf-outline" size={16} color={colors.text.secondary} />
                <Text style={styles.organizerLabel}>Crops:</Text>
                <Text style={styles.organizerValue}>
                  {organizerInfo.crops.length > 0 
                    ? organizerInfo.crops.join(', ') 
                    : 'No crops selected'}
                </Text>
              </View>
              <View style={styles.directoryPathBox}>
                <Text style={styles.directoryPathLabel}>Directory Structure:</Text>
                <Text style={styles.directoryPathText}>
                  images/{'\n'}
                  {'  '}└─ {organizerInfo.municipality.toLowerCase().replace(/\s+/g, '_')}/{'\n'}
                  {'      '}└─ {organizerInfo.barangay.toLowerCase().replace(/\s+/g, '_')}/{'\n'}
                  {'          '}└─ {organizerInfo.farm.toLowerCase().replace(/\s+/g, '_')}/{'\n'}
                  {'              '}└─ [crop_name]/
                </Text>
              </View>
            </View>
          )}
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
            Images are automatically saved to organized directories when you capture them. The entire image collection is stored on your device's storage (not in RAM), organized by your setup labels.
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
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Export</Text>
        <Text style={styles.headerSubtitle}>Backup and share your data</Text>
      </View>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {listHeader}
        <ExportRecordsList
          groups={groups}
          selectedGroupKeys={selectedGroupKeys}
          maxSelectable={MAX_GROUPS_SELECTABLE}
          onToggleGroup={toggleGroup}
        />
        {listFooter}
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
  scrollArea: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: layout.contentPaddingBottom,
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
  sectionFirst: {
    marginTop: spacing.lg,
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
  organizerInfo: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  organizerLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    minWidth: 60,
  },
  organizerValue: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
    flex: 1,
  },
  directoryPathBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  directoryPathLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  directoryPathText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
    fontFamily: 'monospace',
    lineHeight: 18,
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
});
