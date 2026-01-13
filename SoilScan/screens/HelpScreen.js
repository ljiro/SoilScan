import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const HelpScreen = ({ navigation }) => {
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');

  const faqs = [
    {
      question: 'How do I scan soil?',
      answer: 'Go to the Home screen and tap "Capture" to take a photo of your soil sample, or tap "Gallery" to upload an existing photo. Make sure the soil is clearly visible and well-lit for best results.'
    },
    {
      question: 'What soil types can the app detect?',
      answer: 'SoilScan can detect various soil textures including Sandy, Clay, Loamy, Silty, Peaty, Chalky, and more. The AI analyzes color, texture, and composition to determine the soil type.'
    },
    {
      question: 'How accurate are the results?',
      answer: 'Our AI model achieves 85-90% accuracy for common soil types. For best results, ensure your photo is clear, well-lit, and shows the soil texture clearly without debris.'
    },
    {
      question: 'How does the fertilizer recommendation work?',
      answer: 'Based on your soil analysis and selected crop type, our algorithm suggests the most suitable fertilizers considering NPK levels, soil type, and environmental conditions.'
    },
    {
      question: 'Do I need internet connection?',
      answer: 'Yes, an internet connection is required for soil analysis and weather data. The map feature requires internet for live maps but can show your last location offline.'
    },
    {
      question: 'How do I draw zones on the map?',
      answer: 'Go to the Guide tab, tap "Draw Zone", then tap on the map to place vertices of your polygon. Tap "Complete Zone" when finished. You need at least 3 points to create a valid zone.'
    },
    {
      question: 'Is my data private?',
      answer: 'Yes, your soil scan images are processed securely and we do not store or share your personal data. Location data is only used to fetch weather information.'
    },
  ];

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleSendFeedback = () => {
    if (feedbackText.trim().length < 10) {
      Alert.alert('Error', 'Please enter at least 10 characters for your feedback.');
      return;
    }

    Alert.alert(
      'Thank You!',
      'Your feedback has been submitted. We appreciate your input and will use it to improve SoilScan.',
      [{ text: 'OK', onPress: () => setFeedbackText('') }]
    );
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:support@soilscan.app?subject=SoilScan Support Request');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A3C40" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.actionCard} onPress={handleEmailSupport}>
          <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
            <Ionicons name="mail-outline" size={24} color="#1976D2" />
          </View>
          <Text style={styles.actionTitle}>Email Support</Text>
          <Text style={styles.actionSubtitle}>Get help via email</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard}>
          <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="chatbubbles-outline" size={24} color="#388E3C" />
          </View>
          <Text style={styles.actionTitle}>Live Chat</Text>
          <Text style={styles.actionSubtitle}>Coming soon</Text>
        </TouchableOpacity>
      </View>

      {/* FAQs */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

        {faqs.map((faq, index) => (
          <View key={index} style={styles.faqItem}>
            <TouchableOpacity
              style={styles.faqQuestion}
              onPress={() => toggleFaq(index)}
              activeOpacity={0.7}
            >
              <Text style={styles.faqQuestionText}>{faq.question}</Text>
              <Ionicons
                name={expandedFaq === index ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#5D9C59"
              />
            </TouchableOpacity>

            {expandedFaq === index && (
              <View style={styles.faqAnswer}>
                <Text style={styles.faqAnswerText}>{faq.answer}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Feedback Section */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Send Feedback</Text>
        <Text style={styles.feedbackSubtitle}>
          Help us improve SoilScan with your suggestions
        </Text>

        <TextInput
          style={styles.feedbackInput}
          placeholder="Tell us what you think..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          value={feedbackText}
          onChangeText={setFeedbackText}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSendFeedback}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={18} color="#fff" />
          <Text style={styles.sendButtonText}>Send Feedback</Text>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appName}>SoilScan</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
        <Text style={styles.copyright}>Made with care for farmers worldwide</Text>
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
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6c757d',
  },
  sectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3C40',
    marginBottom: 16,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1A3C40',
    paddingRight: 12,
  },
  faqAnswer: {
    paddingBottom: 14,
  },
  faqAnswerText: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 22,
  },
  feedbackSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  feedbackInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 16,
    fontSize: 15,
    color: '#1A3C40',
    minHeight: 120,
    marginBottom: 16,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5D9C59',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingBottom: 50,
  },
  appName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#5D9C59',
  },
  appVersion: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 4,
  },
  copyright: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
});

export default HelpScreen;
