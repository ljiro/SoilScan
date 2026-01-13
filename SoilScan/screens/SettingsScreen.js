import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen = ({ navigation }) => {
  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [locationServices, setLocationServices] = useState(true);
  const [autoWeather, setAutoWeather] = useState(true);
  const [metricUnits, setMetricUnits] = useState(true);
  const [highAccuracyGPS, setHighAccuracyGPS] = useState(false);

  const handleClearData = () => {
    Alert.alert(
      'Clear App Data',
      'This will clear all cached data including saved scans and preferences. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', 'App data cleared successfully.');
          },
        },
      ]
    );
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'This will reset all settings to their default values.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            setNotifications(true);
            setDarkMode(false);
            setLocationServices(true);
            setAutoWeather(true);
            setMetricUnits(true);
            setHighAccuracyGPS(false);
            Alert.alert('Success', 'Settings have been reset to defaults.');
          },
        },
      ]
    );
  };

  const SettingItem = ({ icon, title, subtitle, value, onValueChange, type = 'switch' }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={22} color="#5D9C59" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {type === 'switch' && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#E0E0E0', true: '#A5D6A7' }}
          thumbColor={value ? '#5D9C59' : '#f4f3f4'}
        />
      )}
      {type === 'arrow' && (
        <Ionicons name="chevron-forward" size={20} color="#999" />
      )}
    </View>
  );

  const SectionHeader = ({ title }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A3C40" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {/* General Settings */}
      <SectionHeader title="GENERAL" />
      <View style={styles.section}>
        <SettingItem
          icon="notifications-outline"
          title="Push Notifications"
          subtitle="Receive alerts about soil analysis"
          value={notifications}
          onValueChange={setNotifications}
        />
        <SettingItem
          icon="moon-outline"
          title="Dark Mode"
          subtitle="Use dark theme"
          value={darkMode}
          onValueChange={setDarkMode}
        />
      </View>

      {/* Location Settings */}
      <SectionHeader title="LOCATION & WEATHER" />
      <View style={styles.section}>
        <SettingItem
          icon="location-outline"
          title="Location Services"
          subtitle="Enable GPS for map features"
          value={locationServices}
          onValueChange={setLocationServices}
        />
        <SettingItem
          icon="navigate-outline"
          title="High Accuracy GPS"
          subtitle="Uses more battery for precise location"
          value={highAccuracyGPS}
          onValueChange={setHighAccuracyGPS}
        />
        <SettingItem
          icon="cloud-outline"
          title="Auto-fetch Weather"
          subtitle="Automatically get weather data"
          value={autoWeather}
          onValueChange={setAutoWeather}
        />
      </View>

      {/* Units Settings */}
      <SectionHeader title="UNITS & DISPLAY" />
      <View style={styles.section}>
        <SettingItem
          icon="thermometer-outline"
          title="Metric Units"
          subtitle={metricUnits ? 'Temperature in Celsius' : 'Temperature in Fahrenheit'}
          value={metricUnits}
          onValueChange={setMetricUnits}
        />
      </View>

      {/* Data Management */}
      <SectionHeader title="DATA MANAGEMENT" />
      <View style={styles.section}>
        <TouchableOpacity style={styles.settingItem} onPress={handleClearData}>
          <View style={[styles.settingIcon, { backgroundColor: 'rgba(223, 46, 56, 0.1)' }]}>
            <Ionicons name="trash-outline" size={22} color="#DF2E38" />
          </View>
          <View style={styles.settingContent}>
            <Text style={[styles.settingTitle, { color: '#DF2E38' }]}>Clear App Data</Text>
            <Text style={styles.settingSubtitle}>Remove cached data and scans</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#DF2E38" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={handleResetSettings}>
          <View style={styles.settingIcon}>
            <Ionicons name="refresh-outline" size={22} color="#5D9C59" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Reset Settings</Text>
            <Text style={styles.settingSubtitle}>Restore default settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <SectionHeader title="ABOUT" />
      <View style={styles.section}>
        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name="information-circle-outline" size={22} color="#5D9C59" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>App Version</Text>
            <Text style={styles.settingSubtitle}>1.0.0</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name="document-text-outline" size={22} color="#5D9C59" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Terms of Service</Text>
            <Text style={styles.settingSubtitle}>Read our terms</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#5D9C59" />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Privacy Policy</Text>
            <Text style={styles.settingSubtitle}>How we handle your data</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>SoilScan</Text>
        <Text style={styles.footerSubtext}>AI-Powered Soil Analysis</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A3C40',
  },
  placeholder: {
    width: 40,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c757d',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(93,156,89,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#6c757d',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5D9C59',
  },
  footerSubtext: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 4,
  },
});

export default SettingsScreen;
