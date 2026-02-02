import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Use legacy API - supported until SDK 55
import { readCSV, getCSVPath, parseCSVContent, resetCSV } from '../services/csvService';
import { getInfoStorage } from '../services/storageService';
import { Alert } from 'react-native';
import { fonts, fontSizes, colors, radius, spacing, shadows, layout } from '../constants/theme';

// Debug logging helper - __DEV__ is a React Native global
// eslint-disable-next-line no-undef
const DEBUG_MODE = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
const logDebug = (message, data = null) => {
  if (DEBUG_MODE) {
    if (data) {
      console.log(`[DataViewerScreen] ${message}`, data);
    } else {
      console.log(`[DataViewerScreen] ${message}`);
    }
  }
};

const MIN_COLUMN_WIDTH = 100;
const MAX_COLUMN_WIDTH = 200;

// Column display names mapping
const COLUMN_LABELS = {
  uuid: 'UUID',
  spot_number: 'Spot #',
  shot_number: 'Shot #',
  shots_in_spot: 'Shots/Spot',
  image_filename: 'Image File',
  image_width: 'Width (px)',
  image_height: 'Height (px)',
  image_quality: 'Quality',
  capture_datetime: 'Date/Time',
  latitude: 'Latitude',
  longitude: 'Longitude',
  altitude_m: 'Altitude (m)',
  altitude_accuracy_m: 'Alt Accuracy',
  gps_accuracy_m: 'GPS Accuracy',
  gps_reading_count: 'GPS Readings',
  camera_pitch: 'Pitch (°)',
  camera_roll: 'Roll (°)',
  camera_heading: 'Heading (°)',
  municipality: 'Municipality',
  barangay: 'Barangay',
  crops: 'Crops',
  temperature_c: 'Temp (C)',
  humidity_percent: 'Humidity (%)',
  notes: 'Notes',
  device_id: 'Device ID',
};

export default function DataViewerScreen({ navigation }) {
  const [headers, setHeaders] = useState([]);
  const [data, setData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Derived: filter and sort without extra state or effect (avoids redundant work as data grows)
  const filteredData = useMemo(() => {
    let result = [...data];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(row =>
        Object.values(row).some(value => String(value).toLowerCase().includes(query))
      );
    }
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn] || '';
        const bVal = b[sortColumn] || '';
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    return result;
  }, [data, searchQuery, sortColumn, sortDirection]);

  const stats = useMemo(() => ({
    total: data.length,
    filtered: filteredData.length,
  }), [data.length, filteredData.length]);

  // Animation values
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadData();

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
    ]).start();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      logDebug('Starting to load CSV data...');

      const csvContent = await readCSV();
      logDebug('CSV content length:', csvContent.length);

      // Use the proper CSV parser that handles newlines in quoted fields
      const parsedRows = parseCSVContent(csvContent);
      logDebug('Total rows parsed:', parsedRows.length);

      if (parsedRows.length === 0) {
        logDebug('No data found in CSV');
        setHeaders([]);
        setData([]);
        setIsLoading(false);
        return;
      }

      const headerRow = parsedRows[0].map(h => h.trim());
      logDebug('Headers parsed:', headerRow);
      setHeaders(headerRow);

      if (parsedRows.length <= 1) {
        logDebug('Only header row found, no data');
        setData([]);
        setIsLoading(false);
        return;
      }

      const rows = [];

      for (let index = 1; index < parsedRows.length; index++) {
        const values = parsedRows[index];
        const row = { _rowIndex: rows.length };

        headerRow.forEach((header, i) => {
          row[header] = values[i]?.trim() || '';
        });

        rows.push(row);
      }

      logDebug(`Parsed ${rows.length} data rows`);

      if (rows.length > 0) {
        logDebug('Sample row:', {
          uuid: rows[0].uuid,
          image_filename: rows[0].image_filename,
          municipality: rows[0].municipality,
        });
      }

      setData(rows);

      // Get file modification time
      const csvPath = getCSVPath();
      logDebug('CSV path:', csvPath);

      try {
        const fileInfo = await getInfoStorage(csvPath);
        if (fileInfo.exists && fileInfo.modificationTime) {
          setLastUpdated(new Date(fileInfo.modificationTime * 1000));
          logDebug('File last modified:', new Date(fileInfo.modificationTime * 1000).toISOString());
        } else if (fileInfo.exists) {
          setLastUpdated(new Date());
          logDebug('File exists but no modification time, using current time');
        }
      } catch (fileErr) {
        logDebug('Error getting file info:', fileErr.message);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('[DataViewerScreen] Error loading CSV data:', err);
      logDebug('Error details:', { message: err.message, stack: err.stack });
      setError(`Failed to load data: ${err.message}`);
      setHeaders([]);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction or clear
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const formatCellValue = (header, value) => {
    // Handle null, undefined, and empty string - but NOT 0
    if (value === null || value === undefined || value === '') return '-';

    if (header === 'capture_datetime') {
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }

    if (header === 'latitude' || header === 'longitude') {
      const num = parseFloat(value);
      return isNaN(num) ? value : num.toFixed(6);
    }

    if (header === 'altitude_m' || header === 'altitude_accuracy_m' ||
        header === 'gps_accuracy_m' || header === 'temperature_c') {
      const num = parseFloat(value);
      return isNaN(num) ? value : num.toFixed(2);
    }

    if (header === 'humidity_percent') {
      const num = parseFloat(value);
      return isNaN(num) ? value : `${num.toFixed(1)}%`;
    }

    // Truncate long values
    if (value.length > 25) {
      return value.substring(0, 22) + '...';
    }

    return value;
  };

  const getColumnWidth = (header) => {
    // Variable width based on column content type
    if (header === 'uuid' || header === 'image_filename' || header === 'device_id') {
      return MAX_COLUMN_WIDTH;
    }
    if (header === 'capture_datetime') {
      return 160;
    }
    if (header === 'notes') {
      return MAX_COLUMN_WIDTH;
    }
    if (header === 'municipality' || header === 'barangay' || header === 'crops') {
      return 140;
    }
    return MIN_COLUMN_WIDTH;
  };

  const renderErrorState = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconCircle, { backgroundColor: colors.errorLight }]}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
      </View>
      <Text style={styles.emptyText}>Error Loading Data</Text>
      <Text style={styles.emptySubtext}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={loadData}>
        <Ionicons name="refresh-outline" size={18} color={colors.text.inverse} />
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="grid-outline" size={40} color={colors.text.tertiary} />
      </View>
      <Text style={styles.emptyText}>No data yet</Text>
      <Text style={styles.emptySubtext}>
        Capture some data to view it here
      </Text>
    </View>
  );

  const renderNoResults = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="search-outline" size={40} color={colors.text.tertiary} />
      </View>
      <Text style={styles.emptyText}>No results found</Text>
      <Text style={styles.emptySubtext}>
        Try adjusting your search query
      </Text>
    </View>
  );

  const renderTable = () => {
    // Show error state first
    if (error) {
      return renderErrorState();
    }

    if (headers.length === 0 || data.length === 0) {
      return renderEmptyState();
    }

    if (filteredData.length === 0 && searchQuery.trim()) {
      return renderNoResults();
    }

    const totalWidth = headers.reduce((sum, h) => sum + getColumnWidth(h), 0);

    return (
      <View style={styles.tableContainer}>
        {/* Horizontal scroll wrapper */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.horizontalScrollContent}
          bounces={false}
        >
          <View style={[styles.tableWrapper, { width: totalWidth }]}>
            {/* Fixed Header Row */}
            <View style={styles.headerRow}>
              {headers.map((header, index) => (
                <TouchableOpacity
                  key={header}
                  style={[
                    styles.headerCell,
                    { width: getColumnWidth(header) },
                    index === 0 && styles.firstCell,
                    sortColumn === header && styles.sortedHeader,
                  ]}
                  onPress={() => handleSort(header)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.headerText} numberOfLines={1}>
                    {COLUMN_LABELS[header] || header}
                  </Text>
                  {sortColumn === header && (
                    <Ionicons
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={colors.text.inverse}
                      style={styles.sortIcon}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Data Rows - Virtualized vertical list for hundreds of records */}
            <FlatList
              data={filteredData}
              keyExtractor={(item) => String(item._rowIndex)}
              style={styles.dataScrollView}
              contentContainerStyle={styles.dataScrollContent}
              showsVerticalScrollIndicator={true}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
              initialNumToRender={15}
              maxToRenderPerBatch={15}
              windowSize={7}
              removeClippedSubviews={true}
              renderItem={({ item: row, index: rowIndex }) => (
                <View
                  style={[
                    styles.dataRow,
                    rowIndex % 2 === 0 && styles.evenRow,
                  ]}
                >
                  {headers.map((header, colIndex) => (
                    <View
                      key={`${row._rowIndex}-${header}`}
                      style={[
                        styles.dataCell,
                        { width: getColumnWidth(header) },
                        colIndex === 0 && styles.firstCell,
                      ]}
                    >
                      <Text style={styles.cellText} numberOfLines={2}>
                        {formatCellValue(header, row[header])}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            />
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Data Viewer</Text>
            <Text style={styles.headerSubtitle}>Browse captured records</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={refreshing || isLoading}
            activeOpacity={0.7}
          >
            <Ionicons
              name="refresh"
              size={22}
              color={colors.text.inverse}
              style={refreshing ? styles.refreshingIcon : null}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentSlide }],
          },
        ]}
      >
        {/* Stats Bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.filtered}</Text>
            <Text style={styles.statLabel}>Showing</Text>
          </View>
          {lastUpdated && (
            <>
              <View style={styles.statDivider} />
              <View style={[styles.statItem, styles.lastUpdatedItem]}>
                <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
                <Text style={styles.lastUpdatedText}>
                  {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search records..."
              placeholderTextColor={colors.text.tertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
          {sortColumn && (
            <TouchableOpacity
              style={styles.clearSortButton}
              onPress={() => {
                setSortColumn(null);
                setSortDirection('asc');
              }}
            >
              <Ionicons name="swap-vertical" size={16} color={colors.primary} />
              <Text style={styles.clearSortText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Table */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading data...</Text>
          </View>
        ) : (
          renderTable()
        )}
      </Animated.View>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  content: {
    flex: 1,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.md,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
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
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
  lastUpdatedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
    paddingRight: spacing.sm,
  },
  lastUpdatedText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.primary,
    paddingVertical: spacing.xs,
  },
  clearSortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  clearSortText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  tableContainer: {
    flex: 1,
    marginTop: spacing.sm,
  },
  horizontalScrollContent: {
    paddingHorizontal: spacing.lg,
  },
  tableWrapper: {
    flex: 1,
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: colors.primaryDark || colors.primary,
    minHeight: 48,
  },
  headerCell: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.2)',
    minHeight: 48,
  },
  firstCell: {
    borderLeftWidth: 0,
  },
  sortedHeader: {
    backgroundColor: colors.primaryLight,
  },
  headerText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.text.inverse,
    flex: 1,
  },
  sortIcon: {
    marginLeft: spacing.xs,
  },
  dataScrollView: {
    flex: 1,
  },
  dataScrollContent: {
    paddingBottom: layout.contentPaddingBottom,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  evenRow: {
    backgroundColor: colors.background.secondary,
  },
  dataCell: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: colors.borderLight,
    minHeight: 44,
  },
  cellText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
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
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  retryButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.text.inverse,
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
});
