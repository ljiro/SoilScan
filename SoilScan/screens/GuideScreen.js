import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert
} from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import Icon from 'react-native-vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get("window");

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
  }
};

const API_URL = 'https://soilscanMLtraining-soilscan-api2.hf.space/predict_fertilizer';

export default function GuideScreen({ navigation }) {
  const [showPolygon, setShowPolygon] = useState(false);
  const [activeTab, setActiveTab] = useState('analysis'); // 'analysis' or 'fertilizer'

  // Polygon points
  const polygonPoints = "100,1000 580,200 1300,90";

  const soilData = {
    nitrogen: "25",
    phosphorus: "15", 
    potassium: "30",
    ph: "6.5",
    moisture: "40",
    temperature: "25",
    humidity: "60",
  };

  // Fertilizer recommendation state
  const [formData, setFormData] = useState({
    temperature: soilData.temperature,
    humidity: soilData.humidity,
    moisture: soilData.moisture,
    soilType: "Loamy",
    cropType: '',
    nitrogen: soilData.nitrogen,
    potassium: soilData.potassium,
    phosphorous: soilData.phosphorus
  });
  
  const [recommendation, setRecommendation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTexture, setSelectedTexture] = useState("Loamy");
  const [selectedCrop, setSelectedCrop] = useState(null);

  // Animation for card swipe
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 150) {
          Animated.timing(translateY, {
            toValue: height,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setShowPolygon(false);
            translateY.setValue(0);
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 6,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Fertilizer functions
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
      
      let recommendedFertilizer;
      
      if (data.recommended_fertilizer) {
        recommendedFertilizer = data.recommended_fertilizer;
      } else if (data.prediction) {
        recommendedFertilizer = data.prediction;
      } else if (data.fertilizer) {
        recommendedFertilizer = data.fertilizer;
      } else {
        recommendedFertilizer = determineFallbackFertilizer();
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

    if (nitrogen < 20 && phosphorus < 15 && potassium < 25) {
      return 'NPK';
    } else if (nitrogen < 20) {
      return 'Urea';
    } else if (phosphorus < 15) {
      return 'DAP';
    } else if (potassium < 25) {
      return 'MOP';
    } else {
      return 'NPK';
    }
  };

  const clearForm = () => {
    setFormData({
      temperature: soilData.temperature,
      humidity: soilData.humidity,
      moisture: soilData.moisture,
      soilType: "Loamy",
      cropType: '',
      nitrogen: soilData.nitrogen,
      potassium: soilData.potassium,
      phosphorous: soilData.phosphorus
    });
    setSelectedTexture("Loamy");
    setSelectedCrop(null);
    setRecommendation(null);
    setError(null);
  };

  const renderAnalysisTab = () => (
    <ScrollView 
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.cardTitle}>Soil Health Analysis</Text>
      
      {/* Soil Nutrients */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Soil Nutrients</Text>
        <View style={styles.dataGrid}>
          <View style={styles.dataItem}>
            <View style={[styles.iconContainer, styles.nitrogenBg]}>
              <Ionicons name="leaf-outline" size={20} color="#fff" />
            </View>
            <View style={styles.dataText}>
              <Text style={styles.dataLabel}>Nitrogen</Text>
              <Text style={styles.dataValue}>{soilData.nitrogen} ppm</Text>
            </View>
          </View>
          
          <View style={styles.dataItem}>
            <View style={[styles.iconContainer, styles.phosphorusBg]}>
              <Ionicons name="flash-outline" size={20} color="#fff" />
            </View>
            <View style={styles.dataText}>
              <Text style={styles.dataLabel}>Phosphorus</Text>
              <Text style={styles.dataValue}>{soilData.phosphorus} ppm</Text>
            </View>
          </View>
          
          <View style={styles.dataItem}>
            <View style={[styles.iconContainer, styles.potassiumBg]}>
              <Ionicons name="flame-outline" size={20} color="#fff" />
            </View>
            <View style={styles.dataText}>
              <Text style={styles.dataLabel}>Potassium</Text>
              <Text style={styles.dataValue}>{soilData.potassium} ppm</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Soil Properties - REMOVED SOIL TYPE FROM HERE */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Soil Properties</Text>
        <View style={styles.propertiesGrid}>
          <View style={styles.propertyItem}>
            <Ionicons name="water-outline" size={18} color="#00A86B" />
            <Text style={styles.propertyLabel}>Moisture</Text>
            <Text style={styles.propertyValue}>{soilData.moisture}%</Text>
          </View>
          
          <View style={styles.propertyItem}>
            <Ionicons name="speedometer-outline" size={18} color="#FF6B35" />
            <Text style={styles.propertyLabel}>pH Level</Text>
            <Text style={styles.propertyValue}>{soilData.ph}</Text>
          </View>

          {/* Removed Soil Type property item */}
        </View>
      </View>

      {/* Environmental Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Environmental Data</Text>
        <View style={styles.environmentGrid}>
          <View style={styles.envItem}>
            <Ionicons name="thermometer-outline" size={18} color="#FF4444" />
            <Text style={styles.envLabel}>Temperature</Text>
            <Text style={styles.envValue}>{soilData.temperature}°C</Text>
          </View>
          
          <View style={styles.envItem}>
            <Ionicons name="cloudy-outline" size={18} color="#4A90E2" />
            <Text style={styles.envLabel}>Humidity</Text>
            <Text style={styles.envValue}>{soilData.humidity}%</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => setActiveTab('fertilizer')}
          activeOpacity={0.8}
        >
          <Ionicons name="leaf" size={20} color="#fff" />
          <Text style={styles.tabButtonText}>
            Get Fertilizer Recommendation
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setShowPolygon(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="analytics-outline" size={20} color="#00A86B" />
          <Text style={styles.secondaryButtonText}>
            View Zone Analysis
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderFertilizerTab = () => (
    <ScrollView 
      style={styles.scrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.fertilizerHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setActiveTab('analysis')}
        >
          <Ionicons name="arrow-back" size={20} color="#00A86B" />
          <Text style={styles.backButtonText}>Back to Analysis</Text>
        </TouchableOpacity>
        <Text style={styles.cardTitle}>Fertilizer Recommendation</Text>
      </View>

      {/* Soil Type Selection - KEPT IN FERTILIZER TAB */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Soil Type</Text>
        <Text style={styles.sectionDescription}>Select your soil type for accurate recommendations</Text>
        
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
        <Text style={styles.sectionTitle}>Select Crop</Text>
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
        <Text style={styles.sectionTitle}>Soil Nutrients (NPK)</Text>
        <Text style={styles.sectionDescription}>Your current soil nutrient levels</Text>
        
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nitrogen (N)</Text>
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

      {/* Environmental Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Environmental Conditions</Text>
        <Text style={styles.sectionDescription}>Current environmental factors</Text>
        
        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Temperature (°C)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={formData.temperature}
              onChangeText={(text) => handleInputChange('temperature', text)}
              placeholder="0.0"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Humidity (%)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={formData.humidity}
              onChangeText={(text) => handleInputChange('humidity', text)}
              placeholder="0-100"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Moisture (%)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={formData.moisture}
              onChangeText={(text) => handleInputChange('moisture', text)}
              placeholder="0-100"
            />
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.submitButton}
          onPress={getRecommendation}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <View style={styles.buttonContent}>
              <Ionicons name="search" size={18} color="white" />
              <Text style={styles.submitButtonText}>Get Fertilizer</Text>
            </View>
          )}
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

      {/* Results Section */}
      {recommendation && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Recommended Fertilizer</Text>
          
          <View style={[styles.cropCard, styles.topCropCard]}>
            <View style={styles.cropHeader}>
              <View style={styles.cropIcon}>
                <Icon name={recommendation.icon || 'trophy'} size={20} color="#5D9C59" />
              </View>
              <Text style={styles.cropName}>{recommendation.name}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="information-circle-outline" size={16} color="#6c757d" />
              <Text style={styles.infoText}>{recommendation.description}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="flask-outline" size={16} color="#6c757d" />
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
              <Ionicons name="calendar-outline" size={16} color="#6c757d" />
              <Text style={styles.infoText}>{recommendation.application}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="warning-outline" size={18} color="#D32F2F" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={16} color="#D32F2F" />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Left Side - Map Image */}
      <View style={styles.leftSection}>
        <ImageBackground
          source={require("../assets/soilscan-map.jpg")}
          style={styles.map}
          resizeMode="cover"
        >
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
            {showPolygon && (
              <Polygon
                points={polygonPoints}
                fill="rgba(0,200,0,0.3)"
                stroke="green"
                strokeWidth="3"
              />
            )}
          </Svg>

          {/* Draw Zone Button */}
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setShowPolygon(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={26} color="#fff" />
            <Text style={styles.fabText}>Draw Zone</Text>
          </TouchableOpacity>
        </ImageBackground>
      </View>

      {/* Right Side - Content Panel */}
      <View style={styles.rightSection}>
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'analysis' && styles.activeTab]}
            onPress={() => setActiveTab('analysis')}
          >
            <Ionicons 
              name="analytics-outline" 
              size={18} 
              color={activeTab === 'analysis' ? '#00A86B' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'analysis' && styles.activeTabText]}>
              Soil Analysis
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'fertilizer' && styles.activeTab]}
            onPress={() => setActiveTab('fertilizer')}
          >
            <Ionicons 
              name="leaf-outline" 
              size={18} 
              color={activeTab === 'fertilizer' ? '#00A86B' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'fertilizer' && styles.activeTabText]}>
              Fertilizer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        {activeTab === 'analysis' ? renderAnalysisTab() : renderFertilizerTab()}

        {/* Results Card (shown when polygon is drawn) */}
        {showPolygon && (
          <Animated.View
            style={[styles.card, { transform: [{ translateY }] }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.swipeIndicator} />
            <Text style={styles.cardTitle}>Zone Analysis</Text>
            
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Zone Area:</Text>
              <Text style={styles.analysisValue}>2.5 acres</Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Soil Quality:</Text>
              <Text style={styles.analysisValue}>Good</Text>
            </View>
            <View style={styles.analysisRow}>
              <Text style={styles.analysisLabel}>Recommended Crop:</Text>
              <Text style={styles.analysisValue}>Corn</Text>
            </View>

            <TouchableOpacity
              style={styles.closeCardButton}
              onPress={() => setShowPolygon(true)}
            >
              <Text style={styles.closeCardText}>Close Analysis</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
// Styles remain the same as in the original code
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f8f8f8",
  },
  leftSection: {
    flex: 1,
    backgroundColor: "#000",
  },
  rightSection: {
    width: 400,
    backgroundColor: "#fff",
    borderLeftWidth: 1,
    borderLeftColor: "#e0e0e0",
  },
  map: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  fab: {
    position: "absolute",
    top: 40,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00A86B",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    elevation: 4,
    zIndex: 10,
  },
  fabText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
    fontSize: 14,
  },
  // Tab Styles
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#00A86B",
    backgroundColor: "#fff",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  activeTabText: {
    color: "#00A86B",
  },
  // Scroll Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 24,
    marginBottom: 24,
    textAlign: "center",
    color: "#1A3C40",
  },
  // Analysis Tab Styles
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontWeight: "600",
    fontSize: 18,
    color: "#1A3C40",
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  dataGrid: {
    gap: 12,
  },
  dataItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  nitrogenBg: {
    backgroundColor: "#00A86B",
  },
  phosphorusBg: {
    backgroundColor: "#FF6B35",
  },
  potassiumBg: {
    backgroundColor: "#FFD166",
  },
  dataText: {
    flex: 1,
  },
  dataLabel: {
    fontWeight: "500",
    color: "#333",
    fontSize: 14,
    marginBottom: 2,
  },
  dataValue: {
    fontWeight: "700",
    color: "#1A3C40",
    fontSize: 16,
  },
  propertiesGrid: {
    flexDirection: "row",
    gap: 12,
  },
  propertyItem: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  propertyLabel: {
    fontWeight: "500",
    color: "#666",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  propertyValue: {
    fontWeight: "700",
    color: "#1A3C40",
    fontSize: 16,
  },
  environmentGrid: {
    flexDirection: "row",
    gap: 12,
  },
  envItem: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  envLabel: {
    fontWeight: "500",
    color: "#666",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  envValue: {
    fontWeight: "700",
    color: "#1A3C40",
    fontSize: 16,
  },
  actionsSection: {
    gap: 12,
    marginTop: 20,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    elevation: 3,
  },
  tabButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#00A86B",
  },
  secondaryButtonText: {
    color: "#00A86B",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 8,
  },
  // Fertilizer Tab Styles
  fertilizerHeader: {
    marginBottom: 24,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backButtonText: {
    color: "#00A86B",
    fontWeight: "600",
    marginLeft: 8,
  },
  textureContainer: {
    paddingBottom: 4,
  },
  texturePill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    marginRight: 12,
    backgroundColor: "white",
  },
  selectedTexturePill: {
    backgroundColor: "#00A86B",
    borderColor: "#00A86B",
  },
  texturePillText: {
    color: "#495057",
    fontWeight: "600",
    fontSize: 14,
  },
  selectedTexturePillText: {
    color: "white",
  },
  inputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    marginRight: 12,
  },
  inputLabel: {
    color: "#495057",
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    padding: 14,
    fontSize: 16,
    color: "#1A3C40",
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  submitButton: {
    flex: 1,
    backgroundColor: "#00A86B",
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  submitButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    marginLeft: 10,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "white",
  },
  clearButtonText: {
    color: "#6c757d",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 6,
  },
  resultsContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    marginTop: 20,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A3C40",
    marginBottom: 16,
  },
  cropCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#00A86B",
  },
  topCropCard: {
    backgroundColor: "#FFF",
  },
  cropHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cropIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cropName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#1A3C40",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  infoText: {
    color: "#6c757d",
    marginLeft: 10,
    flex: 1,
    lineHeight: 20,
  },
  infoLabel: {
    fontWeight: "600",
    color: "#1A3C40",
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  benefitText: {
    color: "#6c757d",
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  sectionSubtitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A3C40",
    marginTop: 12,
    marginBottom: 8,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    justifyContent: "space-between",
  },
  errorText: {
    color: "#D32F2F",
    marginLeft: 10,
    flex: 1,
    fontWeight: "500",
  },
  // Zone Analysis Card
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingTop: 12,
    paddingBottom: 30,
    paddingHorizontal: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
  },
  swipeIndicator: {
    width: 40,
    height: 5,
    backgroundColor: "#ccc",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 10,
  },
  analysisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  analysisLabel: {
    fontWeight: "500",
    color: "#333",
    fontSize: 14,
  },
  analysisValue: {
    fontWeight: "600",
    color: "#00A86B",
    fontSize: 14,
  },
  closeCardButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  closeCardText: {
    fontWeight: "600",
    color: "#666",
    fontSize: 14,
  },
});

// Web-specific responsive styles
const webStyles = `
  @media (max-width: 1024px) {
    .rightSection {
      width: 350px;
    }
  }
  
  @media (max-width: 768px) {
    .container {
      flex-direction: column;
    }
    .leftSection {
      height: 50vh;
    }
    .rightSection {
      width: 100%;
      height: 50vh;
    }
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = webStyles;
  document.head.appendChild(styleSheet);
}