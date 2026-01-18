import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fonts, fontSizes, colors } from '../constants/theme';

export default function CropSelector({ crops, selectedCrops, onCropsChange, customCrops = [], onDeleteCustomCrop }) {
  // Combine predefined crops with custom crops
  const allCrops = [...crops, ...customCrops];

  const toggleCrop = (crop) => {
    const isSelected = selectedCrops.some(c => c.id === crop.id);

    // Light haptic for frequent taps
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (isSelected) {
      onCropsChange(selectedCrops.filter(c => c.id !== crop.id));
    } else {
      onCropsChange([...selectedCrops, crop]);
    }
  };

  const selectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCropsChange([...allCrops]);
  };

  const removeAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onCropsChange([]);
  };

  const isCustomCrop = (cropId) => {
    return cropId.startsWith('custom_');
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="leaf-outline" size={16} color={colors.text.primary} />
        <Text style={styles.sectionTitle}>
          {' '}Crops * ({selectedCrops.length} selected)
        </Text>
      </View>

      {/* Select All / Remove All Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={selectAll}
        >
          <Ionicons name="checkmark-done-outline" size={16} color={colors.primary} />
          <Text style={styles.actionButtonText}> Select All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={removeAll}
        >
          <Ionicons name="close-outline" size={16} color={colors.error} />
          <Text style={[styles.actionButtonText, { color: colors.error }]}> Remove All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cropsGrid}>
        {allCrops.map(crop => {
          const isSelected = selectedCrops.some(c => c.id === crop.id);
          const isCustom = isCustomCrop(crop.id);
          return (
            <TouchableOpacity
              key={crop.id}
              style={[
                styles.cropItem,
                isSelected && styles.cropItemSelected,
                isCustom && styles.cropItemCustom,
              ]}
              onPress={() => toggleCrop(crop)}
            >
              <Ionicons
                name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={isSelected ? colors.primary : colors.text.tertiary}
                style={styles.checkbox}
              />
              <Text
                style={[
                  styles.cropLabel,
                  isSelected && styles.cropLabelSelected,
                  isCustom && styles.cropLabelCustom,
                ]}
                numberOfLines={1}
              >
                {crop.label}
              </Text>
              {isCustom && onDeleteCustomCrop && (
                <TouchableOpacity
                  style={styles.deleteCropBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onDeleteCustomCrop(crop.id);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.error} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedCrops.length > 0 && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedLabel}>Selected: </Text>
          <Text style={styles.selectedCrops}>
            {selectedCrops.map(c => c.label).join(', ')}
          </Text>
        </View>
      )}
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
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.background.secondary,
  },
  actionButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
  },
  cropsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background.primary,
  },
  cropItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  checkbox: {
    marginRight: 8,
  },
  cropLabel: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
  },
  cropLabelSelected: {
    fontFamily: fonts.medium,
    color: colors.primaryDark,
  },
  selectedContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    padding: 10,
    backgroundColor: colors.background.secondary,
    borderRadius: 6,
  },
  selectedLabel: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
  selectedCrops: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.primary,
    flex: 1,
  },
  // Custom crop styles
  cropItemCustom: {
    borderStyle: 'dashed',
  },
  cropLabelCustom: {
    flex: 1,
  },
  deleteCropBtn: {
    marginLeft: 'auto',
    padding: 2,
  },
});
