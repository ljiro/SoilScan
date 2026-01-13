import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PrivacyScreen = ({ navigation }) => {
  const Section = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionContent}>{children}</Text>
    </View>
  );

  const DataItem = ({ icon, title, description }) => (
    <View style={styles.dataItem}>
      <View style={styles.dataIcon}>
        <Ionicons name={icon} size={20} color="#5D9C59" />
      </View>
      <View style={styles.dataContent}>
        <Text style={styles.dataTitle}>{title}</Text>
        <Text style={styles.dataDescription}>{description}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A3C40" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last Updated: January 2026</Text>

        <View style={styles.introBox}>
          <Ionicons name="shield-checkmark" size={32} color="#5D9C59" />
          <Text style={styles.introText}>
            Your privacy is important to us. This policy explains how SoilScan collects, uses, and protects your information.
          </Text>
        </View>

        <Section title="Information We Collect">
          SoilScan collects the following types of information to provide and improve our services:
        </Section>

        <View style={styles.dataList}>
          <DataItem
            icon="camera-outline"
            title="Soil Images"
            description="Photos you capture for soil analysis are processed locally and may be sent to our servers for enhanced analysis."
          />
          <DataItem
            icon="location-outline"
            title="Location Data"
            description="GPS coordinates are used to fetch weather data and provide region-specific recommendations. Location is only accessed when you use relevant features."
          />
          <DataItem
            icon="analytics-outline"
            title="Usage Analytics"
            description="Anonymous usage statistics help us understand how the app is used and improve features."
          />
          <DataItem
            icon="phone-portrait-outline"
            title="Device Information"
            description="Basic device info (OS version, app version) helps us ensure compatibility and troubleshoot issues."
          />
        </View>

        <Section title="How We Use Your Information">
          We use collected information to:{'\n\n'}
          - Analyze soil samples and provide recommendations{'\n'}
          - Fetch accurate weather data for your location{'\n'}
          - Improve our AI models and app performance{'\n'}
          - Send important notifications (if enabled){'\n'}
          - Provide customer support
        </Section>

        <Section title="Data Storage and Security">
          - Soil images and scan history are stored locally on your device{'\n'}
          - Data transmitted to our servers is encrypted using industry-standard protocols{'\n'}
          - We do not sell your personal information to third parties{'\n'}
          - Anonymous, aggregated data may be used for research purposes
        </Section>

        <Section title="Third-Party Services">
          SoilScan uses the following third-party services:{'\n\n'}
          - OpenWeatherMap API for weather data{'\n'}
          - Google Maps for location services{'\n'}
          - Expo push notification services{'\n\n'}
          These services have their own privacy policies governing data use.
        </Section>

        <Section title="Your Rights">
          You have the right to:{'\n\n'}
          - Access the data we have about you{'\n'}
          - Request deletion of your data{'\n'}
          - Opt out of analytics collection{'\n'}
          - Disable location services at any time{'\n'}
          - Turn off push notifications
        </Section>

        <Section title="Data Retention">
          - Local scan history is retained until you clear app data{'\n'}
          - Server-side data is automatically deleted after 90 days{'\n'}
          - Account data is deleted upon request or account termination
        </Section>

        <Section title="Children's Privacy">
          SoilScan is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13.
        </Section>

        <Section title="Changes to This Policy">
          We may update this Privacy Policy from time to time. We will notify you of significant changes through the app or via email. Continued use after changes constitutes acceptance of the updated policy.
        </Section>

        <Section title="Contact Us">
          If you have questions about this Privacy Policy or our data practices, please contact us:{'\n\n'}
          Email: privacy@soilscan.app{'\n'}
          Website: https://soilscan.app/privacy
        </Section>

        <View style={styles.footer}>
          <Ionicons name="lock-closed" size={20} color="#2E7D32" />
          <Text style={styles.footerText}>
            Your data is protected and handled with care.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3C40',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  lastUpdated: {
    fontSize: 13,
    color: '#6C757D',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  introBox: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  introText: {
    fontSize: 14,
    color: '#2E7D32',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A3C40',
    marginBottom: 10,
  },
  sectionContent: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 22,
  },
  dataList: {
    marginBottom: 24,
  },
  dataItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dataIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(93,156,89,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  dataContent: {
    flex: 1,
  },
  dataTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 4,
  },
  dataDescription: {
    fontSize: 13,
    color: '#6C757D',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 40,
    gap: 10,
  },
  footerText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
});

export default PrivacyScreen;
