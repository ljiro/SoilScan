import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import HomeScreen from './src/screens/HomeScreen';
import CaptureScreen from './src/screens/CaptureScreen';
import SetupScreen from './src/screens/SetupScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import DataViewerScreen from './src/screens/DataViewerScreen';
import ExportScreen from './src/screens/ExportScreen';
import SoilTestScreen from './src/screens/SoilTestScreen';
// SyncScreen removed - export/share functionality no longer needed
import PermissionOnboarding from './src/screens/PermissionOnboarding';
import OnboardingGuide from './src/screens/OnboardingGuide';
import TermsAgreement, { hasAcceptedTerms } from './src/screens/TermsAgreement';
import GlassTabBar from './src/components/GlassTabBar';
import NetworkMonitor from './src/components/NetworkMonitor';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { PermissionProvider } from './src/contexts/PermissionContext';
import { isOnboardingComplete } from './src/services/permissionService';
import { loadConfig, initializeAppDirectories, clearExpiredCache, verifyAndInitializeStorage } from './src/services/storageService';
import { initCSV, verifyCSVStorage } from './src/services/csvService';

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showTermsAgreement, setShowTermsAgreement] = useState(false);
  const [showPermissionOnboarding, setShowPermissionOnboarding] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  const initializeApp = async () => {
    try {
      console.log('[App] === Initializing App ===');
      
      // Initialize app directories on startup (with retry logic for APK builds)
      console.log('[App] Step 1: Initializing app directories...');
      const dirResult = await initializeAppDirectories();
      if (!dirResult.success) {
        console.error('[App] Directory initialization had errors:', dirResult.errors);
        // Continue anyway - will retry after permissions
      } else {
        console.log('[App] ✓ Directories initialized successfully');
      }

      // Clear expired cache items
      console.log('[App] Step 2: Clearing expired cache...');
      await clearExpiredCache();

      // Check if terms have been accepted
      const termsAccepted = await hasAcceptedTerms();
      if (!termsAccepted) {
        setShowTermsAgreement(true);
        setIsLoading(false);
        return;
      }

      // Check if permission onboarding is complete
      const permissionComplete = await isOnboardingComplete();
      setShowPermissionOnboarding(!permissionComplete);

      // When user has already completed onboarding, re-verify storage on every app start
      // so we pick up external storage if they enabled "Manage all files" later
      if (permissionComplete) {
        try {
          const storageResult = await verifyAndInitializeStorage();
          if (storageResult.success && storageResult.storageLocation === 'external') {
            console.log('[App] ✓ Using external storage at startup:', storageResult.storagePath);
          }
        } catch (e) {
          console.warn('[App] Storage re-verify at startup:', e?.message);
        }
        const config = await loadConfig('user_config');
        setShowGuide(!config?.guideCompleted);
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      setShowTermsAgreement(true);
    }
    setIsLoading(false);
  };

  const handleTermsAccepted = async () => {
    setShowTermsAgreement(false);
    // After terms accepted, ALWAYS show permission onboarding
    // This ensures proper flow: Terms -> Permissions -> Guide
    setShowPermissionOnboarding(true);
  };

  const handlePermissionComplete = async (_permissions) => {
    console.log('[App] Permissions granted, initializing storage...');

    try {
      // CRITICAL: Re-initialize storage AFTER permissions are granted
      // This ensures directories are created with proper permissions and in device storage
      console.log('[App] Attempting to use device storage (external storage)...');
      const storageResult = await verifyAndInitializeStorage();
      console.log('[App] Storage initialization result:', JSON.stringify(storageResult));
      console.log('[App] Storage location:', storageResult.storageLocation || 'internal');
      console.log('[App] Storage path:', storageResult.storagePath || 'not set');

      if (!storageResult.success) {
        console.error('[App] Storage initialization failed:', storageResult.errors);
        // Continue anyway - HomeScreen will also try to init
      }

      // Initialize CSV file with headers
      const csvResult = await initCSV();
      console.log('[App] CSV initialization result:', JSON.stringify(csvResult));

      if (!csvResult.success) {
        console.error('[App] CSV initialization failed:', csvResult.error);
      }

      // Run diagnostics to verify everything is working
      const csvDiagnostics = await verifyCSVStorage();
      console.log('[App] CSV diagnostics:', JSON.stringify(csvDiagnostics));

      if (!csvDiagnostics.canWrite || !csvDiagnostics.canRead) {
        console.error('[App] CSV storage not fully functional!');
        console.error('[App] canWrite:', csvDiagnostics.canWrite);
        console.error('[App] canRead:', csvDiagnostics.canRead);
        console.error('[App] errors:', csvDiagnostics.errors);
      }
    } catch (error) {
      console.error('[App] Post-permission initialization error:', error);
      // Continue anyway - individual screens will also try to init
    }

    setShowPermissionOnboarding(false);
    // Show guide after permissions are granted
    setShowGuide(true);
  };

  const handleGuideComplete = () => {
    setShowGuide(false);
  };

  if (!fontsLoaded || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // Show terms agreement first (before any other onboarding)
  if (showTermsAgreement) {
    return (
      <PermissionProvider>
        <StatusBar style="dark" />
        <TermsAgreement onAccept={handleTermsAccepted} />
      </PermissionProvider>
    );
  }

  // Show permission onboarding after terms are accepted
  if (showPermissionOnboarding) {
    return (
      <PermissionProvider>
        <StatusBar style="dark" />
        <PermissionOnboarding onComplete={handlePermissionComplete} />
      </PermissionProvider>
    );
  }

  // Show guide after permissions are granted
  if (showGuide) {
    return (
      <PermissionProvider>
        <StatusBar style="dark" />
        <OnboardingGuide onComplete={handleGuideComplete} />
      </PermissionProvider>
    );
  }

  return (
    <PermissionProvider>
      <NetworkProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <Tab.Navigator
              initialRouteName="Home"
              tabBar={(props) => <GlassTabBar {...props} />}
              screenOptions={{
                headerShown: false,
              }}
            >
              <Tab.Screen name="Home" component={HomeScreen} />
              <Tab.Screen name="Capture" component={CaptureScreen} />
              <Tab.Screen name="Review" component={ReviewScreen} />
              <Tab.Screen name="Data" component={DataViewerScreen} />
              <Tab.Screen name="Export" component={ExportScreen} />
              <Tab.Screen name="SoilTest" component={SoilTestScreen} />
              <Tab.Screen name="Setup" component={SetupScreen} />
            </Tab.Navigator>
            <NetworkMonitor />
          </NavigationContainer>
        </SafeAreaProvider>
      </NetworkProvider>
    </PermissionProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
