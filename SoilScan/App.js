import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StatusBar, View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// Screens
import HomeScreen from './screens/HomeScreen';
import GuideScreen from './screens/GuideScreen';
import MapScreen from './screens/FertilizerRecommendationScreen';
import ProfileScreen from './screens/ProfileScreen';
import CameraScreen from './screens/CameraScreen';
import SettingsScreen from './screens/SettingsScreen';
import HelpScreen from './screens/HelpScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import TermsScreen from './screens/TermsScreen';
import PrivacyScreen from './screens/PrivacyScreen';

// Contexts
import { NetworkProvider, SettingsProvider } from './contexts';

// Storage utilities
import { hasAcceptedConsent } from './utils/storage';

// Notifications
import {
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from './services/notifications';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Tab Navigator component
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Guide') {
            iconName = focused ? 'map' : 'map-outline';
          } else if (route.name === 'Fertilizer') {
            iconName = focused ? 'leaf' : 'leaf-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#5D9C59',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 0,
          elevation: 10,
          shadowOpacity: 0.1,
          shadowRadius: 10,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#5D9C59',
        },
        headerTintColor: 'white',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'SoilScan',
        }}
      />
      <Tab.Screen
        name="Guide"
        component={GuideScreen}
        options={{
          title: 'Map',
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="Fertilizer"
        component={MapScreen}
        options={{
          title: 'Fertilizer',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasConsent, setHasConsent] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState('');
  const notificationListener = useRef();
  const responseListener = useRef();
  const navigationRef = useRef();

  useEffect(() => {
    checkConsentStatus();
  }, []);

  // Initialize notifications after consent is accepted
  useEffect(() => {
    if (hasConsent) {
      // Register for push notifications
      registerForPushNotifications().then(token => {
        if (token) {
          setExpoPushToken(token);
          console.log('Push token:', token);
        }
      });

      // Listen for incoming notifications while app is foregrounded
      notificationListener.current = addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
      });

      // Listen for notification taps
      responseListener.current = addNotificationResponseListener(response => {
        console.log('Notification response:', response);
        const data = response.notification.request.content.data;

        // Navigate based on notification type
        if (data?.type === 'scan_complete') {
          navigationRef.current?.navigate('Home');
        } else if (data?.type === 'fertilizer_reminder') {
          navigationRef.current?.navigate('Fertilizer');
        }
      });

      return () => {
        if (notificationListener.current) {
          notificationListener.current.remove();
        }
        if (responseListener.current) {
          responseListener.current.remove();
        }
      };
    }
  }, [hasConsent]);

  const checkConsentStatus = async () => {
    try {
      const consentAccepted = await hasAcceptedConsent();
      setHasConsent(consentAccepted);
    } catch (error) {
      console.error('Error checking consent status:', error);
      setHasConsent(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsentAccepted = () => {
    setHasConsent(true);
  };

  // Show loading screen while checking consent
  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar backgroundColor="#5D9C59" barStyle="light-content" />
        <View style={styles.loadingContent}>
          <Ionicons name="scan" size={60} color="#5D9C59" />
          <ActivityIndicator size="large" color="#5D9C59" style={styles.loader} />
        </View>
      </SafeAreaView>
    );
  }

  // Show onboarding if consent not yet accepted
  if (!hasConsent) {
    return (
      <SettingsProvider>
        <NetworkProvider>
          <SafeAreaView style={{ flex: 1 }}>
            <StatusBar backgroundColor="#5D9C59" barStyle="light-content" />
            <OnboardingScreen onConsentAccepted={handleConsentAccepted} />
          </SafeAreaView>
        </NetworkProvider>
      </SettingsProvider>
    );
  }

  // Show main app after consent accepted
  return (
    <SettingsProvider>
      <NetworkProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <StatusBar backgroundColor="#5D9C59" barStyle="light-content" />
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="MainTabs" component={TabNavigator} />
              <Stack.Screen
                name="Camera"
                component={CameraScreen}
                options={{
                  animation: 'slide_from_bottom',
                  presentation: 'fullScreenModal',
                }}
              />
              <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="Help"
                component={HelpScreen}
                options={{
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="Terms"
                component={TermsScreen}
                options={{
                  animation: 'slide_from_right',
                }}
              />
              <Stack.Screen
                name="Privacy"
                component={PrivacyScreen}
                options={{
                  animation: 'slide_from_right',
                }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaView>
      </NetworkProvider>
    </SettingsProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    marginTop: 20,
  },
});

export default App;
