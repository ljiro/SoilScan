import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const GuideScreen = () => {
  const categories = [
    { icon: 'flask', title: 'Soil Types', desc: 'Learn to identify different soil classifications' },
    { icon: 'tint', title: 'Water Retention', desc: 'How different soils handle moisture' },
    { icon: 'seedling', title: 'Plant Compatibility', desc: 'Best plants for each soil type' },
    { icon: 'pencil-ruler', title: 'Soil Testing', desc: 'How to test your soil at home' },
    { icon: 'mortar-pestle', title: 'Amendments', desc: 'Improving your soil quality' },
    { icon: 'chart-line', title: 'pH Levels', desc: 'Understanding soil acidity' },
  ];

  const questions = [
    'How often should I test my soil?',
    'What\'s the best soil for vegetables?',
    'How to fix clay soil drainage?',
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Guide Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="book" size={20} color="#5D9C59" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Soil Guide</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Learn about different soil types and how to improve them for better plant growth.
        </Text>
        
        <View style={styles.grid}>
          {categories.map((item, index) => (
            <TouchableOpacity key={index} style={styles.guideCard}>
              <View style={styles.guideIcon}>
                <Icon name={item.icon} size={20} color="#5D9C59" />
              </View>
              <Text style={styles.guideTitle}>{item.title}</Text>
              <Text style={styles.guideDesc}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      
      {/* Common Questions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="question-circle" size={20} color="#5D9C59" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Common Questions</Text>
        </View>
        
        {questions.map((question, index) => (
          <View key={index} style={styles.questionItem}>
            <Icon name="question" size={16} color="#5D9C59" style={styles.questionIcon} />
            <View style={styles.questionInfo}>
              <Text style={styles.questionText}>{question}</Text>
            </View>
            <Icon name="chevron-right" size={16} color="#666" />
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A3C40',
  },
  sectionDescription: {
    color: '#666',
    marginBottom: 16,
  },
  sectionIcon: {
    marginRight: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  guideCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  guideIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#C7E8CA',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  guideTitle: {
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 4,
    textAlign: 'center',
  },
  guideDesc: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  questionIcon: {
    marginRight: 12,
  },
  questionInfo: {
    flex: 1,
  },
  questionText: {
    fontWeight: '600',
    color: '#1A3C40',
  },
});

export default GuideScreen;