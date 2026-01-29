import React from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { LocationGroupRow } from './ExportRecordSelector';
import { spacing } from '../constants/theme';

const RECORDS_LIST_MAX_HEIGHT = Math.min(Dimensions.get('window').height * 0.4, 320);

/**
 * Scrollable list of location group records (e.g. "1/La Trinidad/Balili").
 * Used on the Export screen for selecting groups to include in ZIP export.
 */
export default function ExportRecordsList({
  groups,
  selectedGroupKeys,
  maxSelectable,
  onToggleGroup,
}) {
  if (!groups || groups.length === 0) return null;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled
    >
      {groups.map((item) => {
        const isSelected = selectedGroupKeys.has(item.key);
        const atLimit = selectedGroupKeys.size >= maxSelectable && !isSelected;
        return (
          <View key={item.key} style={styles.item}>
            <LocationGroupRow
              item={item}
              isSelected={isSelected}
              disabled={atLimit}
              onPress={() => onToggleGroup(item.key)}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    maxHeight: RECORDS_LIST_MAX_HEIGHT,
    marginBottom: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.sm,
  },
  item: {
    marginBottom: spacing.sm,
  },
});
