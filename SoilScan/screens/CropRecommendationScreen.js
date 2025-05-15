import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const CropRecommendationScreen = () => {
  const [soilParams, setSoilParams] = useState({
    N: '',
    P: '',
    K: '',
    temperature: '',
    humidity: '',
    ph: '',
    rainfall: ''
  });
  const [recommendations, setRecommendations] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (name, value) => {
    setSoilParams(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Validate inputs
      if (!soilParams.N || !soilParams.P || !soilParams.K || 
          !soilParams.ph || !soilParams.temperature || 
          !soilParams.humidity || !soilParams.rainfall) {
        throw new Error('Please fill all fields');
      }

      // Prepare data for API call
      const inputData = {
        N: parseFloat(soilParams.N),
        P: parseFloat(soilParams.P),
        K: parseFloat(soilParams.K),
        temperature: parseFloat(soilParams.temperature),
        humidity: parseFloat(soilParams.humidity),
        ph: parseFloat(soilParams.ph),
        rainfall: parseFloat(soilParams.rainfall)
      };

      // This would be replaced with actual API call to your model endpoint
      const response = await fetch('YOUR_MODEL_API_ENDPOINT', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        throw new Error('Failed to get recommendations');
      }

      const data = await response.json();
      
      // Process model output - adapt this based on your model's response format
      const processedRecommendations = data.predictions.map((prediction, index) => {
        // Determine suitability level based on probability or score
        let suitability;
        if (prediction.score > 0.8) suitability = 'Highly Suitable';
        else if (prediction.score > 0.6) suitability = 'Moderately Suitable';
        else if (prediction.score > 0.4) suitability = 'Suitable';
        else suitability = 'Marginally Suitable';

        return {
          name: prediction.crop_name,
          suitability,
          score: prediction.score,
          description: `Predicted suitability score: ${(prediction.score * 100).toFixed(1)}%`,
          icon: getCropIcon(prediction.crop_name)
        };
      });

      setRecommendations(processedRecommendations);
      setIsSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get appropriate icons for different crops
  const getCropIcon = (cropName) => {
    const icons = {
      'corn': 'leaf',
      'wheat': 'wheat',
      'rice': 'tint',
      'soybean': 'tree',
      'barley': 'bar-chart',
      'potato': 'pagelines',
      'tomato': 'apple',
      'cotton': 'th',
      // Add more crop-icon mappings as needed
    };

    return icons[cropName.toLowerCase()] || 'pagelines';
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="pagelines" size={20} color="#5D9C59" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Crop Recommendation</Text>
        </View>
        <Text style={styles.sectionDescription}>
          Enter your soil and weather parameters to get personalized crop recommendations.
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Icon name="exclamation-circle" size={16} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Soil Parameters */}
        <View style={styles.subSection}>
          <Text style={styles.subSectionTitle}>Soil Parameters</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nitrogen (N) level (ppm)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={soilParams.N}
              onChangeText={(text) => handleInputChange('N', text)}
              placeholder="Enter N level"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phosphorus (P) level (ppm)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={soilParams.P}
              onChangeText={(text) => handleInputChange('P', text)}
              placeholder="Enter P level"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Potassium (K) level (ppm)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={soilParams.K}
              onChangeText={(text) => handleInputChange('K', text)}
              placeholder="Enter K level"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Soil pH</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={soilParams.ph}
              onChangeText={(text) => handleInputChange('ph', text)}
              placeholder="Enter pH (0-14)"
            />
          </View>
        </View>

        {/* Weather Parameters */}
        <View style={styles.subSection}>
          <Text style={styles.subSectionTitle}>Weather Parameters</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Temperature (°C)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={soilParams.temperature}
              onChangeText={(text) => handleInputChange('temperature', text)}
              placeholder="Enter temperature"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Humidity (%)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={soilParams.humidity}
              onChangeText={(text) => handleInputChange('humidity', text)}
              placeholder="Enter humidity"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Rainfall (mm)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={soilParams.rainfall}
              onChangeText={(text) => handleInputChange('rainfall', text)}
              placeholder="Enter rainfall"
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.submitButton}
          onPress={getRecommendations}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitButtonText}>Get Recommendations</Text>
          )}
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
                  {crop.description}
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
  subSection: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 12,
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#D32F2F',
    marginLeft: 8,
  },
});

export default CropRecommendationScreen;