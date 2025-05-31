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
  Easing,
  FlatList,
  Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const { width } = Dimensions.get('window');

// Soil texture categories
const SOIL_TEXTURES = [
  'Alluvial', 'Black', 'Cinder', 'Clay', 'Laterite',
  'Loamy', 'Peat', 'Red', 'Sandy', 'Yellow'
];

const CropRecommendationScreen = ({ route }) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Get soil texture from navigation params
  const { soilTexture } = route.params || {};
  
  // Form state
  const [formData, setFormData] = useState({
    soilTexture: '',
    nitrogen: '',
    phosphorus: '',
    potassium: '',
    temperature: '',
    humidity: '',
    rainfall: '',
    ph: ''
  });
  
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTexture, setSelectedTexture] = useState(null);

  useEffect(() => {
    // Entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true
      }),
      Animated.spring(slideUpAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true
      })
    ]).start();

    // Set initial texture from navigation params
    if (soilTexture) {
      handleTextureSelect(soilTexture);
    }
  }, [soilTexture]);

  const handleTextureSelect = (texture) => {
    setSelectedTexture(texture);
    setFormData(prev => ({ ...prev, soilTexture: texture }));
    
    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();
  };

  const handleInputChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    if (!formData.soilTexture) {
      setError('Please select a soil texture');
      return false;
    }
    
    if (!formData.nitrogen || !formData.phosphorus || !formData.potassium) {
      setError('Please enter all NPK values');
      return false;
    }
    
    if (!formData.ph || formData.ph < 0 || formData.ph > 14) {
      setError('Please enter a valid pH (0-14)');
      return false;
    }
    
    return true;
  };

  const getRecommendations = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('YOUR_API_ENDPOINT', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          soil_type: formData.soilTexture,
          nitrogen: parseFloat(formData.nitrogen),
          phosphorus: parseFloat(formData.phosphorus),
          potassium: parseFloat(formData.potassium),
          temperature: parseFloat(formData.temperature),
          humidity: parseFloat(formData.humidity),
          rainfall: parseFloat(formData.rainfall),
          ph: parseFloat(formData.ph)
        }),
      });

      const data = await response.json();
      setRecommendations(data.predictions || []);
      
    } catch (err) {
      setError(err.message || 'Failed to get recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        style={{ opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Crop Recommendations</Text>
          {soilTexture && (
            <View style={styles.detectedTag}>
              <Text style={styles.detectedText}>Detected: {soilTexture}</Text>
            </View>
          )}
        </View>

        {/* Main Form */}
        <View style={styles.formCard}>
          {/* Soil Texture Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Soil Texture</Text>
            <FlatList
              horizontal
              data={SOIL_TEXTURES}
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

          {/* NPK Values */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Soil Nutrients (NPK)</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nitrogen (N)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={formData.nitrogen}
                  onChangeText={(text) => handleInputChange('nitrogen', text)}
                  placeholder="ppm"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phosphorus (P)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={formData.phosphorus}
                  onChangeText={(text) => handleInputChange('phosphorus', text)}
                  placeholder="ppm"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Potassium (K)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={formData.potassium}
                  onChangeText={(text) => handleInputChange('potassium', text)}
                  placeholder="ppm"
                />
              </View>
            </View>
          </View>

          {/* Environmental Factors */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Environmental Factors</Text>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Temperature (°C)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={formData.temperature}
                  onChangeText={(text) => handleInputChange('temperature', text)}
                  placeholder="°C"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Humidity (%)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={formData.humidity}
                  onChangeText={(text) => handleInputChange('humidity', text)}
                  placeholder="%"
                />
              </View>
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Rainfall (mm)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={formData.rainfall}
                  onChangeText={(text) => handleInputChange('rainfall', text)}
                  placeholder="mm"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>pH Level (0-14)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={formData.ph}
                  onChangeText={(text) => handleInputChange('ph', text)}
                  placeholder="0-14"
                />
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={getRecommendations}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <View style={styles.buttonContent}>
                  <Icon name="search" size={18} color="white" />
                  <Text style={styles.submitButtonText}>Get Recommendations</Text>
                </View>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Results Section */}
        {recommendations.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Recommended Crops</Text>
            {recommendations.map((crop, index) => (
              <View key={index} style={styles.cropCard}>
                <View style={styles.cropHeader}>
                  <View style={styles.cropIcon}>
                    <Icon name="pagelines" size={24} color="#5D9C59" />
                  </View>
                  <Text style={styles.cropName}>{crop.name}</Text>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {Math.round(crop.confidence * 100)}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.cropDescription}>
                  {crop.description}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Icon name="exclamation-circle" size={16} color="#D32F2F" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa'
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40
  },
  header: {
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A3C40',
  },
  detectedTag: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  detectedText: {
    color: '#5D9C59',
    fontWeight: '600',
    fontSize: 12,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 25,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 15,
  },
  textureContainer: {
    paddingBottom: 10,
  },
  texturePill: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: 10,
    backgroundColor: 'white',
  },
  selectedTexturePill: {
    backgroundColor: '#5D9C59',
    borderColor: '#5D9C59',
  },
  texturePillText: {
    color: '#757575',
    fontWeight: '500',
  },
  selectedTexturePillText: {
    color: 'white',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  inputGroup: {
    flex: 1,
    marginRight: 10,
  },
  inputLabel: {
    color: '#616161',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  submitButton: {
    backgroundColor: '#5D9C59',
    borderRadius: 15,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 10,
  },
  resultsContainer: {
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 25,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A3C40',
    marginBottom: 20,
  },
  cropCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 18,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cropHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cropIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cropName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
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
    fontWeight: '700',
  },
  cropDescription: {
    color: '#616161',
    lineHeight: 22,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  errorText: {
    color: '#D32F2F',
    marginLeft: 8,
  },
});

export default CropRecommendationScreen;