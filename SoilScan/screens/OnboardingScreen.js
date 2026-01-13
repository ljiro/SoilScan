import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { acceptConsent } from '../utils/storage';

const { width, height } = Dimensions.get('window');

const OnboardingScreen = ({ onConsentAccepted }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const checkboxScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleCheckboxPress = () => {
    Animated.sequence([
      Animated.spring(checkboxScale, {
        toValue: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(checkboxScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
    setAgreementChecked(!agreementChecked);
  };

  const handleAcceptConsent = async () => {
    if (!agreementChecked) {
      Alert.alert(
        'Agreement Required',
        'Please check the box to confirm you agree to the storage terms before continuing.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsAccepting(true);
    const success = await acceptConsent();

    if (success) {
      onConsentAccepted();
    } else {
      Alert.alert(
        'Error',
        'Failed to save your consent. Please try again.',
        [{ text: 'OK' }]
      );
      setIsAccepting(false);
    }
  };

  const pages = [
    {
      icon: 'leaf',
      title: 'Welcome to SoilScan',
      description: 'Your AI-powered soil analysis companion for smarter farming decisions.',
    },
    {
      icon: 'camera',
      title: 'Capture & Analyze',
      description: 'Take photos of your soil samples and get instant texture classification with fertilizer recommendations.',
    },
    {
      icon: 'shield-checkmark',
      title: 'Your Data, Your Control',
      description: 'We store your scan photos and analysis logs privately on your device. Nothing is shared without your permission.',
    },
  ];

  const renderPage = (page, index) => (
    <View key={index} style={styles.pageContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name={page.icon} size={80} color="#5D9C59" />
      </View>
      <Text style={styles.pageTitle}>{page.title}</Text>
      <Text style={styles.pageDescription}>{page.description}</Text>
    </View>
  );

  const renderPagination = () => (
    <View style={styles.paginationContainer}>
      {pages.map((_, index) => (
        <View
          key={index}
          style={[
            styles.paginationDot,
            currentPage === index && styles.paginationDotActive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <LinearGradient colors={['#F8F9FA', '#E8F5E9', '#F8F9FA']} style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo */}
        <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
          <View style={styles.logoCircle}>
            <Ionicons name="scan" size={48} color="white" />
          </View>
          <Text style={styles.logoText}>SoilScan</Text>
        </Animated.View>

        {/* Swipeable Pages */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const page = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrentPage(page);
          }}
          style={styles.scrollView}
        >
          {pages.map(renderPage)}
        </ScrollView>

        {renderPagination()}

        {/* Storage Agreement Section */}
        <View style={styles.agreementSection}>
          <Text style={styles.agreementTitle}>Storage Agreement</Text>

          <ScrollView style={styles.agreementScrollView} nestedScrollEnabled>
            <Text style={styles.agreementText}>
              By using SoilScan, you agree to the following terms regarding data storage:
            </Text>

            <View style={styles.agreementItem}>
              <Ionicons name="folder" size={20} color="#5D9C59" />
              <Text style={styles.agreementItemText}>
                <Text style={styles.bold}>Photo Storage:</Text> Soil sample photos you capture will be stored privately within the app's sandbox on your device.
              </Text>
            </View>

            <View style={styles.agreementItem}>
              <Ionicons name="document-text" size={20} color="#5D9C59" />
              <Text style={styles.agreementItemText}>
                <Text style={styles.bold}>Scan Logs:</Text> Analysis results, timestamps, and soil data will be logged locally to track your scanning history.
              </Text>
            </View>

            <View style={styles.agreementItem}>
              <Ionicons name="lock-closed" size={20} color="#5D9C59" />
              <Text style={styles.agreementItemText}>
                <Text style={styles.bold}>Privacy:</Text> All data remains on your device. Uninstalling the app will permanently delete all stored data.
              </Text>
            </View>

            <View style={styles.agreementItem}>
              <Ionicons name="trash" size={20} color="#5D9C59" />
              <Text style={styles.agreementItemText}>
                <Text style={styles.bold}>Data Control:</Text> You can clear all stored data at any time from the Settings screen.
              </Text>
            </View>
          </ScrollView>

          {/* Checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={handleCheckboxPress}
            activeOpacity={0.7}
          >
            <Animated.View
              style={[
                styles.checkbox,
                agreementChecked && styles.checkboxChecked,
                { transform: [{ scale: checkboxScale }] },
              ]}
            >
              {agreementChecked && (
                <Ionicons name="checkmark" size={18} color="white" />
              )}
            </Animated.View>
            <Text style={styles.checkboxLabel}>
              I agree to the storage terms and understand my data will be stored locally on this device.
            </Text>
          </TouchableOpacity>
        </View>

        {/* Accept Button */}
        <TouchableOpacity
          style={[
            styles.acceptButton,
            !agreementChecked && styles.acceptButtonDisabled,
          ]}
          onPress={handleAcceptConsent}
          disabled={isAccepting}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={agreementChecked ? ['#5D9C59', '#4A7C47'] : ['#BDBDBD', '#9E9E9E']}
            style={styles.acceptButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {isAccepting ? (
              <Text style={styles.acceptButtonText}>Setting up...</Text>
            ) : (
              <>
                <Text style={styles.acceptButtonText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          You can manage your data preferences in Settings at any time.
        </Text>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#5D9C59',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A3C40',
    marginTop: 12,
  },
  scrollView: {
    maxHeight: 180,
  },
  pageContainer: {
    width: width - 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(93, 156, 89, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A3C40',
    textAlign: 'center',
    marginBottom: 8,
  },
  pageDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BDBDBD',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#5D9C59',
    width: 24,
  },
  agreementSection: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxHeight: height * 0.35,
  },
  agreementTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A3C40',
    marginBottom: 12,
  },
  agreementScrollView: {
    maxHeight: 150,
  },
  agreementText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  agreementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingRight: 8,
  },
  agreementItemText: {
    flex: 1,
    fontSize: 13,
    color: '#444',
    marginLeft: 10,
    lineHeight: 18,
  },
  bold: {
    fontWeight: 'bold',
    color: '#1A3C40',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#5D9C59',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#5D9C59',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  acceptButton: {
    marginTop: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#5D9C59',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  acceptButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginRight: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
});

export default OnboardingScreen;
