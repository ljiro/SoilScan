import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, fontSizes, colors } from '../constants/theme';

export default function LocationSelector({
  municipalities,
  barangays,
  selectedMunicipality,
  selectedBarangay,
  onMunicipalityChange,
  onBarangayChange,
}) {
  const [showMunicipalityModal, setShowMunicipalityModal] = React.useState(false);
  const [showBarangayModal, setShowBarangayModal] = React.useState(false);

  const availableBarangays = selectedMunicipality
    ? barangays[selectedMunicipality.id] || []
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="location-outline" size={16} color={colors.text.primary} />
        <Text style={styles.sectionTitle}> Location *</Text>
      </View>

      {/* Municipality */}
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setShowMunicipalityModal(true)}
      >
        <Text style={selectedMunicipality ? styles.selectedText : styles.placeholderText}>
          {selectedMunicipality?.label || 'Select Municipality'}
        </Text>
        <Ionicons name="chevron-down-outline" size={18} color={colors.text.secondary} />
      </TouchableOpacity>

      {/* Barangay */}
      <TouchableOpacity
        style={[styles.selector, !selectedMunicipality && styles.disabled]}
        onPress={() => selectedMunicipality && setShowBarangayModal(true)}
        disabled={!selectedMunicipality}
      >
        <Text style={selectedBarangay ? styles.selectedText : styles.placeholderText}>
          {selectedBarangay?.label || 'Select Barangay'}
        </Text>
        <Ionicons name="chevron-down-outline" size={18} color={colors.text.secondary} />
      </TouchableOpacity>

      {/* Municipality Modal */}
      <Modal visible={showMunicipalityModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Municipality</Text>
            <FlatList
              data={municipalities}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    onMunicipalityChange(item);
                    onBarangayChange(null);
                    setShowMunicipalityModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowMunicipalityModal(false)}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Barangay Modal */}
      <Modal visible={showBarangayModal} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Barangay</Text>
            <FlatList
              data={availableBarangays}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    onBarangayChange(item);
                    setShowBarangayModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowBarangayModal(false)}
            >
              <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    backgroundColor: colors.background.primary,
  },
  disabled: {
    opacity: 0.5,
    backgroundColor: colors.background.secondary,
  },
  selectedText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.text.primary,
  },
  placeholderText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.tertiary,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 30,
  },
  modalTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    textAlign: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.secondary,
    color: colors.text.primary,
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.secondary,
  },
  modalItemText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.base,
    color: colors.text.primary,
  },
  closeButton: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    marginTop: 8,
    marginHorizontal: 16,
    borderRadius: 8,
  },
  closeButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.text.secondary,
  },
});
