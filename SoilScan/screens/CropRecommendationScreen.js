import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const API_ENDPOINT = 'https://soilscanMLtraining-soilscan-api2.hf.space/predict-crop';

const CropRecommendationScreen = ({ route }) => {
  // Get soil texture from navigation params
  const { soilTexture } = route.params || {};

  const [soilParams, setSoilParams] = useState({
    texture: soilTexture || '',
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
  const [soilTextures, setSoilTextures] = useState([
    'Sandy', 'Clay', 'Silt', 'Loam', 'Peaty', 
    'Chalky', 'Sandy Loam', 'Clay Loam', 'Silty Loam'
  ]);

  useEffect(() => {
    // If soil texture was passed, update the form field
    if (soilTexture) {
      setSoilParams(prev => ({
        ...prev,
        texture: soilTexture
      }));
    }
  }, [soilTexture]);

  const handleInputChange = (name, value) => {
    setSoilParams(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateInputs = () => {
    const requiredFields = ['texture', 'N', 'P', 'K', 'ph', 'temperature', 'humidity', 'rainfall'];
    const emptyFields = requiredFields.filter(field => !soilParams[field]);
    
    if (emptyFields.length > 0) {
      setError(`Please fill all fields: ${emptyFields.join(', ')}`);
      return false;
    }

    // Validate numeric fields
    const numericFields = ['N', 'P', 'K', 'ph', 'temperature', 'humidity', 'rainfall'];
    for (const field of numericFields) {
      if (isNaN(parseFloat(soilParams[field]))) {
        setError(`Please enter a valid number for ${field}`);
        return false;
      }
    }

    // Validate pH range
    if (parseFloat(soilParams.ph) < 0 || parseFloat(soilParams.ph) > 14) {
      setError('pH must be between 0 and 14');
      return false;
    }

    return true;
  };

  const getRecommendations = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const inputData = {
        texture: soilParams.texture,
        N: parseFloat(soilParams.N),
        P: parseFloat(soilParams.P),
        K: parseFloat(soilParams.K),
        temperature: parseFloat(soilParams.temperature),
        humidity: parseFloat(soilParams.humidity),
        ph: parseFloat(soilParams.ph),
        rainfall: parseFloat(soilParams.rainfall)
      };

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.predictions || !Array.isArray(data.predictions)) {
        throw new Error('Invalid response format from server');
      }

      // Process recommendations with detailed information
      const processedRecommendations = data.predictions.map((prediction, index) => {
        // Calculate suitability based on confidence score
        const score = prediction.score || prediction.confidence || 0;
        let suitability;
        let suitabilityColor;
        
        if (score > 0.8) {
          suitability = 'Highly Suitable';
          suitabilityColor = '#4CAF50'; // Green
        } else if (score > 0.6) {
          suitability = 'Moderately Suitable';
          suitabilityColor = '#8BC34A'; // Light Green
        } else if (score > 0.4) {
          suitability = 'Suitable';
          suitabilityColor = '#FFC107'; // Amber
        } else {
          suitability = 'Marginally Suitable';
          suitabilityColor = '#FF9800'; // Orange
        }

        return {
          name: prediction.crop_name || `Crop ${index + 1}`,
          suitability,
          suitabilityColor,
          score: parseFloat(score.toFixed(2)),
          probability: `${(score * 100).toFixed(1)}%`,
          description: prediction.description || 'No additional information available.',
          benefits: prediction.benefits || ['Good yield potential'],
          challenges: prediction.challenges || ['May require specific conditions'],
          icon: getCropIcon(prediction.crop_name)
        };
      });

      // Sort by score (descending)
      processedRecommendations.sort((a, b) => b.score - a.score);
      
      setRecommendations(processedRecommendations);
      setIsSubmitted(true);

    } catch (err) {
      console.error('Recommendation Error:', err);
      setError(err.message || 'Failed to get recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  const getCropIcon = (cropName) => {
    if (!cropName) return 'pagelines';
    
    const cropIcons = {
      'corn': 'corn',
      'wheat': 'wheat',
      'rice': 'rice',
      'soybean': 'soybean',
      'barley': 'barley',
      'potato': 'potato',
      'tomato': 'tomato',
      'cotton': 'cotton',
      'vegetable': 'carrot',
      'fruit': 'apple',
      'legume': 'seedling',
      'grape': 'grapes',
      'coffee': 'coffee',
      'tea': 'leaf',
    };

    const lowerName = cropName.toLowerCase();
    for (const [key, icon] of Object.entries(cropIcons)) {
      if (lowerName.includes(key)) {
        return icon;
      }
    }

    return 'pagelines'; // default icon
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
          {soilTexture && ` Detected soil texture: ${soilTexture}`}
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Icon name="exclamation-circle" size={16} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Soil Parameters Section */}
        <View style={styles.subSection}>
          <Text style={styles.subSectionTitle}>Soil Parameters</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Soil Texture</Text>
            <View style={styles.textureContainer}>
              {soilTextures.map((texture) => (
                <TouchableOpacity
                  key={texture}
                  style={[
                    styles.texturePill,
                    soilParams.texture === texture && styles.selectedTexturePill
                  ]}
                  onPress={() => handleInputChange('texture', texture)}
                >
                  <Text style={[
                    styles.texturePillText,
                    soilParams.texture === texture && styles.selectedTexturePillText
                  ]}>
                    {texture}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={soilParams.texture}
              onChangeText={(text) => handleInputChange('texture', text)}
              placeholder="Or enter custom texture"
            />
          </View>

          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, styles.inputGroupSmall]}>
              <Text style={styles.inputLabel}>Nitrogen (N) ppm</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={soilParams.N}
                onChangeText={(text) => handleInputChange('N', text)}
                placeholder="0-200"
              />
            </View>

            <View style={[styles.inputGroup, styles.inputGroupSmall]}>
              <Text style={styles.inputLabel}>Phosphorus (P) ppm</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={soilParams.P}
                onChangeText={(text) => handleInputChange('P', text)}
                placeholder="0-100"
              />
            </View>

            <View style={[styles.inputGroup, styles.inputGroupSmall]}>
              <Text style={styles.inputLabel}>Potassium (K) ppm</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={soilParams.K}
                onChangeText={(text) => handleInputChange('K', text)}
                placeholder="0-500"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Soil pH (0-14)</Text>
            <View style={styles.phContainer}>
              <Text style={styles.phLabel}>Acidic</Text>
              <View style={styles.phScale}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(num => (
                  <View 
                    key={num} 
                    style={[
                      styles.phSegment,
                      num < 7 && styles.phAcidic,
                      num === 7 && styles.phNeutral,
                      num > 7 && styles.phAlkaline,
                      parseFloat(soilParams.ph) === num && styles.phSelected
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.phLabel}>Alkaline</Text>
            </View>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={soilParams.ph}
              onChangeText={(text) => handleInputChange('ph', text)}
              placeholder="Enter pH (0-14)"
            />
          </View>
        </View>

        {/* Weather Parameters Section */}
        <View style={styles.subSection}>
          <Text style={styles.subSectionTitle}>Weather Parameters</Text>
          
          <View style={styles.inputRow}>
            <View style={[styles.inputGroup, styles.inputGroupSmall]}>
              <Text style={styles.inputLabel}>Temperature (°C)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={soilParams.temperature}
                onChangeText={(text) => handleInputChange('temperature', text)}
                placeholder="e.g. 25"
              />
            </View>

            <View style={[styles.inputGroup, styles.inputGroupSmall]}>
              <Text style={styles.inputLabel}>Humidity (%)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={soilParams.humidity}
                onChangeText={(text) => handleInputChange('humidity', text)}
                placeholder="0-100"
              />
            </View>

            <View style={[styles.inputGroup, styles.inputGroupSmall]}>
              <Text style={styles.inputLabel}>Rainfall (mm)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={soilParams.rainfall}
                onChangeText={(text) => handleInputChange('rainfall', text)}
                placeholder="Annual"
              />
            </View>
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
            <>
              <Icon name="search" size={18} color="white" style={styles.buttonIcon} />
              <Text style={styles.submitButtonText}>Get Recommendations</Text>
            </>
          )}
        </TouchableOpacity>

        {isSubmitted && (
          <View style={styles.resultsSection}>
            <View style={styles.sectionHeader}>
              <Icon name="lightbulb-o" size={20} color="#5D9C59" style={styles.sectionIcon} />
              <Text style={styles.sectionTitle}>Recommended Crops</Text>
            </View>

            {recommendations.length === 0 ? (
              <View style={styles.noResults}>
                <Icon name="exclamation-triangle" size={24} color="#FFC107" />
                <Text style={styles.noResultsText}>No suitable crops found for these conditions</Text>
              </View>
            ) : (
              recommendations.map((crop, index) => (
                <View key={index} style={styles.cropCard}>
                  <View style={styles.cropHeader}>
                    <View style={styles.cropIconContainer}>
                      <Icon name={crop.icon} size={24} color={crop.suitabilityColor} />
                    </View>
                    <View style={styles.cropTitleContainer}>
                      <Text style={styles.cropName}>{crop.name}</Text>
                      <Text style={styles.cropProbability}>{crop.probability} match</Text>
                    </View>
                  </View>
                  
                  <View style={[
                    styles.suitabilityBadge,
                    { backgroundColor: `${crop.suitabilityColor}20`, borderColor: crop.suitabilityColor }
                  ]}>
                    <Text style={[styles.suitabilityText, { color: crop.suitabilityColor }]}>
                      {crop.suitability}
                    </Text>
                  </View>

                  <Text style={styles.cropDescription}>{crop.description}</Text>
                  
                  <View style={styles.cropDetails}>
                    <View style={styles.detailColumn}>
                      <Text style={styles.detailTitle}>Benefits</Text>
                      {crop.benefits.map((benefit, i) => (
                        <View key={`benefit-${i}`} style={styles.detailItem}>
                          <Icon name="check-circle" size={14} color="#4CAF50" />
                          <Text style={styles.detailText}>{benefit}</Text>
                        </View>
                      ))}
                    </View>
                    
                    <View style={styles.detailColumn}>
                      <Text style={styles.detailTitle}>Challenges</Text>
                      {crop.challenges.map((challenge, i) => (
                        <View key={`challenge-${i}`} style={styles.detailItem}>
                          <Icon name="exclamation-circle" size={14} color="#F44336" />
                          <Text style={styles.detailText}>{challenge}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))
            )}
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
    lineHeight: 20,
  },
  sectionIcon: {
    marginRight: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupSmall: {
    flex: 1,
    marginRight: 8,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  textureContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  texturePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#5D9C59',
    marginRight: 8,
    marginBottom: 8,
  },
  selectedTexturePill: {
    backgroundColor: '#5D9C59',
  },
  texturePillText: {
    color: '#5D9C59',
    fontSize: 12,
  },
  selectedTexturePillText: {
    color: 'white',
  },
  phContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  phScale: {
    flex: 1,
    flexDirection: 'row',
    height: 20,
    marginHorizontal: 8,
  },
  phSegment: {
    flex: 1,
    height: '100%',
    marginHorizontal: 1,
  },
  phAcidic: {
    backgroundColor: '#FF5722',
  },
  phNeutral: {
    backgroundColor: '#4CAF50',
  },
  phAlkaline: {
    backgroundColor: '#2196F3',
  },
  phSelected: {
    borderWidth: 2,
    borderColor: '#000',
  },
  phLabel: {
    fontSize: 12,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#5D9C59',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  resultsSection: {
    marginTop: 24,
  },
  noResults: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
  },
  noResultsText: {
    marginTop: 8,
    color: '#1A3C40',
    textAlign: 'center',
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
    marginBottom: 12,
  },
  cropIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cropTitleContainer: {
    flex: 1,
  },
  cropName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A3C40',
  },
  cropProbability: {
    fontSize: 14,
    color: '#666',
  },
  suitabilityBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
  },
  suitabilityText: {
    fontWeight: '500',
    fontSize: 12,
  },
  cropDescription: {
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  cropDetails: {
    flexDirection: 'row',
    marginTop: 8,
  },
  detailColumn: {
    flex: 1,
  },
  detailTitle: {
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#666',
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