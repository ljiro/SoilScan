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
  Dimensions,
  Alert,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { NPKChart, StepIndicator, SuccessAnimation, Confetti } from '../components';

// Weather API
const WEATHER_API_KEY = 'bd5e378503939ddaee76f12ad7a97608';

const { width } = Dimensions.get('window');

// Soil types and crops
const SOIL_TYPES = [
  'Alluvial', 'Black', 'Cinder', 'Clay', 'Laterite',
  'Loamy', 'Peat', 'Red', 'Sandy', 'Yellow'
];

const CROPS = [
  'Barley', 'Cotton', 'Ground Nuts', 'Maize', 'Millets', 
  'Oil seeds', 'Paddy', 'Pulses', 'Sugarcane', 'Tobacco', 'Wheat'
];

// Fertilizer database with detailed information
const FERTILIZER_INFO = {
  'Urea': {
    description: 'A high-nitrogen fertilizer that promotes leafy growth',
    composition: '46% Nitrogen',
    benefits: [
      'Promotes rapid vegetative growth',
      'Improves protein content in crops',
      'Cost-effective nitrogen source'
    ],
    application: 'Apply 100-150 kg per acre in 2-3 split doses',
    icon: 'tint'
  },
  'DAP': {
    description: 'Diammonium Phosphate provides both nitrogen and phosphorus',
    composition: '18% Nitrogen, 46% P2O5',
    benefits: [
      'Excellent starter fertilizer',
      'Promotes root development',
      'Enhances flowering and fruiting'
    ],
    application: 'Apply 50-100 kg per acre at sowing time',
    icon: 'tree'
  },
  'MOP': {
    description: 'Muriate of Potash provides potassium for plant health',
    composition: '60% K2O',
    benefits: [
      'Improves disease resistance',
      'Enhances fruit quality',
      'Regulates water uptake'
    ],
    application: 'Apply 40-80 kg per acre in split doses',
    icon: 'apple'
  },
  'NPK': {
    description: 'Balanced fertilizer with all three major nutrients',
    composition: 'Varies (e.g., 10-26-26, 12-32-16)',
    benefits: [
      'Complete nutrition in single application',
      'Custom blends available',
      'Suitable for most crops'
    ],
    application: 'Apply 100-150 kg per acre based on soil test',
    icon: 'balance-scale'
  },
  'SSP': {
    description: 'Single Super Phosphate provides phosphorus and calcium',
    composition: '16% P2O5, 11% Sulfur',
    benefits: [
      'Good for acidic soils',
      'Provides secondary nutrients',
      'Promotes root growth'
    ],
    application: 'Apply 150-200 kg per acre at sowing',
    icon: 'pagelines'
  },
  'Organic': {
    description: 'Natural fertilizers like compost or manure',
    composition: 'Varies (0.5-3% N, P, K)',
    benefits: [
      'Improves soil structure',
      'Enhances microbial activity',
      'Long-term soil health'
    ],
    application: 'Apply 5-10 tons per acre before planting',
    icon: 'leaf'
  },
  '10-10-10': {
    description: 'Balanced NPK fertilizer with equal parts of each nutrient',
    composition: '10% N, 10% P2O5, 10% K2O',
    benefits: [
      'Good general-purpose fertilizer',
      'Suitable for most field crops',
      'Easy to apply uniformly'
    ],
    application: 'Apply 200-300 kg per acre in split doses',
    icon: 'cube'
  },
  '20-20-20': {
    description: 'High-analysis balanced fertilizer',
    composition: '20% N, 20% P2O5, 20% K2O',
    benefits: [
      'Good for high-yield crops',
      'Quick nutrient availability',
      'Water-soluble formulation'
    ],
    application: 'Apply 100-150 kg per acre in split doses',
    icon: 'line-chart'
  },
  '28-28-0': {
    description: 'High nitrogen and phosphorus fertilizer',
    composition: '28% N, 28% P2O5',
    benefits: [
      'Excellent for wheat and cereals',
      'Promotes tillering',
      'Good for early growth stages'
    ],
    application: 'Apply 100-150 kg per acre at sowing',
    icon: 'wheat'
  },
  '17-17-17': {
    description: 'Balanced water-soluble fertilizer',
    composition: '17% N, 17% P2O5, 17% K2O',
    benefits: [
      'Ideal for fertigation',
      'Quick nutrient uptake',
      'Good for horticultural crops'
    ],
    application: 'Apply through irrigation system',
    icon: 'tint'
  }
};

const API_URL = 'https://soilscanMLtraining-soilscan-api2.hf.space/predict_fertilizer';

const FertilizerRecommendationScreen = ({ route }) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Get the passed parameters
  const routeParams = route.params || {};
  console.log('Route params received:', routeParams);
  
  // Initialize form data with route params
  const [formData, setFormData] = useState({
    temperature: routeParams.temperature || '',
    humidity: routeParams.humidity || '',
    moisture: routeParams.moisture || '',
    soilType: routeParams.soilType || '',
    cropType: '',
    nitrogen: routeParams.nitrogen || '',
    potassium: routeParams.potassium || '',
    phosphorous: routeParams.phosphorous || ''
  });
  
  const [recommendation, setRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTexture, setSelectedTexture] = useState(routeParams.soilType || null);
  const [selectedCrop, setSelectedCrop] = useState(null);

  // Auto environmental data
  const [autoEnvironment, setAutoEnvironment] = useState(!routeParams.temperature);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [locationName, setLocationName] = useState(null);

  // Fetch weather data based on current location
  const fetchWeatherData = async () => {
    setIsLoadingWeather(true);
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is needed for auto weather data.');
        setAutoEnvironment(false);
        return;
      }

      // Get current location with timeout for faster response
      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low, // Faster response
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Location timeout')), 5000)
        ),
      ]);

      const { latitude, longitude } = location.coords;

      // Fetch weather data
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${WEATHER_API_KEY}`
      );

      if (response.ok) {
        const data = await response.json();

        // Update form with weather data
        setFormData(prev => ({
          ...prev,
          temperature: Math.round(data.main.temp).toString(),
          humidity: Math.round(data.main.humidity).toString(),
          moisture: prev.moisture || Math.round(data.main.humidity * 0.6).toString(), // Estimate soil moisture
        }));

        setLocationName(data.name);
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
      Alert.alert('Error', 'Could not fetch weather data. Please enter manually.');
      setAutoEnvironment(false);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  // Toggle auto environment
  const handleAutoToggle = (value) => {
    setAutoEnvironment(value);
    if (value) {
      fetchWeatherData();
    } else {
      setLocationName(null);
    }
  };

  useEffect(() => {
    console.log('Form data after initialization:', formData);

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

    // Auto-fetch weather if no data provided and autoEnvironment is true
    if (autoEnvironment && !routeParams.temperature) {
      fetchWeatherData();
    }
  }, []);

  // Update form data when route params change
  useEffect(() => {
    if (routeParams && Object.keys(routeParams).length > 0) {
      console.log('Updating form data with route params:', routeParams);
      setFormData(prev => ({
        ...prev,
        temperature: routeParams.temperature || prev.temperature,
        humidity: routeParams.humidity || prev.humidity,
        moisture: routeParams.moisture || prev.moisture,
        soilType: routeParams.soilType || prev.soilType,
        nitrogen: routeParams.nitrogen || prev.nitrogen,
        potassium: routeParams.potassium || prev.potassium,
        phosphorous: routeParams.phosphorous || prev.phosphorous
      }));
      
      if (routeParams.soilType) {
        setSelectedTexture(routeParams.soilType);
      }
    }
  }, [routeParams]);

  const handleTextureSelect = (texture) => {
    setSelectedTexture(texture);
    setFormData(prev => ({ ...prev, soilType: texture }));
  };

  const handleCropSelect = (crop) => {
    setSelectedCrop(crop);
    setFormData(prev => ({ ...prev, cropType: crop }));
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
    
    // Validate NPK values
    const nitrogenVal = parseFloat(formData.nitrogen);
    const potassiumVal = parseFloat(formData.potassium);
    const phosphorousVal = parseFloat(formData.phosphorous);
    
    if (isNaN(nitrogenVal) || isNaN(potassiumVal) || isNaN(phosphorousVal)) {
      setError('Please enter valid NPK values (numbers only)');
      return false;
    }
    
    if (!formData.temperature || isNaN(parseFloat(formData.temperature))) {
      setError('Please enter a valid temperature');
      return false;
    }
    
    const humidityVal = parseFloat(formData.humidity);
    if (isNaN(humidityVal) || humidityVal < 0 || humidityVal > 100) {
      setError('Please enter a valid humidity % (0-100)');
      return false;
    }
    
    const moistureVal = parseFloat(formData.moisture);
    if (isNaN(moistureVal) || moistureVal < 0 || moistureVal > 100) {
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

      console.log('Sending API payload:', payload);

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
      console.log('API Response:', data);
      
      // Handle different response formats
      let recommendedFertilizer;
      
      if (data.recommended_fertilizer) {
        recommendedFertilizer = data.recommended_fertilizer;
      } else if (data.prediction) {
        recommendedFertilizer = data.prediction;
      } else if (data.fertilizer) {
        recommendedFertilizer = data.fertilizer;
      } else {
        recommendedFertilizer = determineFallbackFertilizer();
        console.log('Using fallback fertilizer:', recommendedFertilizer);
      }
      
      setRecommendation({
        name: recommendedFertilizer,
        ...FERTILIZER_INFO[recommendedFertilizer] || {
          description: 'Custom fertilizer recommendation based on your soil analysis',
          composition: 'Optimized blend for your specific conditions',
          benefits: [
            'Tailored to your soil nutrient levels',
            'Matches your crop requirements',
            'Considers environmental conditions'
          ],
          application: 'Apply based on soil test results and crop requirements',
          icon: 'star'
        }
      });
      
    } catch (err) {
      console.error('API Error:', err);
      const fallbackFertilizer = determineFallbackFertilizer();
      setRecommendation({
        name: fallbackFertilizer,
        ...FERTILIZER_INFO[fallbackFertilizer] || FERTILIZER_INFO['NPK']
      });
      setError('API unavailable. Showing local recommendation based on your soil data.');
    } finally {
      setIsLoading(false);
    }
  };

  const determineFallbackFertilizer = () => {
    const nitrogen = parseFloat(formData.nitrogen) || 0;
    const phosphorus = parseFloat(formData.phosphorous) || 0;
    const potassium = parseFloat(formData.potassium) || 0;

    console.log('Calculating fallback with NPK:', { nitrogen, phosphorus, potassium });

    if (nitrogen < 20 && phosphorus < 15 && potassium < 25) {
      return 'NPK';
    } else if (nitrogen < 20) {
      return 'Urea';
    } else if (phosphorus < 15) {
      return 'DAP';
    } else if (potassium < 25) {
      return 'MOP';
    } else if (nitrogen < 30 && phosphorus < 25) {
      return '28-28-0';
    } else {
      return '10-10-10';
    }
  };

  const clearForm = () => {
    setFormData({
      temperature: '',
      humidity: '',
      moisture: '',
      soilType: '',
      cropType: '',
      nitrogen: '',
      potassium: '',
      phosphorous: ''
    });
    setSelectedTexture(null);
    setSelectedCrop(null);
    setRecommendation(null);
    setError(null);
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
              <Text style={styles.headerSubtitle}>
                {routeParams.soilType ? `Pre-filled with soil analysis data` : 'Get personalized fertilizer suggestion'}
              </Text>
            </View>
            {routeParams.soilType && (
              <View style={styles.detectedTag}>
                <Ionicons name="leaf" size={14} color="#5D9C59" />
                <Text style={styles.detectedText}>From Soil Scan</Text>
              </View>
            )}
          </View>

          {/* Data Pre-filled Indicator */}
          {routeParams.soilType && (
            <View style={styles.prefilledBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.prefilledText}>
                Soil analysis data pre-filled automatically
              </Text>
            </View>
          )}


          {/* Main Form */}
          <View style={styles.formCard}>
            {/* Soil Type Selection */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="leaf" size={18} color="#5D9C59" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Soil Type</Text>
                {routeParams.soilType && (
                  <View style={styles.autoFilledBadge}>
                    <Text style={styles.autoFilledText}>Auto-filled</Text>
                  </View>
                )}
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
                <Ionicons name="leaf-outline" size={18} color="#5D9C59" style={styles.sectionIcon} />
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

            {/* NPK Values - SIMPLIFIED */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="flask" size={16} color="#5D9C59" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Soil Nutrients (NPK)</Text>
                {routeParams.nitrogen && (
                  <View style={styles.autoFilledBadge}>
                    <Text style={styles.autoFilledText}>From analysis</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sectionDescription}>Your soil nutrient levels</Text>
              
              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nitrogen       (N)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={formData.nitrogen}
                    onChangeText={(text) => handleInputChange('nitrogen', text)}
                    placeholder="0.0"
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phosphorous (P)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={formData.phosphorous}
                    onChangeText={(text) => handleInputChange('phosphorous', text)}
                    placeholder="0.0"
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Potassium (K)</Text>
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

            {/* Environmental Factors - SIMPLIFIED */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="cloud" size={18} color="#5D9C59" style={styles.sectionIcon} />
                <Text style={styles.sectionTitle}>Environmental Conditions</Text>
              </View>

              {/* Auto/Manual Toggle */}
              <View style={styles.autoToggleContainer}>
                <View style={styles.autoToggleLeft}>
                  <Ionicons
                    name={autoEnvironment ? "location" : "create-outline"}
                    size={18}
                    color={autoEnvironment ? "#5D9C59" : "#6C757D"}
                  />
                  <Text style={styles.autoToggleText}>
                    {autoEnvironment ? 'Auto-detect from GPS' : 'Manual entry'}
                  </Text>
                  {isLoadingWeather && (
                    <ActivityIndicator size="small" color="#5D9C59" style={{ marginLeft: 8 }} />
                  )}
                </View>
                <Switch
                  value={autoEnvironment}
                  onValueChange={handleAutoToggle}
                  trackColor={{ false: '#E9ECEF', true: '#A8D5A2' }}
                  thumbColor={autoEnvironment ? '#5D9C59' : '#f4f3f4'}
                />
              </View>

              {/* Location info when auto */}
              {autoEnvironment && locationName && (
                <View style={styles.locationBanner}>
                  <Ionicons name="location" size={14} color="#5D9C59" />
                  <Text style={styles.locationText}>
                    Data from: {locationName}
                  </Text>
                  <TouchableOpacity onPress={fetchWeatherData} style={styles.refreshButton}>
                    <Ionicons name="refresh" size={14} color="#5D9C59" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Temp (°C)</Text>
                  <TextInput
                    style={[styles.input, autoEnvironment && styles.inputAuto]}
                    keyboardType="numeric"
                    value={formData.temperature}
                    onChangeText={(text) => {
                      handleInputChange('temperature', text);
                      if (autoEnvironment) setAutoEnvironment(false);
                    }}
                    placeholder="--"
                    placeholderTextColor="#BDBDBD"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Humidity (%)</Text>
                  <TextInput
                    style={[styles.input, autoEnvironment && styles.inputAuto]}
                    keyboardType="numeric"
                    value={formData.humidity}
                    onChangeText={(text) => {
                      handleInputChange('humidity', text);
                      if (autoEnvironment) setAutoEnvironment(false);
                    }}
                    placeholder="--"
                    placeholderTextColor="#BDBDBD"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Moisture (%)</Text>
                  <TextInput
                    style={[styles.input, autoEnvironment && styles.inputAuto]}
                    keyboardType="numeric"
                    value={formData.moisture}
                    onChangeText={(text) => {
                      handleInputChange('moisture', text);
                      if (autoEnvironment) setAutoEnvironment(false);
                    }}
                    placeholder="--"
                    placeholderTextColor="#BDBDBD"
                  />
                </View>
              </View>

              {autoEnvironment && (
                <Text style={styles.autoHint}>
                  Tap any field to switch to manual entry
                </Text>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
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
                      <Ionicons name="search" size={18} color="white" />
                      <Text style={styles.submitButtonText}>Get Fertilizer</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearForm}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={16} color="#6c757d" />
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Results Section */}
          {recommendation && (
            <View style={styles.resultsContainer}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>Recommended Fertilizer</Text>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceText}>AI Recommended</Text>
                </View>
              </View>

              {/* NPK Chart Visualization */}
              <NPKChart
                nitrogen={parseFloat(formData.nitrogen) || 0}
                phosphorus={parseFloat(formData.phosphorous) || 0}
                potassium={parseFloat(formData.potassium) || 0}
              />

              <View style={[styles.cropCard, styles.topCropCard]}>
                <View style={styles.cropHeader}>
                  <View style={styles.cropIcon}>
                    <Ionicons name="leaf" size={20} color="#5D9C59" />
                  </View>
                  <Text style={styles.cropName}>{recommendation.name}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="information-circle" size={16} color="#6C757D" />
                  <Text style={styles.infoText}>{recommendation.description}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="flask" size={16} color="#6C757D" />
                  <Text style={styles.infoText}>
                    <Text style={styles.infoLabel}>Composition: </Text>
                    {recommendation.composition}
                  </Text>
                </View>

                <Text style={styles.sectionSubtitle}>Key Benefits:</Text>
                {recommendation.benefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <Ionicons name="checkmark-circle" size={14} color="#5D9C59" />
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}

                <Text style={styles.sectionSubtitle}>Application:</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar" size={16} color="#6C757D" />
                  <Text style={styles.infoText}>{recommendation.application}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#D32F2F" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Ionicons name="close" size={16} color="#D32F2F" />
              </TouchableOpacity>
            </View>
          )}
        </Animated.ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  gradientBackground: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40
  },
  header: {
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between'
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A3C40',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6C757D',
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
  prefilledBanner: {
    backgroundColor: '#5D9C59',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  prefilledText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#1A3C40',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1A3C40',
    flex: 1,
  },
  autoFilledBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  autoFilledText: {
    color: '#1976D2',
    fontWeight: '600',
    fontSize: 10,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 16,
    lineHeight: 20,
  },
  autoToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  autoToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  autoToggleText: {
    fontSize: 14,
    color: '#1A3C40',
    fontWeight: '500',
    marginLeft: 10,
  },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  refreshButton: {
    padding: 4,
  },
  inputAuto: {
    backgroundColor: '#E8F5E9',
    borderColor: '#A8D5A2',
  },
  autoHint: {
    fontSize: 12,
    color: '#6C757D',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
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
    gap: 10,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    color: '#495057',
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    height: 32,
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    padding: 14,
    fontSize: 16,
    color: '#1A3C40',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    flex: 1,
    shadowColor: '#5D9C59',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: 'white',
  },
  clearButtonText: {
    color: '#6C757D',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  resultsContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#1A3C40',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 20,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoText: {
    color: '#6C757D',
    marginLeft: 10,
    flex: 1,
    lineHeight: 22,
  },
  infoLabel: {
    fontWeight: '600',
    color: '#1A3C40',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  benefitText: {
    color: '#6C757D',
    marginLeft: 8,
    flex: 1,
    lineHeight: 22,
  },
  sectionSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A3C40',
    marginTop: 12,
    marginBottom: 8,
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