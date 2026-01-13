import React, { useState, useEffect } from 'react';
import { SafeAreaView, StatusBar, View, ActivityIndicator, StyleSheet } from 'react-native';
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

// Storage utilities
import { hasAcceptedConsent } from './utils/storage';

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

  useEffect(() => {
    checkConsentStatus();
  }, []);

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
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar backgroundColor="#5D9C59" barStyle="light-content" />
        <OnboardingScreen onConsentAccepted={handleConsentAccepted} />
      </SafeAreaView>
    );
  }

  // Show main app after consent accepted
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar backgroundColor="#5D9C59" barStyle="light-content" />
      <NavigationContainer>
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
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
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
