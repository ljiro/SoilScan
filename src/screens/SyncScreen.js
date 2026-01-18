import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { getCSVPath, readCSV, parseCSVContent } from '../services/csvService';
import { loadConfig } from '../services/storageService';

// Helper to sanitize names for filenames
const sanitizeName = (name) => {
  if (!name) return '';
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30);
};

// Base directories
const getImagesDir = () => `${FileSystem.documentDirectory}AgriCapture/images/`;

const SyncScreen = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [stats, setStats] = useState({ totalRecords: 0, totalImages: 0, imageFiles: [] });
  const [exportProgress, setExportProgress] = useState(null);
  const [userConfig, setUserConfig] = useState(null);

  useEffect(() => {
    loadStats();
    loadUserConfig();
  }, []);

  const loadUserConfig = async () => {
    try {
      const config = await loadConfig('user_config');
      setUserConfig(config);
    } catch (e) {
      console.log('[Sync] Failed to load user config:', e.message);
    }
  };

  // Scan for all images recursively
  const scanImages = async (dir) => {
    const files = [];
    try {
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) return files;

      const items = await FileSystem.readDirectoryAsync(dir);
      for (const item of items) {
        const path = `${dir}${item}`;
        const info = await FileSystem.getInfoAsync(path);
        if (info.isDirectory) {
          const subFiles = await scanImages(`${path}/`);
          files.push(...subFiles);
        } else if (/\.(jpg|jpeg|png)$/i.test(item)) {
          files.push(path);
        }
      }
    } catch (e) {
      console.log('[Sync] Scan error:', e.message);
    }
    return files;
  };

  const loadStats = async () => {
    try {
      const csvContent = await readCSV();
      const rows = parseCSVContent(csvContent);
      const totalRecords = Math.max(0, rows.length - 1);

      const imageFiles = await scanImages(getImagesDir());

      setStats({ totalRecords, totalImages: imageFiles.length, imageFiles });
      console.log('[Sync] Stats loaded:', totalRecords, 'records,', imageFiles.length, 'images');
    } catch (error) {
      console.log('[Sync] Load stats error:', error.message);
    }
    setIsLoading(false);
  };

  // Simple export function - creates ZIP and shares it
  const exportAll = async () => {
    setIsExporting(true);
    setExportProgress('Starting export...');
    console.log('[Sync] exportAll started');

    try {
      // Debug: Check what's available
      console.log('[Sync] Sharing module:', typeof Sharing);
      console.log('[Sync] Sharing.isAvailableAsync:', typeof Sharing.isAvailableAsync);
      console.log('[Sync] Sharing.shareAsync:', typeof Sharing.shareAsync);
      console.log('[Sync] FileSystem module:', typeof FileSystem);
      console.log('[Sync] FileSystem.getInfoAsync:', typeof FileSystem.getInfoAsync);
      console.log('[Sync] FileSystem.readAsStringAsync:', typeof FileSystem.readAsStringAsync);
      console.log('[Sync] FileSystem.writeAsStringAsync:', typeof FileSystem.writeAsStringAsync);
      console.log('[Sync] FileSystem.EncodingType:', FileSystem.EncodingType);
      console.log('[Sync] JSZip:', typeof JSZip);

      // Check sharing availability
      console.log('[Sync] Step 1: Checking sharing availability...');
      const canShare = await Sharing.isAvailableAsync();
      console.log('[Sync] canShare:', canShare);
      if (!canShare) {
        Alert.alert('Error', 'Sharing not available on this device');
        setIsExporting(false);
        setExportProgress(null);
        return;
      }

      console.log('[Sync] Step 2: Creating JSZip instance...');
      const zip = new JSZip();
      console.log('[Sync] zip created:', typeof zip);
      let fileCount = 0;

      // Add CSV
      setExportProgress('Adding CSV data...');
      const csvPath = getCSVPath();
      console.log('[Sync] Step 3: Adding CSV from:', csvPath);
      try {
        const csvInfo = await FileSystem.getInfoAsync(csvPath);
        console.log('[Sync] CSV info:', csvInfo);
        if (csvInfo.exists) {
          const csvData = await FileSystem.readAsStringAsync(csvPath);
          console.log('[Sync] CSV data length:', csvData.length);
          zip.file('agricapture_data.csv', csvData);
          fileCount++;
          console.log('[Sync] CSV added');
        }
      } catch (e) {
        console.log('[Sync] CSV error:', e.message);
      }

      // Add images
      const baseDir = getImagesDir();
      console.log('[Sync] Step 4: Adding images from:', baseDir);
      console.log('[Sync] Image count:', stats.imageFiles.length);
      for (let i = 0; i < stats.imageFiles.length; i++) {
        const imgPath = stats.imageFiles[i];
        setExportProgress(`Adding image ${i + 1}/${stats.imageFiles.length}...`);
        console.log('[Sync] Adding image:', imgPath);

        try {
          const imgData = await FileSystem.readAsStringAsync(imgPath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log('[Sync] Image data length:', imgData.length);
          // Use relative path to preserve folder structure
          const relPath = imgPath.replace(baseDir, '');
          console.log('[Sync] Relative path:', relPath);
          zip.file(`images/${relPath}`, imgData, { base64: true });
          fileCount++;
          console.log('[Sync] Image added, count:', fileCount);
        } catch (e) {
          console.log('[Sync] Image error:', imgPath, e.message);
        }
      }

      if (fileCount === 0) {
        Alert.alert('No Data', 'No files to export. Capture some data first.');
        setIsExporting(false);
        setExportProgress(null);
        return;
      }

      // Generate ZIP
      console.log('[Sync] Step 5: Generating ZIP...');
      console.log('[Sync] zip.generateAsync:', typeof zip.generateAsync);
      setExportProgress('Creating ZIP file...');
      const zipBase64 = await zip.generateAsync({ type: 'base64' });
      console.log('[Sync] ZIP base64 length:', zipBase64.length);

      // Generate filename with location and timestamp
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');

      let zipFilename;
      if (userConfig?.municipalityLabel && userConfig?.barangayLabel) {
        const muni = sanitizeName(userConfig.municipalityLabel);
        const brgy = sanitizeName(userConfig.barangayLabel);
        zipFilename = `${muni}_${brgy}_${dateStr}_${timeStr}.zip`;
      } else {
        zipFilename = `AgriCapture_${dateStr}_${timeStr}.zip`;
      }

      const zipPath = `${FileSystem.cacheDirectory}${zipFilename}`;
      console.log('[Sync] Step 6: Writing ZIP to:', zipPath);
      console.log('[Sync] cacheDirectory:', FileSystem.cacheDirectory);

      await FileSystem.writeAsStringAsync(zipPath, zipBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log('[Sync] ZIP written');

      // Verify file
      console.log('[Sync] Step 7: Verifying ZIP...');
      const zipInfo = await FileSystem.getInfoAsync(zipPath);
      console.log('[Sync] ZIP created:', zipPath, 'size:', zipInfo.size);

      if (!zipInfo.exists || zipInfo.size < 100) {
        throw new Error('ZIP file creation failed');
      }

      // Share
      console.log('[Sync] Step 8: Sharing...');
      setExportProgress('Opening share dialog...');
      await Sharing.shareAsync(zipPath, {
        mimeType: 'application/zip',
        dialogTitle: 'Export AgriCapture Data',
      });

      console.log('[Sync] Share dialog closed');

    } catch (error) {
      console.log('[Sync] Export error:', error);
      console.log('[Sync] Error name:', error.name);
      console.log('[Sync] Error message:', error.message);
      console.log('[Sync] Error stack:', error.stack);
      Alert.alert('Export Failed', error.message);
    }

    setIsExporting(false);
    setExportProgress(null);
  };

  // Export just CSV
  const exportCSV = async () => {
    setIsExporting(true);
    setExportProgress('Preparing CSV...');

    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Error', 'Sharing not available');
        setIsExporting(false);
        setExportProgress(null);
        return;
      }

      const csvPath = getCSVPath();
      const csvInfo = await FileSystem.getInfoAsync(csvPath);

      if (!csvInfo.exists) {
        Alert.alert('No Data', 'No CSV file found');
        setIsExporting(false);
        setExportProgress(null);
        return;
      }

      await Sharing.shareAsync(csvPath, {
        mimeType: 'text/csv',
        dialogTitle: 'Export CSV Data',
      });

    } catch (error) {
      Alert.alert('Error', error.message);
    }

    setIsExporting(false);
    setExportProgress(null);
  };

  // Export just images as ZIP
  const exportImages = async () => {
    setIsExporting(true);
    setExportProgress('Preparing images...');

    try {
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Error', 'Sharing not available');
        setIsExporting(false);
        setExportProgress(null);
        return;
      }

      if (stats.imageFiles.length === 0) {
        Alert.alert('No Images', 'No images found to export');
        setIsExporting(false);
        setExportProgress(null);
        return;
      }

      const zip = new JSZip();
      const baseDir = getImagesDir();

      for (let i = 0; i < stats.imageFiles.length; i++) {
        const imgPath = stats.imageFiles[i];
        setExportProgress(`Adding image ${i + 1}/${stats.imageFiles.length}...`);

        try {
          const imgData = await FileSystem.readAsStringAsync(imgPath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const relPath = imgPath.replace(baseDir, '');
          zip.file(relPath, imgData, { base64: true });
        } catch (e) {
          console.log('[Sync] Image error:', e.message);
        }
      }

      setExportProgress('Creating ZIP...');
      const zipBase64 = await zip.generateAsync({ type: 'base64' });

      // Generate filename with location and timestamp
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');

      let zipFilename;
      if (userConfig?.municipalityLabel && userConfig?.barangayLabel) {
        const muni = sanitizeName(userConfig.municipalityLabel);
        const brgy = sanitizeName(userConfig.barangayLabel);
        zipFilename = `${muni}_${brgy}_images_${dateStr}_${timeStr}.zip`;
      } else {
        zipFilename = `AgriCapture_images_${dateStr}_${timeStr}.zip`;
      }

      const zipPath = `${FileSystem.cacheDirectory}${zipFilename}`;

      await FileSystem.writeAsStringAsync(zipPath, zipBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(zipPath, {
        mimeType: 'application/zip',
        dialogTitle: 'Export Images',
      });

    } catch (error) {
      Alert.alert('Error', error.message);
    }

    setIsExporting(false);
    setExportProgress(null);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Export Data</Text>
        <Text style={styles.subtitle}>Share to Google Drive or other apps</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="document-text-outline" size={32} color="#16A34A" />
            <Text style={styles.statNum}>{stats.totalRecords}</Text>
            <Text style={styles.statLabel}>Records</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="images-outline" size={32} color="#16A34A" />
            <Text style={styles.statNum}>{stats.totalImages}</Text>
            <Text style={styles.statLabel}>Images</Text>
          </View>
        </View>

        {/* Progress */}
        {isExporting && (
          <View style={styles.progressBox}>
            <ActivityIndicator size="large" color="#16A34A" />
            <Text style={styles.progressText}>{exportProgress}</Text>
          </View>
        )}

        {/* Main Export Button */}
        <TouchableOpacity
          style={[styles.mainBtn, isExporting && styles.disabled]}
          onPress={exportAll}
          disabled={isExporting}
        >
          <Ionicons name="cloud-upload" size={28} color="#fff" />
          <View style={styles.mainBtnText}>
            <Text style={styles.mainBtnTitle}>Export All Data</Text>
            <Text style={styles.mainBtnSub}>CSV + {stats.totalImages} images as ZIP</Text>
          </View>
        </TouchableOpacity>

        {/* Individual Exports */}
        <Text style={styles.sectionTitle}>Individual Exports</Text>

        <TouchableOpacity
          style={[styles.btn, isExporting && styles.disabled]}
          onPress={exportCSV}
          disabled={isExporting || stats.totalRecords === 0}
        >
          <View style={styles.btnIcon}>
            <Ionicons name="document-text" size={24} color="#16A34A" />
          </View>
          <View style={styles.btnContent}>
            <Text style={styles.btnTitle}>Export CSV Only</Text>
            <Text style={styles.btnSub}>{stats.totalRecords} records</Text>
          </View>
          <Ionicons name="share-outline" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, isExporting && styles.disabled]}
          onPress={exportImages}
          disabled={isExporting || stats.totalImages === 0}
        >
          <View style={styles.btnIcon}>
            <Ionicons name="images" size={24} color="#16A34A" />
          </View>
          <View style={styles.btnContent}>
            <Text style={styles.btnTitle}>Export Images Only</Text>
            <Text style={styles.btnSub}>{stats.totalImages} images as ZIP</Text>
          </View>
          <Ionicons name="share-outline" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Refresh */}
        <TouchableOpacity style={styles.btn} onPress={loadStats}>
          <View style={styles.btnIcon}>
            <Ionicons name="refresh" size={24} color="#16A34A" />
          </View>
          <View style={styles.btnContent}>
            <Text style={styles.btnTitle}>Refresh Stats</Text>
            <Text style={styles.btnSub}>Update file counts</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Instructions */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How to backup:</Text>
          <Text style={styles.infoText}>1. Tap Export button above</Text>
          <Text style={styles.infoText}>2. Select "Save to Drive" or any app</Text>
          <Text style={styles.infoText}>3. Choose location and save</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statNum: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  progressBox: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginTop: 16,
  },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    elevation: 4,
  },
  mainBtnText: {
    marginLeft: 16,
    flex: 1,
  },
  mainBtnTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  mainBtnSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  disabled: {
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
  },
  btnIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  btnContent: {
    flex: 1,
  },
  btnTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  btnSub: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  infoBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginTop: 12,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
    lineHeight: 20,
  },
});

export default SyncScreen;
