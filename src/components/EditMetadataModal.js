import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, fontSizes, colors, spacing, radius } from '../constants/theme';
import { MUNICIPALITIES, BARANGAYS } from '../constants/locations';
import { CROPS } from '../constants/crops';

export default function EditMetadataModal({
  visible,
  record,
  onClose,
  onSave,
}) {
  // Form state
  const [spotNumber, setSpotNumber] = useState('');
  const [shotNumber, setShotNumber] = useState('');
  const [municipality, setMunicipality] = useState(null);
  const [barangay, setBarangay] = useState(null);
  const [farmName, setFarmName] = useState('');
  const [selectedCrops, setSelectedCrops] = useState([]);
  const [notes, setNotes] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [altitude, setAltitude] = useState('');
  const [captureMode, setCaptureMode] = useState('field');
  const [isSaving, setIsSaving] = useState(false);

  // Selection modals
  const [showMunicipalityModal, setShowMunicipalityModal] = useState(false);
  const [showBarangayModal, setShowBarangayModal] = useState(false);
  const [showCropsModal, setShowCropsModal] = useState(false);

  // Initialize form from record
  useEffect(() => {
    if (record && visible) {
      setSpotNumber(record.spot_number?.toString() || '1');
      setShotNumber(record.shot_number?.toString() || '1');
      setFarmName(record.farm_name || '');
      setNotes(record.notes || '');
      setLatitude(record.latitude?.toString() || '');
      setLongitude(record.longitude?.toString() || '');
      setAltitude(record.altitude_m?.toString() || '');
      setCaptureMode(record.capture_mode || 'field');

      // Find municipality
      const muni = MUNICIPALITIES.find(m => m.label === record.municipality);
      setMunicipality(muni || null);

      // Find barangay
      if (muni) {
        const brgyList = BARANGAYS[muni.id] || [];
        const brgy = brgyList.find(b => b.label === record.barangay);
        setBarangay(brgy || null);
      }

      // Parse crops
      if (record.crops) {
        const cropIds = record.crops.split(',').map(c => c.trim().toLowerCase());
        const crops = CROPS.filter(c => cropIds.includes(c.id.toLowerCase()));
        setSelectedCrops(crops);
      } else {
        setSelectedCrops([]);
      }
    }
  }, [record, visible]);

  const availableBarangays = municipality ? BARANGAYS[municipality.id] || [] : [];

  const handleSave = async () => {
    // Validate
    const spot = parseInt(spotNumber, 10);
    const shot = parseInt(shotNumber, 10);

    if (isNaN(spot) || spot < 1) {
      Alert.alert('Invalid Input', 'Spot number must be at least 1');
      return;
    }

    if (isNaN(shot) || shot < 1) {
      Alert.alert('Invalid Input', 'Shot number must be at least 1');
      return;
    }

    setIsSaving(true);

    try {
      const updates = {
        spot_number: spot,
        shot_number: shot,
        municipality: municipality?.label || record.municipality,
        barangay: barangay?.label || record.barangay,
        farm_name: farmName,
        crops: selectedCrops.map(c => c.id.toLowerCase()).join(','),
        notes: (notes || '').replace(/[\r\n]+/g, ' ').trim(),
        latitude: latitude || record.latitude,
        longitude: longitude || record.longitude,
        altitude_m: altitude || record.altitude_m,
        capture_mode: captureMode,
      };

      await onSave(record.uuid, updates);
      onClose();
    } catch (error) {
      Alert.alert('Save Failed', error.message);
    }

    setIsSaving(false);
  };

  const toggleCrop = (crop) => {
    if (selectedCrops.find(c => c.id === crop.id)) {
      setSelectedCrops(selectedCrops.filter(c => c.id !== crop.id));
    } else {
      setSelectedCrops([...selectedCrops, crop]);
    }
  };

  if (!record) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.title}>Edit Record</Text>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, isSaving && styles.disabled]}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Spot Information */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Spot Information</Text>
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Spot #</Text>
                  <TextInput
                    style={styles.input}
                    value={spotNumber}
                    onChangeText={setSpotNumber}
                    keyboardType="number-pad"
                    placeholder="1"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Shot #</Text>
                  <TextInput
                    style={styles.input}
                    value={shotNumber}
                    onChangeText={setShotNumber}
                    keyboardType="number-pad"
                    placeholder="1"
                  />
                </View>
              </View>
            </View>

            {/* Location */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="map" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Location</Text>
              </View>

              <Text style={styles.label}>Municipality</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowMunicipalityModal(true)}
              >
                <Text style={municipality ? styles.selectorText : styles.selectorPlaceholder}>
                  {municipality?.label || 'Select Municipality'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>

              <Text style={styles.label}>Barangay</Text>
              <TouchableOpacity
                style={[styles.selector, !municipality && styles.selectorDisabled]}
                onPress={() => municipality && setShowBarangayModal(true)}
                disabled={!municipality}
              >
                <Text style={barangay ? styles.selectorText : styles.selectorPlaceholder}>
                  {barangay?.label || 'Select Barangay'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>

              <Text style={styles.label}>Farm Name (Optional)</Text>
              <TextInput
                style={styles.input}
                value={farmName}
                onChangeText={setFarmName}
                placeholder="Enter farm name"
                placeholderTextColor={colors.text.tertiary}
              />
            </View>

            {/* Crops */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="leaf" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Crops</Text>
              </View>

              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowCropsModal(true)}
              >
                <Text style={selectedCrops.length > 0 ? styles.selectorText : styles.selectorPlaceholder}>
                  {selectedCrops.length > 0
                    ? selectedCrops.map(c => c.label).join(', ')
                    : 'Select Crops'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.text.tertiary} />
              </TouchableOpacity>

              {selectedCrops.length > 0 && (
                <View style={styles.chipContainer}>
                  {selectedCrops.map(crop => (
                    <TouchableOpacity
                      key={crop.id}
                      style={styles.chip}
                      onPress={() => toggleCrop(crop)}
                    >
                      <Text style={styles.chipText}>{crop.label}</Text>
                      <Ionicons name="close-circle" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Capture Mode */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="camera" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Capture Mode</Text>
              </View>

              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeBtn, captureMode === 'field' && styles.modeBtnActive]}
                  onPress={() => setCaptureMode('field')}
                >
                  <Ionicons
                    name="sunny-outline"
                    size={20}
                    color={captureMode === 'field' ? '#fff' : colors.text.secondary}
                  />
                  <Text style={[styles.modeBtnText, captureMode === 'field' && styles.modeBtnTextActive]}>
                    Field
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, captureMode === 'controlled' && styles.modeBtnActive]}
                  onPress={() => setCaptureMode('controlled')}
                >
                  <Ionicons
                    name="bulb-outline"
                    size={20}
                    color={captureMode === 'controlled' ? '#fff' : colors.text.secondary}
                  />
                  <Text style={[styles.modeBtnText, captureMode === 'controlled' && styles.modeBtnTextActive]}>
                    Controlled
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* GPS Override */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="navigate" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>GPS (Optional Override)</Text>
              </View>

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Latitude</Text>
                  <TextInput
                    style={styles.input}
                    value={latitude}
                    onChangeText={setLatitude}
                    keyboardType="decimal-pad"
                    placeholder={record.latitude?.toString() || 'N/A'}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={styles.label}>Longitude</Text>
                  <TextInput
                    style={styles.input}
                    value={longitude}
                    onChangeText={setLongitude}
                    keyboardType="decimal-pad"
                    placeholder={record.longitude?.toString() || 'N/A'}
                    placeholderTextColor={colors.text.tertiary}
                  />
                </View>
              </View>

              <Text style={styles.label}>Altitude (m)</Text>
              <TextInput
                style={styles.input}
                value={altitude}
                onChangeText={setAltitude}
                keyboardType="decimal-pad"
                placeholder={record.altitude_m?.toString() || 'N/A'}
                placeholderTextColor={colors.text.tertiary}
              />
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text" size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Notes</Text>
              </View>

              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes..."
                placeholderTextColor={colors.text.tertiary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Bottom padding */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>

      {/* Municipality Modal */}
      <Modal visible={showMunicipalityModal} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Municipality</Text>
              <TouchableOpacity onPress={() => setShowMunicipalityModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={MUNICIPALITIES}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    setMunicipality(item);
                    setBarangay(null);
                    setShowMunicipalityModal(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    municipality?.id === item.id && styles.pickerItemTextActive
                  ]}>
                    {item.label}
                  </Text>
                  {municipality?.id === item.id && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Barangay Modal */}
      <Modal visible={showBarangayModal} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Barangay</Text>
              <TouchableOpacity onPress={() => setShowBarangayModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableBarangays}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    setBarangay(item);
                    setShowBarangayModal(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    barangay?.id === item.id && styles.pickerItemTextActive
                  ]}>
                    {item.label}
                  </Text>
                  {barangay?.id === item.id && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Crops Modal */}
      <Modal visible={showCropsModal} animationType="slide" transparent>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Crops</Text>
              <TouchableOpacity onPress={() => setShowCropsModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CROPS}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedCrops.some(c => c.id === item.id);
                return (
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => toggleCrop(item)}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      isSelected && styles.pickerItemTextActive
                    ]}>
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => setShowCropsModal(false)}
            >
              <Text style={styles.doneBtnText}>Done ({selectedCrops.length} selected)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.lg,
    color: colors.text.primary,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  saveBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: '#fff',
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: colors.text.primary,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.primary,
    backgroundColor: colors.background.primary,
  },
  notesInput: {
    minHeight: 100,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.background.primary,
  },
  selectorDisabled: {
    opacity: 0.5,
    backgroundColor: colors.background.secondary,
  },
  selectorText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.primary,
    flex: 1,
  },
  selectorPlaceholder: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.tertiary,
    flex: 1,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.xs,
    color: colors.primary,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background.primary,
  },
  modeBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeBtnText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
  },
  modeBtnTextActive: {
    color: '#fff',
  },
  // Picker styles
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.lg,
    color: colors.text.primary,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.secondary,
  },
  pickerItemText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.primary,
  },
  pickerItemTextActive: {
    fontFamily: fonts.semiBold,
    color: colors.primary,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.base,
    color: '#fff',
  },
});
