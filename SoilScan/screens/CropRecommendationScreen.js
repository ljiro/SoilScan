import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  Alert,
  Animated,
  Easing
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import LinearGradient from 'react-native-linear-gradient';

const API_ENDPOINT = 'https://soilscanMLtraining-soilscan-api2.hf.space/predict-crop';

const CropRecommendationScreen = ({ route }) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Get soil texture from navigation params
  const { soilTexture } = route.params || {};
  
  const [selectedTexture, setSelectedTexture] = useState(null);
  const [soilParams, setSoilParams] = useState({
    texture: '',
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
  const soilTextures = [
    'Sandy', 'Clay', 'Silt', 'Loam', 'Peaty', 
    'Chalky', 'Sandy Loam', 'Clay Loam', 'Silty Loam'
  ];

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
      }),
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true
      })
    ]).start();

    // Handle incoming soil texture
    if (soilTexture) {
      setSelectedTexture(soilTexture);
      setSoilParams(prev => ({
        ...prev,
        texture: soilTexture
      }));
    }
  }, [soilTexture]);

  const handleTextureSelect = (texture) => {
    setSelectedTexture(texture);
    setSoilParams(prev => ({
      ...prev,
      texture: texture
    }));
    
    // Animation feedback
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
    if (name === 'texture') setSelectedTexture(null);
    setSoilParams(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getRecommendations = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    setError(null);
    
    // Loading animation
    Animated.loop(
      Animated.timing(cardScale, {
        toValue: 1.02,
        duration: 500,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texture: soilParams.texture,
          N: parseFloat(soilParams.N),
          P: parseFloat(soilParams.P),
          K: parseFloat(soilParams.K),
          temperature: parseFloat(soilParams.temperature),
          humidity: parseFloat(soilParams.humidity),
          ph: parseFloat(soilParams.ph),
          rainfall: parseFloat(soilParams.rainfall)
        }),
      });

      const data = await response.json();
      setRecommendations(data.predictions || []);
      setIsSubmitted(true);

      // Success animation
      Animated.parallel([
        Animated.spring(cardScale, {
          toValue: 1.05,
          friction: 3,
          useNativeDriver: true
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true
        })
      ]).start(() => {
        Animated.spring(cardScale, {
          toValue: 1,
          friction: 5,
          useNativeDriver: true
        }).start();
      });

    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to get recommendations');
      
      // Error shake animation
      Animated.sequence([
        Animated.timing(slideUpAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideUpAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideUpAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(slideUpAnim, { toValue: 0, duration: 50, useNativeDriver: true })
      ]).start();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient 
      colors={['#f5f7fa', '#e4efe9']} 
      style={styles.container}
    >
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

        {/* Main Form Card */}
        <Animated.View 
          style={[
            styles.formCard,
            { 
              transform: [{ scale: cardScale }],
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.1,
              shadowRadius: 20,
              elevation: 10
            }
          ]}
        >
          {/* Soil Texture Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Soil Texture</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.textureContainer}
            >
              {soilTextures.map((texture) => (
                <Animated.View 
                  key={texture}
                  style={{ transform: [{ scale: selectedTexture === texture ? 1.05 : 1 }] }}
                >
                  <TouchableOpacity
                    style={[
                      styles.texturePill,
                      selectedTexture === texture && styles.selectedTexturePill
                    ]}
                    onPress={() => handleTextureSelect(texture)}
                  >
                    <Text style={[
                      styles.texturePillText,
                      selectedTexture === texture && styles.selectedTexturePillText
                    ]}>
                      {texture}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </ScrollView>
            
            <TextInput
              style={styles.input}
              value={selectedTexture ? '' : soilParams.texture}
              onChangeText={(text) => handleInputChange('texture', text)}
              placeholder="Or enter custom texture"
              placeholderTextColor="#999"
            />
          </View>

          {/* Nutrient Inputs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Soil Nutrients</Text>
            <View style={styles.inputRow}>
              {[
                { label: 'Nitrogen (N)', key: 'N', placeholder: 'ppm' },
                { label: 'Phosphorus (P)', key: 'P', placeholder: 'ppm' },
                { label: 'Potassium (K)', key: 'K', placeholder: 'ppm' }
              ].map((item) => (
                <View key={item.key} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{item.label}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={soilParams[item.key]}
                    onChangeText={(text) => handleInputChange(item.key, text)}
                    placeholder={item.placeholder}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Environment Inputs */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Environment</Text>
            <View style={styles.inputRow}>
              {[
                { label: 'Temperature', key: 'temperature', placeholder: '°C' },
                { label: 'Humidity', key: 'humidity', placeholder: '%' },
                { label: 'Rainfall', key: 'rainfall', placeholder: 'mm' }
              ].map((item) => (
                <View key={item.key} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{item.label}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={soilParams[item.key]}
                    onChangeText={(text) => handleInputChange(item.key, text)}
                    placeholder={item.placeholder}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* pH Scale */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Soil pH Level</Text>
            <View style={styles.phContainer}>
              <Text style={styles.phLabel}>Acidic</Text>
              <View style={styles.phScale}>
                {Array.from({ length: 15 }).map((_, i) => (
                  <View 
                    key={i}
                    style={[
                      styles.phSegment,
                      i < 7 && styles.phAcidic,
                      i === 7 && styles.phNeutral,
                      i > 7 && styles.phAlkaline,
                      parseFloat(soilParams.ph) === i && styles.phSelected
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

          {/* Submit Button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity 
              style={styles.submitButton}
              onPress={getRecommendations}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#5D9C59', '#4A8C4A']}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Icon name="search" size={18} color="white" style={styles.buttonIcon} />
                    <Text style={styles.submitButtonText}>Get Recommendations</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Results Section */}
        {isSubmitted && (
          <Animated.View 
            style={[
              styles.resultsContainer,
              { opacity: fadeAnim }
            ]}
          >
            <Text style={styles.resultsTitle}>Recommended Crops</Text>
            
            {recommendations.map((crop, index) => (
              <Animated.View 
                key={index}
                style={styles.cropCard}
                entering={Animated.spring(
                  new Animated.Value(0),
                  {
                    toValue: 1,
                    friction: 5,
                    useNativeDriver: true
                  }
                )}
              >
                <View style={styles.cropHeader}>
                  <View style={styles.cropIcon}>
                    <Icon name="pagelines" size={24} color="#5D9C59" />
                  </View>
                  <Text style={styles.cropName}>{crop.crop_name}</Text>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {Math.round(crop.confidence * 100)}%
                    </Text>
                  </View>
                </View>
                <Text style={styles.cropDescription}>
                  Best grown in {crop.optimal_conditions}
                </Text>
              </Animated.View>
            ))}
          </Animated.View>
        )}
      </Animated.ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    flexDirection: 'row',
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
  phContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  phScale: {
    flex: 1,
    height: 20,
    flexDirection: 'row',
    marginHorizontal: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  phSegment: {
    flex: 1,
    height: '100%',
  },
  phAcidic: {
    backgroundColor: '#FF7043',
  },
  phNeutral: {
    backgroundColor: '#66BB6A',
  },
  phAlkaline: {
    backgroundColor: '#42A5F5',
  },
  phSelected: {
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#1A3C40',
  },
  phLabel: {
    fontSize: 12,
    color: '#757575',
  },
  submitButton: {
    borderRadius: 15,
    overflow: 'hidden',
    marginTop: 10,
  },
  gradient: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 10,
  },
  buttonIcon: {
    marginRight: 8,
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
});

export default CropRecommendationScreen;