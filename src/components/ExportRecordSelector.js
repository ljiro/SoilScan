import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, fontSizes, colors, radius, spacing, shadows } from '../constants/theme';

/**
 * Selection toolbar: Select all and Clear.
 */
export function SelectionToolbar({
  onSelectAll,
  onClear,
}) {
  return (
    <View style={styles.toolbar}>
      <View style={styles.toolbarActions}>
        <TouchableOpacity style={styles.toolbarButton} onPress={onSelectAll} activeOpacity={0.7}>
          <Ionicons name="checkbox-outline" size={18} color={colors.primary} />
          <Text style={styles.toolbarButtonText}>Select all</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton} onPress={onClear} activeOpacity={0.7}>
          <Ionicons name="close-circle-outline" size={18} color={colors.text.secondary} />
          <Text style={[styles.toolbarButtonText, styles.toolbarButtonTextMuted]}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Single location group row for the list (e.g. "1/La Trinidad/Balili").
 */
export function LocationGroupRow({ item, isSelected, disabled, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.row, isSelected && styles.rowSelected, disabled && styles.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
      </View>
      <Text style={styles.rowTitle} numberOfLines={1}>
        {item.title}
      </Text>
      <View style={styles.rowBadge}>
        <Text style={styles.rowBadgeText}>{item.records.length}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Export "Select records" section: header, description, loading/empty states, selection toolbar.
 */
export default function ExportRecordSelector({
  maxSelectable,
  recordsLoaded,
  groups,
  selectedGroupKeys,
  selectedRecordCount,
  onSelectAll,
  onClear,
  children,
}) {
  const selectedGroupCount = selectedGroupKeys?.size ?? 0;
  const hasGroups = groups?.length > 0;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name="archive-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>Export as ZIP</Text>
          <Text style={styles.sectionSubtitle}>
            Max {maxSelectable} groups · images + CSV
          </Text>
        </View>
      </View>
      <Text style={styles.description}>
        Select location groups (spot/municipality/barangay). The ZIP will include all images and CSV rows for each selected group.
      </Text>

      {!recordsLoaded ? (
        <View style={styles.placeholder}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.placeholderText}>Loading records…</Text>
        </View>
      ) : !hasGroups ? (
        <View style={styles.empty}>
          <Ionicons name="folder-open-outline" size={32} color={colors.text.tertiary} />
          <Text style={styles.emptyText}>No records yet</Text>
          <Text style={styles.emptySubtext}>Capture photos first. Data is grouped by spot and location.</Text>
        </View>
      ) : (
        <>
          <SelectionToolbar
            onSelectAll={onSelectAll}
            onClear={onClear}
          />
          {children}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: spacing.sm,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.md,
    color: colors.text.primary,
  },
  sectionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  placeholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  placeholderText: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.sm,
    color: colors.text.secondary,
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  emptySubtext: {
    fontFamily: fonts.regular,
    fontSize: fontSizes.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.sm,
  },
  toolbarButtonText: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  toolbarButtonTextMuted: {
    color: colors.text.secondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  rowSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rowTitle: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.text.primary,
  },
  rowBadge: {
    minWidth: 28,
    height: 24,
    borderRadius: radius.sm,
    backgroundColor: colors.text.tertiary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  rowBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: fontSizes.xs,
    color: colors.text.secondary,
  },
});
