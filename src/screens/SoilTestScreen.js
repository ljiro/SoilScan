import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
// Use legacy API - supported until SDK 55
import * as FileSystem from 'expo-file-system/legacy';
import { loadConfig } from '../services/storageService';
import {
  initSoilTestCSV,
  saveSoilTestResult,
  updateSoilTestResult,
  deleteSoilTestResult,
  generateSampleId,
  readSoilTestResults,
  getSoilTestPath,
} from '../services/soilTestService';
import { MUNICIPALITIES, BARANGAYS } from '../constants/locations';
import { CROPS } from '../constants/crops';
import LocationSelector from '../components/LocationSelector';
import { fonts, fontSizes, colors, radius, spacing, shadows, layout } from '../constants/theme';
import { Modal, FlatList } from 'react-native';

export default function SoilTestScreen({ navigation }) {
  // Sample identification fields (similar to Setup)
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [farmName, setFarmName] = useState('');
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [sampleNumber, setSampleNumber] = useState('');
  
  // Test result fields
  const [nitrogen, setNitrogen] = useState('');
  const [phosphorus, setPhosphorus] = useState('');
  const [potassium, setPotassium] = useState('');
  const [ph, setPh] = useState('');
  const [notes, setNotes] = useState('');
  
  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [testResults, setTestResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null); // Track which entry is being edited
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('test_date');
  const [sortDirection, setSortDirection] = useState('desc'); // Newest first by default
  
  // Dropdown modals for nutrients
  const [showNitrogenModal, setShowNitrogenModal] = useState(false);
  const [showPhosphorusModal, setShowPhosphorusModal] = useState(false);
  const [showPotassiumModal, setShowPotassiumModal] = useState(false);
  const [showPhModal, setShowPhModal] = useState(false);
  
  // Predefined options for nutrients
  const nutrientOptions = [
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
  ];
  
  // Predefined options for pH
  const phOptions = [
    { label: 'High (Alkaline)', value: 'high' },
    { label: 'Medium (Neutral)', value: 'medium' },
    { label: 'Low (Acidic)', value: 'low' },
  ];
  
  // Helper function to handle nutrient selection
  const handleNutrientSelect = (field, option) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    
    // Map option to a representative value or keep as text
    // For now, we'll use the label as the value
    const value = option.label.toLowerCase();
    
    if (field === 'nitrogen') {
      setNitrogen(value);
      setShowNitrogenModal(false);
    } else if (field === 'phosphorus') {
      setPhosphorus(value);
      setShowPhosphorusModal(false);
    } else if (field === 'potassium') {
      setPotassium(value);
      setShowPotassiumModal(false);
    } else if (field === 'ph') {
      setPh(value);
      setShowPhModal(false);
    }
  };

  // Animation values
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(30)).current;
  const saveScale = useRef(new Animated.Value(1)).current;
  
  // ScrollView ref for scrolling to top when editing
  const scrollViewRef = useRef(null);

  useEffect(() => {
    initialize();
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
      loadTestHistory();
    });
    return unsubscribe;
  }, [navigation]);

  // Auto-show history when test results are available
  useEffect(() => {
    if (testResults.length > 0 && !showHistory) {
      // Auto-expand history if there are results and it's collapsed
      // Only do this once, not on every update
      const timer = setTimeout(() => {
        setShowHistory(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [testResults.length]);

  // Filter and sort results
  useEffect(() => {
    let filtered = [...testResults];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(result =>
        result.sample_id?.toLowerCase().includes(query) ||
        result.municipality?.toLowerCase().includes(query) ||
        result.barangay?.toLowerCase().includes(query) ||
        result.crop?.toLowerCase().includes(query) ||
        result.farm_name?.toLowerCase().includes(query) ||
        result.notes?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      // Try numeric comparison for numeric fields
      if (['nitrogen_n', 'phosphorus_p', 'potassium_k', 'ph'].includes(sortField)) {
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
      }

      // Date comparison
      if (sortField === 'test_date' || sortField === 'created_at') {
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }

      // For location sorting, combine municipality and barangay
      if (sortField === 'municipality' || sortField === 'barangay') {
        const aLocation = sortField === 'municipality' 
          ? `${a.municipality || ''} ${a.barangay || ''}`.trim()
          : `${a.barangay || ''} ${a.municipality || ''}`.trim();
        const bLocation = sortField === 'municipality'
          ? `${b.municipality || ''} ${b.barangay || ''}`.trim()
          : `${b.barangay || ''} ${b.municipality || ''}`.trim();
        const comparison = aLocation.localeCompare(bLocation);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // String comparison
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredResults(filtered);
  }, [testResults, searchQuery, sortField, sortDirection]);

  const initialize = async () => {
    try {
      await initSoilTestCSV();
      await loadDefaultValues();
      await loadTestHistory();
    } catch (error) {
      console.error('[SoilTestScreen] Init error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDefaultValues = async () => {
    try {
      const config = await loadConfig('user_config');
      if (config) {
        // Load default location
        if (config.municipalityId) {
          const muni = MUNICIPALITIES.find(m => m.id === config.municipalityId);
          if (muni) setSelectedMunicipality(muni);
        }
        if (config.barangayId && config.municipalityId) {
          const barangayList = BARANGAYS[config.municipalityId] || [];
          const brgy = barangayList.find(b => b.id === config.barangayId);
          if (brgy) setSelectedBarangay(brgy);
        }
        
        // Load default farm name
        if (config.farmName) {
          setFarmName(config.farmName);
        }
        
        // Load default crop (use first selected crop from setup)
        if (config.selectedCropLabels && config.selectedCropLabels.length > 0) {
          const firstCropLabel = config.selectedCropLabels[0];
          const crop = CROPS.find(c => c.label === firstCropLabel);
          if (crop) setSelectedCrop(crop);
        }
      }
    } catch (error) {
      console.error('[SoilTestScreen] Error loading defaults:', error);
    }
  };

  const generateSampleIdFromFields = async () => {
    try {
      if (!selectedMunicipality || !selectedBarangay) {
        // Can't generate without location
        return '';
      }
      
      const id = await generateSampleId(
        sampleNumber || null,
        selectedMunicipality.label,
        selectedBarangay.label,
        farmName || null
      );
      return id;
    } catch (error) {
      console.error('[SoilTestScreen] Error generating sample ID:', error);
      return '';
    }
  };

  const loadTestHistory = async () => {
    try {
      console.log('[SoilTestScreen] Loading test history...');
      const result = await readSoilTestResults();
      if (result.success) {
        console.log('[SoilTestScreen] Loaded', result.results.length, 'test results');
        // Create a new array to ensure React detects the state change
        setTestResults([...result.results]);
      } else {
        console.error('[SoilTestScreen] Failed to load history:', result.error);
      }
    } catch (error) {
      console.error('[SoilTestScreen] Error loading history:', error);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!selectedMunicipality || !selectedBarangay) {
      Alert.alert('Error', 'Please select location (municipality and barangay)');
      return;
    }
    
    if (!selectedCrop) {
      Alert.alert('Error', 'Please select a crop');
      return;
    }
    
    // For new entries, generate sample ID. For edits, use existing sample ID
    let generatedSampleId = editingEntry?.sample_id;
    if (!generatedSampleId) {
      generatedSampleId = await generateSampleIdFromFields();
      if (!generatedSampleId) {
        Alert.alert('Error', 'Failed to generate sample ID');
        return;
      }
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    // Button animation
    Animated.sequence([
      Animated.timing(saveScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(saveScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    setIsSaving(true);

    try {
      // Parse numeric values, use NaN if empty or invalid
      const parseValue = (value) => {
        if (!value || value.trim() === '' || value.toLowerCase() === 'nan') {
          return null; // Will be saved as 'NaN' in CSV
        }
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
      };

      const testData = {
        sampleId: generatedSampleId,
        spotNumber: sampleNumber.trim() || '',
        municipality: selectedMunicipality.label,
        barangay: selectedBarangay.label,
        farmName: farmName.trim(),
        crop: selectedCrop.label,
        nitrogen: parseValue(nitrogen),
        phosphorus: parseValue(phosphorus),
        potassium: parseValue(potassium),
        ph: parseValue(ph),
        notes: notes.trim(),
        created_at: editingEntry?.created_at || new Date().toISOString(), // Preserve original created_at for edits
      };

      // Use update or save based on whether we're editing
      const result = editingEntry
        ? await updateSoilTestResult(editingEntry.sample_id, testData)
        : await saveSoilTestResult(testData);

      if (result.success) {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}

        const wasEditing = !!editingEntry;
        
        // Reset form first (keep location/crop/farm from setup, clear test values)
        setEditingEntry(null);
        setSampleNumber('');
        setNitrogen('');
        setPhosphorus('');
        setPotassium('');
        setPh('');
        setNotes('');
        
        // Reload defaults if we were editing (to restore setup values)
        if (wasEditing) {
          await loadDefaultValues();
        }
        
        // Small delay to ensure file write is complete, then reload history
        await new Promise(resolve => setTimeout(resolve, 200));
        await loadTestHistory();
        
        // Force history section to be visible after save
        setShowHistory(true);
        
        Alert.alert('Success', wasEditing ? 'Soil test result updated successfully' : 'Soil test result saved successfully');
      } else {
        throw new Error(result.error || 'Failed to save');
      }
    } catch (error) {
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}

      Alert.alert('Error', `Failed to save soil test result: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const parseNumberInput = (text) => {
    // Allow empty, 'nan', or valid numbers
    if (text === '' || text.toLowerCase() === 'nan') {
      return text;
    }
    // Remove non-numeric characters except decimal point and minus
    return text.replace(/[^0-9.-]/g, '');
  };

  const handleEditEntry = (entry) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    // Find municipality and barangay from entry
    const muni = MUNICIPALITIES.find(m => m.label === entry.municipality);
    const brgy = muni ? (BARANGAYS[muni.id] || []).find(b => b.label === entry.barangay) : null;
    const crop = CROPS.find(c => c.label === entry.crop);

    // Populate form with entry data
    if (muni) {
      setSelectedMunicipality(muni);
    } else {
      setSelectedMunicipality(null);
    }
    
    if (brgy) {
      setSelectedBarangay(brgy);
    } else {
      setSelectedBarangay(null);
    }
    
    if (crop) {
      setSelectedCrop(crop);
    } else {
      setSelectedCrop(null);
    }
    
    setFarmName(entry.farm_name || '');
    setSampleNumber(entry.sample_number || '');
    
    // Handle NaN values - convert to empty string for editing
    setNitrogen(entry.nitrogen_n === 'NaN' || !entry.nitrogen_n ? '' : entry.nitrogen_n);
    setPhosphorus(entry.phosphorus_p === 'NaN' || !entry.phosphorus_p ? '' : entry.phosphorus_p);
    setPotassium(entry.potassium_k === 'NaN' || !entry.potassium_k ? '' : entry.potassium_k);
    setPh(entry.ph === 'NaN' || !entry.ph ? '' : entry.ph);
    setNotes(entry.notes || '');

    // Set editing entry
    setEditingEntry(entry);

    // Scroll to top after a short delay to ensure state updates
    setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: true });
      }
    }, 100);
  };

  const handleDeleteEntry = (entry) => {
    Alert.alert(
      'Delete Entry',
      `Are you sure you want to delete this test result?\n\nSample ID: ${entry.sample_id}`,
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch {}

            const result = await deleteSoilTestResult(entry.sample_id);
            if (result.success) {
              try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {}
              
              // If we were editing this entry, clear the form
              if (editingEntry?.sample_id === entry.sample_id) {
                setEditingEntry(null);
                setSampleNumber('');
                setNitrogen('');
                setPhosphorus('');
                setPotassium('');
                setPh('');
                setNotes('');
                await loadDefaultValues();
              }
              
              // Reload history immediately to reflect deletion
              await loadTestHistory();
            } else {
              Alert.alert('Error', 'Failed to delete entry: ' + result.error);
            }
          },
        },
      ]
    );
  };

  const handleExportCSV = async () => {
    if (testResults.length === 0) {
      Alert.alert('No Data', 'No soil test results to export yet.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setIsExporting(true);

    try {
      const csvPath = getSoilTestPath();
      const fileInfo = await FileSystem.getInfoAsync(csvPath);

      if (!fileInfo.exists) {
        Alert.alert('No Data', 'No soil test results file found.');
        setIsExporting(false);
        return;
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(csvPath, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Soil Test Results',
          UTI: 'public.comma-separated-values-text',
        });
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export CSV: ' + error.message);
      console.error('[SoilTestScreen] Export error:', error);
    }

    setIsExporting(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.wrapper, styles.loadingContainer]}>
        <Ionicons name="flask-outline" size={48} color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Soil Test</Text>
        <Text style={styles.headerSubtitle}>Log soil test kit results</Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: contentSlide }],
          }}
        >
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
            <TextInput
              style={styles.input}
              value={farmName}
              onChangeText={setFarmName}
              placeholder="e.g., Garcia Farm, Lot 5, etc."
              placeholderTextColor={colors.text.tertiary}
              maxLength={50}
              autoCapitalize="words"
            />
          </View>

          {/* Crop Selector */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="leaf-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Crop *</Text>
            </View>
            <Text style={styles.settingDescription}>
              Select the crop for this soil test
            </Text>
            <View style={styles.cropSelector}>
              {CROPS.map((crop) => {
                const isSelected = selectedCrop?.id === crop.id;
                return (
                  <TouchableOpacity
                    key={crop.id}
                    style={[
                      styles.cropOption,
                      isSelected && styles.cropOptionSelected,
                    ]}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {}
                      setSelectedCrop(crop);
                    }}
                  >
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={isSelected ? colors.primary : colors.text.tertiary}
                    />
                    <Text
                      style={[
                        styles.cropOptionText,
                        isSelected && styles.cropOptionTextSelected,
                      ]}
                    >
                      {crop.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedCrop && (
              <View style={styles.selectedCropBox}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={styles.selectedCropText}>Selected: {selectedCrop.label}</Text>
              </View>
            )}
          </View>

          {/* Sample Number (Optional) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pricetag-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Sample Number (Optional)</Text>
            </View>
            <Text style={styles.settingDescription}>
              Optional sample number to include in the sample ID
            </Text>
            <TextInput
              style={styles.input}
              value={sampleNumber}
              onChangeText={setSampleNumber}
              placeholder="e.g., 1, 2, 3, A, B, etc."
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
            />
          </View>

          {/* Edit Mode Indicator */}
          {editingEntry && (
            <View style={styles.editModeBanner}>
              <Ionicons name="create-outline" size={18} color={colors.text.inverse} />
              <Text style={styles.editModeText}>Editing: {editingEntry.sample_id}</Text>
              <TouchableOpacity
                onPress={() => {
                  setEditingEntry(null);
                  setSampleNumber('');
                  setNitrogen('');
                  setPhosphorus('');
                  setPotassium('');
                  setPh('');
                  setNotes('');
                  // Reload defaults
                  loadDefaultValues();
                }}
                style={styles.cancelEditButton}
              >
                <Ionicons name="close-outline" size={18} color={colors.text.inverse} />
              </TouchableOpacity>
            </View>
          )}

          {/* Generated Sample ID Preview */}
          {selectedMunicipality && selectedBarangay && selectedCrop && !editingEntry && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="barcode-outline" size={18} color={colors.text.secondary} />
                <Text style={styles.sectionTitle}>Sample ID Preview</Text>
              </View>
              <Text style={styles.settingDescription}>
                Sample ID will be auto-generated from your selections above
              </Text>
              <View style={styles.sampleIdPreview}>
                <Text style={styles.sampleIdPreviewText}>
                  {selectedMunicipality.label.toLowerCase().replace(/\s+/g, '_')}_
                  {selectedBarangay.label.toLowerCase().replace(/\s+/g, '_')}
                  {farmName ? '_' + farmName.toLowerCase().replace(/\s+/g, '_') : ''}
                  {sampleNumber ? '_sample' + sampleNumber : ''}
                  _{new Date().toISOString().slice(0, 10).replace(/-/g, '')}
                  _{new Date().toISOString().slice(11, 19).replace(/:/g, '')}
                  _{'[uuid]'}
                </Text>
              </View>
            </View>
          )}

          {/* Show existing sample ID when editing */}
          {editingEntry && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="barcode-outline" size={18} color={colors.text.secondary} />
                <Text style={styles.sectionTitle}>Sample ID (Editing)</Text>
              </View>
              <View style={styles.sampleIdPreview}>
                <Text style={styles.sampleIdPreviewText}>{editingEntry.sample_id}</Text>
              </View>
            </View>
          )}

          {/* NPK Values */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="leaf-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Nutrient Levels</Text>
            </View>
            <Text style={styles.settingDescription}>
              Select from dropdown or type a custom value
            </Text>

            {/* Nitrogen */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nitrogen (N)</Text>
              <View style={styles.comboboxContainer}>
                <TextInput
                  style={styles.comboboxInput}
                  value={nitrogen}
                  onChangeText={(text) => setNitrogen(parseNumberInput(text))}
                  placeholder="High, Medium, Low, or value"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={styles.comboboxButton}
                  onPress={() => setShowNitrogenModal(true)}
                >
                  <Ionicons name="chevron-down-outline" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Phosphorus */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phosphorus (P)</Text>
              <View style={styles.comboboxContainer}>
                <TextInput
                  style={styles.comboboxInput}
                  value={phosphorus}
                  onChangeText={(text) => setPhosphorus(parseNumberInput(text))}
                  placeholder="High, Medium, Low, or value"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={styles.comboboxButton}
                  onPress={() => setShowPhosphorusModal(true)}
                >
                  <Ionicons name="chevron-down-outline" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Potassium */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Potassium (K)</Text>
              <View style={styles.comboboxContainer}>
                <TextInput
                  style={styles.comboboxInput}
                  value={potassium}
                  onChangeText={(text) => setPotassium(parseNumberInput(text))}
                  placeholder="High, Medium, Low, or value"
                  placeholderTextColor={colors.text.tertiary}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={styles.comboboxButton}
                  onPress={() => setShowPotassiumModal(true)}
                >
                  <Ionicons name="chevron-down-outline" size={20} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* pH */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="water-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>pH Level</Text>
            </View>
            <Text style={styles.settingDescription}>
              Select from dropdown or type a custom value
            </Text>
            <View style={styles.comboboxContainer}>
              <TextInput
                style={styles.comboboxInput}
                value={ph}
                onChangeText={(text) => setPh(parseNumberInput(text))}
                placeholder="High, Medium, Low, or value (e.g., 6.5)"
                placeholderTextColor={colors.text.tertiary}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity
                style={styles.comboboxButton}
                onPress={() => setShowPhModal(true)}
              >
                <Ionicons name="chevron-down-outline" size={20} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Nutrient Dropdown Modals */}
          <Modal visible={showNitrogenModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <TouchableOpacity 
                style={styles.modalBackdrop} 
                activeOpacity={1}
                onPress={() => setShowNitrogenModal(false)}
              />
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <Ionicons name="leaf-outline" size={20} color={colors.primary} />
                    <Text style={styles.modalTitle}>Nitrogen Level</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => setShowNitrogenModal(false)}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.text.tertiary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalDivider} />
                <FlatList
                  data={nutrientOptions}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => {
                    const isSelected = nitrogen.toLowerCase() === item.label.toLowerCase();
                    return (
                      <TouchableOpacity
                        style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                        onPress={() => handleNutrientSelect('nitrogen', item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.modalItemContent}>
                          <View style={[styles.modalItemIndicator, isSelected && styles.modalItemIndicatorActive]} />
                          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                            {item.label}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>

          <Modal visible={showPhosphorusModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <TouchableOpacity 
                style={styles.modalBackdrop} 
                activeOpacity={1}
                onPress={() => setShowPhosphorusModal(false)}
              />
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <Ionicons name="leaf-outline" size={20} color={colors.primary} />
                    <Text style={styles.modalTitle}>Phosphorus Level</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => setShowPhosphorusModal(false)}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.text.tertiary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalDivider} />
                <FlatList
                  data={nutrientOptions}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => {
                    const isSelected = phosphorus.toLowerCase() === item.label.toLowerCase();
                    return (
                      <TouchableOpacity
                        style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                        onPress={() => handleNutrientSelect('phosphorus', item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.modalItemContent}>
                          <View style={[styles.modalItemIndicator, isSelected && styles.modalItemIndicatorActive]} />
                          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                            {item.label}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>

          <Modal visible={showPotassiumModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <TouchableOpacity 
                style={styles.modalBackdrop} 
                activeOpacity={1}
                onPress={() => setShowPotassiumModal(false)}
              />
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <Ionicons name="leaf-outline" size={20} color={colors.primary} />
                    <Text style={styles.modalTitle}>Potassium Level</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => setShowPotassiumModal(false)}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.text.tertiary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalDivider} />
                <FlatList
                  data={nutrientOptions}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => {
                    const isSelected = potassium.toLowerCase() === item.label.toLowerCase();
                    return (
                      <TouchableOpacity
                        style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                        onPress={() => handleNutrientSelect('potassium', item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.modalItemContent}>
                          <View style={[styles.modalItemIndicator, isSelected && styles.modalItemIndicatorActive]} />
                          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                            {item.label}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>

          <Modal visible={showPhModal} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <TouchableOpacity 
                style={styles.modalBackdrop} 
                activeOpacity={1}
                onPress={() => setShowPhModal(false)}
              />
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <Ionicons name="water-outline" size={20} color={colors.primary} />
                    <Text style={styles.modalTitle}>pH Level</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => setShowPhModal(false)}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.text.tertiary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.modalDivider} />
                <FlatList
                  data={phOptions}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => {
                    const isSelected = ph.toLowerCase() === item.label.toLowerCase() || 
                      ph.toLowerCase().includes(item.value);
                    return (
                      <TouchableOpacity
                        style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                        onPress={() => handleNutrientSelect('ph', item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.modalItemContent}>
                          <View style={[styles.modalItemIndicator, isSelected && styles.modalItemIndicatorActive]} />
                          <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                            {item.label}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>

          {/* Notes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Notes (Optional)</Text>
            </View>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes about the test..."
              placeholderTextColor={colors.text.tertiary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving || !selectedMunicipality || !selectedBarangay || !selectedCrop}
            activeOpacity={0.9}
          >
            <Animated.View
              style={[
                styles.saveButton,
                (isSaving || !selectedMunicipality || !selectedBarangay || !selectedCrop) && styles.saveButtonDisabled,
                { transform: [{ scale: saveScale }] },
              ]}
            >
              {isSaving ? (
                <>
                  <Ionicons name="hourglass-outline" size={22} color={colors.text.inverse} />
                  <Text style={styles.saveButtonText}>{editingEntry ? 'Updating...' : 'Saving...'}</Text>
                </>
              ) : (
                <>
                  <Ionicons name={editingEntry ? "create-outline" : "checkmark-circle-outline"} size={22} color={colors.text.inverse} />
                  <Text style={styles.saveButtonText}>{editingEntry ? 'Update Test Result' : 'Save Test Result'}</Text>
                </>
              )}
            </Animated.View>
          </TouchableOpacity>

          {/* Export CSV Button */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="download-outline" size={18} color={colors.text.secondary} />
              <Text style={styles.sectionTitle}>Export Data</Text>
            </View>
            <Text style={styles.settingDescription}>
              Export all soil test results to CSV file for backup or analysis
            </Text>
            <TouchableOpacity
              style={[
                styles.exportButton,
                (isExporting || testResults.length === 0) && styles.exportButtonDisabled,
              ]}
              onPress={handleExportCSV}
              disabled={isExporting || testResults.length === 0}
            >
              {isExporting ? (
                <>
                  <ActivityIndicator color={colors.text.inverse} size="small" />
                  <Text style={styles.exportButtonText}>Exporting...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color={colors.text.inverse} />
                  <Text style={styles.exportButtonText}>
                    Export CSV ({testResults.length} results)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Test History Toggle */}
          <TouchableOpacity
            style={styles.historyToggle}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Ionicons
              name={showHistory ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.text.secondary}
            />
            <Text style={styles.historyToggleText}>
              {showHistory ? 'Hide' : 'Show'} Test History ({testResults.length})
            </Text>
          </TouchableOpacity>

          {/* Test History */}
          {showHistory && testResults.length > 0 && (
            <View style={styles.historySection}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>
                  Test Results ({filteredResults.length} of {testResults.length})
                </Text>
              </View>

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                  <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by ID, location, crop..."
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
              </View>

              {/* Sort Options */}
              <View style={styles.sortContainer}>
                <Text style={styles.sortLabel}>Sort by:</Text>
                <View style={styles.sortButtons}>
                  {[
                    { field: 'test_date', label: 'Date' },
                    { field: 'crop', label: 'Crop' },
                    { field: 'municipality', label: 'Municipality' },
                    { field: 'barangay', label: 'Barangay' },
                    { field: 'nitrogen_n', label: 'N' },
                  ].map(({ field, label }) => (
                    <TouchableOpacity
                      key={field}
                      style={[
                        styles.sortButton,
                        sortField === field && styles.sortButtonActive,
                      ]}
                      onPress={() => {
                        if (sortField === field) {
                          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField(field);
                          setSortDirection('desc');
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.sortButtonText,
                          sortField === field && styles.sortButtonTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                      {sortField === field && (
                        <Ionicons
                          name={sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}
                          size={12}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Results List */}
              {filteredResults.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="search-outline" size={48} color={colors.text.tertiary} />
                  <Text style={styles.emptyStateText}>No results found</Text>
                  {searchQuery && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Text style={styles.emptyStateLink}>Clear search</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <ScrollView style={styles.resultsList} nestedScrollEnabled>
                  {filteredResults.map((result, index) => {
                    const isEditing = editingEntry?.sample_id === result.sample_id;
                    return (
                      <TouchableOpacity
                        key={result.sample_id || index}
                        style={[styles.historyItem, isEditing && styles.historyItemEditing]}
                        onPress={() => handleEditEntry(result)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.historyItemContent}>
                          <View style={styles.historyItemMain}>
                            <View style={styles.historyItemTop}>
                              <View style={styles.historyItemInfo}>
                                <Text style={styles.historySampleId} numberOfLines={1}>
                                  {result.sample_id}
                                </Text>
                                {(result.municipality || result.barangay || result.crop) && (
                                  <View style={styles.historyMetaRow}>
                                    {result.municipality && result.barangay && (
                                      <View style={styles.metaTag}>
                                        <Ionicons name="location-outline" size={12} color={colors.text.secondary} />
                                        <Text style={styles.metaText}>
                                          {result.municipality}, {result.barangay}
                                        </Text>
                                      </View>
                                    )}
                                    {result.crop && (
                                      <View style={styles.metaTag}>
                                        <Ionicons name="leaf-outline" size={12} color={colors.text.secondary} />
                                        <Text style={styles.metaText}>{result.crop}</Text>
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>
                              <View style={styles.historyActions}>
                                <TouchableOpacity
                                  style={[styles.historyActionButton, isEditing && styles.historyActionButtonActive]}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleEditEntry(result);
                                  }}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.historyActionButton}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleDeleteEntry(result);
                                  }}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                                </TouchableOpacity>
                              </View>
                            </View>
                            <View style={styles.historyValues}>
                              <View style={styles.nutrientBadge}>
                                <Text style={styles.nutrientLabel}>N</Text>
                                <Text style={styles.nutrientValue}>{result.nitrogen_n || 'NaN'}</Text>
                              </View>
                              <View style={styles.nutrientBadge}>
                                <Text style={styles.nutrientLabel}>P</Text>
                                <Text style={styles.nutrientValue}>{result.phosphorus_p || 'NaN'}</Text>
                              </View>
                              <View style={styles.nutrientBadge}>
                                <Text style={styles.nutrientLabel}>K</Text>
                                <Text style={styles.nutrientValue}>{result.potassium_k || 'NaN'}</Text>
                              </View>
                              <View style={styles.nutrientBadge}>
                                <Text style={styles.nutrientLabel}>pH</Text>
                                <Text style={styles.nutrientValue}>{result.ph || 'NaN'}</Text>
                              </View>
                            </View>
                            {result.test_date && (
                              <Text style={styles.historyDate}>
                                {new Date(result.test_date).toLocaleDateString()}
                              </Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}

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
  settingDescription: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.tertiary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  input: {
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
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  cropSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cropOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background.secondary,
    gap: spacing.xs,
  },
  cropOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  cropOptionText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
  },
  cropOptionTextSelected: {
    fontFamily: fonts.medium,
    color: colors.primaryDark,
  },
  selectedCropBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
  },
  selectedCropText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.primaryDark,
  },
  sampleIdPreview: {
    padding: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sampleIdPreviewText: {
    fontFamily: 'monospace',
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  editModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  editModeText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.inverse,
  },
  cancelEditButton: {
    padding: spacing.xs,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  saveButtonDisabled: {
    backgroundColor: colors.text.muted,
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.text.inverse,
  },
  historyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  historyToggleText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
  },
  historySection: {
    backgroundColor: colors.background.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
    maxHeight: 600,
  },
  historyHeader: {
    marginBottom: spacing.md,
  },
  historyTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.text.primary,
  },
  searchContainer: {
    marginBottom: spacing.md,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
    padding: 0,
  },
  sortContainer: {
    marginBottom: spacing.md,
  },
  sortLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  sortButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  sortButtonText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  sortButtonTextActive: {
    fontFamily: fonts.medium,
    color: colors.primaryDark,
  },
  resultsList: {
    maxHeight: 400,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyStateText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyStateLink: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  comboboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background.secondary,
    overflow: 'hidden',
  },
  comboboxInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  comboboxButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: '45%',
    paddingBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.lg,
    color: colors.text.primary,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.background.secondary,
  },
  modalItemSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  modalItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  modalItemIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.tertiary,
  },
  modalItemIndicatorActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  modalItemText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.primary,
  },
  modalItemTextSelected: {
    fontFamily: fonts.semiBold,
    color: colors.primaryDark,
  },
  historyItem: {
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyItemEditing: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemMain: {
    flex: 1,
  },
  historyItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  historyItemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  historyActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  historyActionButton: {
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.background.primary,
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyItemEditing: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  historySampleId: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  historyActionButtonActive: {
    backgroundColor: colors.primaryLight,
  },
  historyLocation: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  historyValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  nutrientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    gap: spacing.xs / 2,
  },
  nutrientLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  nutrientValue: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
  },
  historyMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  metaText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  historyDate: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
  },
  exportButton: {
    flexDirection: 'row',
    backgroundColor: colors.secondary,
    padding: spacing.lg,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  exportButtonDisabled: {
    backgroundColor: colors.text.muted,
    opacity: 0.6,
  },
  exportButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.text.inverse,
  },
});
