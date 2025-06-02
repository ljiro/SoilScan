import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Animated,
  FlatList,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

// Updated soil types and crops to match your model
const SOIL_TYPES = [  'Alluvial', 'Black', 'Cinder', 'Clay', 'Laterite',
  'Loamy', 'Peat', 'Red', 'Sandy', 'Yellow'];
const CROPS = [
  'Barley', 'Cotton', 'Ground Nuts', 'Maize', 'Millets', 
  'Oil seeds', 'Paddy', 'Pulses', 'Sugarcane', 'Tobacco', 'Wheat'
];

const API_URL = 'https://soilscanMLtraining-soilscan-api2.hf.space/predict_fertilizer';

const FertilizerRecommendationScreen = ({ route }) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const { soilTexture } = route.params || {};
  
  const [formData, setFormData] = useState({
    temperature: '',
    humidity: '',
    moisture: '',
    soilType: '',
    cropType: '',
    nitrogen: '',
    potassium: '',
    phosphorous: ''
  });
  
  const [recommendation, setRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTexture, setSelectedTexture] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true
      }),
      Animated.spring(slideUpAnim, {
        toValue: 0,
        friction: 7,
        tension: 40,
        useNativeDriver: true
      })
    ]).start();

    if (soilTexture) {
      handleTextureSelect(soilTexture);
    }
  }, [soilTexture]);

  const handleTextureSelect = (texture) => {
    setSelectedTexture(texture);
    setFormData(prev => ({ ...prev, soilType: texture }));
    
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true
      })
    ]).start();
  };

  const handleCropSelect = (crop) => {
    setSelectedCrop(crop);
    setFormData(prev => ({ ...prev, cropType: crop }));
    
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true
      })
    ]).start();
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.soilType) {
      setError('Please select a soil type');
      return false;
    }
    
    if (!formData.cropType) {
      setError('Please select a crop');
      return false;
    }
    
    if (!formData.nitrogen || !formData.potassium || !formData.phosphorous) {
      setError('Please enter all NPK values');
      return false;
    }
    
    if (!formData.temperature) {
      setError('Please enter temperature');
      return false;
    }
    
    if (!formData.humidity || formData.humidity < 0 || formData.humidity > 100) {
      setError('Please enter a valid humidity % (0-100)');
      return false;
    }
    
    if (!formData.moisture || formData.moisture < 0 || formData.moisture > 100) {
      setError('Please enter a valid moisture % (0-100)');
      return false;
    }
    
    return true;
  };

  const getRecommendation = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const payload = {
        Temperature: parseFloat(formData.temperature),
        Humidity: parseFloat(formData.humidity),
        Moisture: parseFloat(formData.moisture),
        Soil_Type: formData.soilType,
        Crop_Type: formData.cropType,
        Nitrogen: parseFloat(formData.nitrogen),
        Potassium: parseFloat(formData.potassium),
        Phosphorous: parseFloat(formData.phosphorous)
      };

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      setRecommendation(data.recommended_fertilizer);
      
    } catch (err) {
      setError(err.message || 'Failed to get recommendation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient 
        colors={['#f8f9fa', '#e9f5e9']}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.ScrollView
          style={{ opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Fertilizer Recommendation</Text>
              <Text style={styles.headerSubtitle}>Get personalized fertilizer suggestion</Text>
            </View>
            {soilTexture && (
              <View style={styles.detectedTag}>
                <Icon name="leaf" size={14} color="#5D9C59" />
                <Text style={styles.detectedText}>Detected: {soilTexture}</Text>
              </View>
            )}
          </View>

          {/* Main Form */}
          <View style={styles.formCard}>
            {/* Soil Type Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="envira" size={18} color="#5D9C59" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Soil Type</Text>
              </View>
              <Text style={styles.sectionDescription}>Select your soil type</Text>
              
              <FlatList
                horizontal
                data={SOIL_TYPES}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.texturePill,
                      selectedTexture === item && styles.selectedTexturePill
                    ]}
                    onPress={() => handleTextureSelect(item)}
                  >
                    <Text style={[
                      styles.texturePillText,
                      selectedTexture === item && styles.selectedTexturePillText
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.textureContainer}
                showsHorizontalScrollIndicator={false}
              />
            </View>

            {/* Crop Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="pagelines" size={18} color="#5D9C59" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Select Crop</Text>
              </View>
              <Text style={styles.sectionDescription}>Choose the crop you want to grow</Text>
              
              <FlatList
                horizontal
                data={CROPS}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.texturePill,
                      selectedCrop === item && styles.selectedTexturePill
                    ]}
                    onPress={() => handleCropSelect(item)}
                  >
                    <Text style={[
                      styles.texturePillText,
                      selectedCrop === item && styles.selectedTexturePillText
                    ]}>
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                contentContainerStyle={styles.textureContainer}
                showsHorizontalScrollIndicator={false}
              />
            </View>

            {/* NPK Values */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="flask" size={16} color="#5D9C59" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Soil Nutrients (NPK)</Text>
              </View>
              <Text style={styles.sectionDescription}>Enter your soil nutrient levels</Text>
              
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nitrogen (N)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={formData.nitrogen}
                      onChangeText={(text) => handleInputChange('nitrogen', text)}
                      placeholder="0.0"
                    />
                  </View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phosphorous (P)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={formData.phosphorous}
                      onChangeText={(text) => handleInputChange('phosphorous', text)}
                      placeholder="0.0"
                    />
                  </View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Potassium (K)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={formData.potassium}
                      onChangeText={(text) => handleInputChange('potassium', text)}
                      placeholder="0.0"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Environmental Factors */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Icon name="cloud" size={18} color="#5D9C59" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Environmental Conditions</Text>
              </View>
              <Text style={styles.sectionDescription}>Enter your local conditions</Text>
              
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Temperature (°C)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={formData.temperature}
                      onChangeText={(text) => handleInputChange('temperature', text)}
                      placeholder="0.0"
                    />
                    <Text style={styles.inputUnit}>°C</Text>
                  </View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Humidity (%)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={formData.humidity}
                      onChangeText={(text) => handleInputChange('humidity', text)}
                      placeholder="0-100"
                    />
                    <Text style={styles.inputUnit}>%</Text>
                  </View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Moisture (%)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      value={formData.moisture}
                      onChangeText={(text) => handleInputChange('moisture', text)}
                      placeholder="0-100"
                    />
                    <Text style={styles.inputUnit}>%</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Submit Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={getRecommendation}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#5D9C59', '#7EB56A']}
                  style={styles.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <View style={styles.buttonContent}>
                      <Icon name="search" size={18} color="white" />
                      <Text style={styles.submitButtonText}>Get Recommendation</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Results Section */}
          {recommendation && (
            <View style={styles.resultsContainer}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>Recommended Fertilizer</Text>
              </View>
              
              <View style={[styles.cropCard, styles.topCropCard]}>
                <View style={styles.cropHeader}>
                  <View style={styles.cropIcon}>
                    <Icon name="trophy" size={20} color="#FFD700" />
                  </View>
                  <Text style={styles.cropName}>{recommendation}</Text>
                </View>
                <Text style={styles.cropDescription}>
                  Based on your soil and crop conditions, this is the most suitable fertilizer.
                </Text>
              </View>
            </View>
          )}

          {/* Error Message */}
          {error && (
            <Animated.View style={styles.errorContainer}>
              <Icon name="exclamation-circle" size={18} color="#D32F2F" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Icon name="times" size={16} color="#D32F2F" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.ScrollView>
      </LinearGradient>
    </View>
  );
};


// Styles remain the same as in your original code
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40
  },
  header: {
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A3C40',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  detectedTag: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  detectedText: {
    color: '#5D9C59',
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 6,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#1A3C40',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIcon: {
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3C40',
  },
  sectionDescription: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 16,
    lineHeight: 18,
  },
  textureContainer: {
    paddingBottom: 4,
  },
  texturePill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    marginRight: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedTexturePill: {
    backgroundColor: '#5D9C59',
    borderColor: '#5D9C59',
    shadowColor: '#5D9C59',
    shadowOpacity: 0.2,
  },
  texturePillText: {
    color: '#495057',
    fontWeight: '600',
    fontSize: 14,
  },
  selectedTexturePillText: {
    color: 'white',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    marginRight: 12,
  },
  inputLabel: {
    color: '#495057',
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: '#1A3C40',
    fontWeight: '500',
  },
  inputUnit: {
    paddingHorizontal: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  submitButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#5D9C59',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonGradient: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  resultsContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#1A3C40',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1A3C40',
  },
  resultsCount: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  resultsCountText: {
    color: '#5D9C59',
    fontWeight: '700',
    fontSize: 12,
  },
  cropCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#5D9C59',
  },
  topCropCard: {
    borderLeftColor: '#FFD700',
    backgroundColor: '#FFF',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  cropHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cropIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cropName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3C40',
  },
  confidenceBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  confidenceText: {
    color: '#5D9C59',
    fontWeight: '800',
    fontSize: 14,
  },
  cropDescription: {
    color: '#6c757d',
    lineHeight: 22,
    marginBottom: 12,
    fontSize: 14,
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  detailsButtonText: {
    color: '#5D9C59',
    fontWeight: '600',
    fontSize: 14,
    marginRight: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#D32F2F',
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
  },
});

export default FertilizerRecommendationScreen;