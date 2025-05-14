import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const CropRecommendationScreen = () => {
  const [soilParams, setSoilParams] = useState({
    nitrogen: '',
    phosphorus: '',
    potassium: '',
    pH: '',
    moisture: '',
    temperature: ''
  });
  const [recommendations, setRecommendations] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (name, value) => {
    setSoilParams(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getRecommendations = () => {
    // This would be replaced with actual API call or algorithm
    const mockRecommendations = [
      { name: 'Corn', suitability: 'Highly Suitable', icon: 'leaf' },
      { name: 'Wheat', suitability: 'Moderately Suitable', icon: 'wheat' },
      { name: 'Soybeans', suitability: 'Suitable', icon: 'tree' },
      { name: 'Rice', suitability: 'Marginally Suitable', icon: 'tint' }
    ];
    setRecommendations(mockRecommendations);
    setIsSubmitted(true);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="pagelines" size={20} color="#5D9C59" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Crop Recommendation</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Enter your soil test results to get personalized crop recommendations.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Nitrogen (N) ppm</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={soilParams.nitrogen}
            onChangeText={(text) => handleInputChange('nitrogen', text)}
            placeholder="Enter nitrogen level"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phosphorus (P) ppm</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={soilParams.phosphorus}
            onChangeText={(text) => handleInputChange('phosphorus', text)}
            placeholder="Enter phosphorus level"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Potassium (K) ppm</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={soilParams.potassium}
            onChangeText={(text) => handleInputChange('potassium', text)}
            placeholder="Enter potassium level"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Soil pH</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={soilParams.pH}
            onChangeText={(text) => handleInputChange('pH', text)}
            placeholder="Enter pH (0-14)"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Moisture (%)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={soilParams.moisture}
            onChangeText={(text) => handleInputChange('moisture', text)}
            placeholder="Enter moisture percentage"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Temperature (°C)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={soilParams.temperature}
            onChangeText={(text) => handleInputChange('temperature', text)}
            placeholder="Enter average temperature"
          />
        </View>

        <TouchableOpacity 
          style={styles.submitButton}
          onPress={getRecommendations}
        >
          <Text style={styles.submitButtonText}>Get Recommendations</Text>
        </TouchableOpacity>

        {isSubmitted && (
          <View style={styles.resultsSection}>
            <View style={styles.sectionHeader}>
              <Icon name="lightbulb-o" size={20} color="#5D9C59" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Recommended Crops</Text>
            </View>

            {recommendations.map((crop, index) => (
              <View key={index} style={styles.cropCard}>
                <View style={styles.cropHeader}>
                  <Icon name={crop.icon} size={24} color="#5D9C59" />
                  <Text style={styles.cropName}>{crop.name}</Text>
                </View>
                <View style={[
                  styles.suitabilityBadge,
                  crop.suitability === 'Highly Suitable' && styles.highlySuitable,
                  crop.suitability === 'Moderately Suitable' && styles.moderatelySuitable,
                  crop.suitability === 'Suitable' && styles.suitable,
                  crop.suitability === 'Marginally Suitable' && styles.marginallySuitable
                ]}>
                  <Text style={styles.suitabilityText}>{crop.suitability}</Text>
                </View>
                <Text style={styles.cropDescription}>
                  This crop thrives in soil with {soilParams.nitrogen}ppm nitrogen, 
                  {soilParams.phosphorus}ppm phosphorus, and pH around {soilParams.pH}.
                </Text>
              </View>
            ))}
          </View>
        )}
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#1A3C40',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#5D9C59',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  resultsSection: {
    marginTop: 24,
  },
  cropCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cropHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cropName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A3C40',
    marginLeft: 12,
  },
  suitabilityBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  highlySuitable: {
    backgroundColor: '#e6f7e6',
  },
  moderatelySuitable: {
    backgroundColor: '#fff8e6',
  },
  suitable: {
    backgroundColor: '#e6f3ff',
  },
  marginallySuitable: {
    backgroundColor: '#ffe6e6',
  },
  suitabilityText: {
    fontWeight: '500',
  },
  cropDescription: {
    color: '#666',
    lineHeight: 20,
  },
});

export default CropRecommendationScreen;