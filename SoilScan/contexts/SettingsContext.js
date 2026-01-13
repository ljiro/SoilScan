import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@soilscan_settings';

const defaultSettings = {
  notifications: true,
  darkMode: false,
  locationServices: true,
  autoWeather: true,
  metricUnits: true,
  highAccuracyGPS: false,
};

const SettingsContext = createContext({
  settings: defaultSettings,
  updateSetting: () => {},
  resetSettings: () => {},
  isLoading: true,
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const resetSettings = async () => {
    setSettings(defaultSettings);
    await saveSettings(defaultSettings);
  };

  // Utility functions for unit conversion
  const formatTemperature = (celsius) => {
    if (settings.metricUnits) {
      return `${Math.round(celsius)}°C`;
    }
    const fahrenheit = (celsius * 9/5) + 32;
    return `${Math.round(fahrenheit)}°F`;
  };

  const formatDistance = (meters) => {
    if (settings.metricUnits) {
      if (meters >= 1000) {
        return `${(meters / 1000).toFixed(1)} km`;
      }
      return `${Math.round(meters)} m`;
    }
    const feet = meters * 3.28084;
    if (feet >= 5280) {
      return `${(feet / 5280).toFixed(1)} mi`;
    }
    return `${Math.round(feet)} ft`;
  };

  const formatArea = (squareMeters) => {
    if (settings.metricUnits) {
      if (squareMeters >= 10000) {
        return `${(squareMeters / 10000).toFixed(2)} ha`;
      }
      return `${Math.round(squareMeters)} m²`;
    }
    const acres = squareMeters / 4046.86;
    if (acres >= 1) {
      return `${acres.toFixed(2)} acres`;
    }
    const sqft = squareMeters * 10.7639;
    return `${Math.round(sqft)} sq ft`;
  };

  const value = {
    settings,
    updateSetting,
    resetSettings,
    isLoading,
    // Unit formatters
    formatTemperature,
    formatDistance,
    formatArea,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsContext;
