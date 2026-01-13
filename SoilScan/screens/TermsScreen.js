import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TermsScreen = ({ navigation }) => {
  const Section = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionContent}>{children}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A3C40" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Last Updated: January 2026</Text>

        <Section title="1. Acceptance of Terms">
          By downloading, installing, or using SoilScan, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
        </Section>

        <Section title="2. Description of Service">
          SoilScan is an AI-powered mobile application that analyzes soil samples through image recognition technology. The app provides soil type classification, nutrient analysis suggestions, and fertilizer recommendations based on captured images and environmental data.
        </Section>

        <Section title="3. User Responsibilities">
          You are responsible for:{'\n\n'}
          - Providing accurate information when using the app{'\n'}
          - Ensuring proper soil sample photography following app guidelines{'\n'}
          - Using recommendations as guidance only, not as definitive agricultural advice{'\n'}
          - Maintaining the security of your device and account
        </Section>

        <Section title="4. Disclaimer of Warranties">
          SoilScan provides soil analysis and recommendations for informational purposes only. The accuracy of results depends on image quality, environmental conditions, and other factors. We do not guarantee:{'\n\n'}
          - 100% accuracy in soil classification{'\n'}
          - Specific crop yields based on recommendations{'\n'}
          - Compatibility with all soil types or conditions{'\n\n'}
          Always consult with agricultural professionals for critical farming decisions.
        </Section>

        <Section title="5. Limitation of Liability">
          SoilScan and its developers shall not be liable for any direct, indirect, incidental, or consequential damages arising from the use of this application, including but not limited to crop losses, financial damages, or environmental impacts.
        </Section>

        <Section title="6. Data Collection and Use">
          By using SoilScan, you consent to the collection of:{'\n\n'}
          - Soil sample images for analysis{'\n'}
          - Location data for weather and regional recommendations{'\n'}
          - Usage analytics to improve the service{'\n\n'}
          See our Privacy Policy for detailed information on data handling.
        </Section>

        <Section title="7. Intellectual Property">
          All content, features, and functionality of SoilScan, including but not limited to text, graphics, logos, and software, are the exclusive property of SoilScan and are protected by copyright, trademark, and other intellectual property laws.
        </Section>

        <Section title="8. Modifications to Service">
          We reserve the right to modify, suspend, or discontinue any part of the service at any time without prior notice. We may also update these Terms of Service periodically, and continued use of the app constitutes acceptance of any changes.
        </Section>

        <Section title="9. Governing Law">
          These Terms of Service shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
        </Section>

        <Section title="10. Contact Information">
          For questions about these Terms of Service, please contact us at:{'\n\n'}
          Email: support@soilscan.app{'\n'}
          Website: https://soilscan.app
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By using SoilScan, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
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
    marginBottom: 20,
    fontStyle: 'italic',
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
  footer: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 40,
  },
  footerText: {
    fontSize: 13,
    color: '#2E7D32',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default TermsScreen;
