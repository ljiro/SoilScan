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

// Gradient Fallback Components
const GradientView = ({ colors, style, children }) => (
  <View style={[style, { backgroundColor: colors[0] }]}>
    {children}
  </View>
);

const GradientButton = ({ colors, style, children }) => (
  <View style={[style, { backgroundColor: colors[0], borderRadius: 15 }]}>
    {children}
  </View>
);

// Texture Pill Component
const TexturePill = React.memo(({ texture, selected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.texturePill,
      selected && styles.selectedTexturePill
    ]}
    onPress={onPress}
  >
    <Text style={[
      styles.texturePillText,
      selected && styles.selectedTexturePillText
    ]}>
      {texture}
    </Text>
  </TouchableOpacity>
));

const API_ENDPOINT = 'https://soilscanMLtraining-soilscan-api2.hf.space/predict-crop';

const CropRecommendationScreen = ({ route }) => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // State
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
      })
    ]).start();

    if (soilTexture) {
      handleTextureSelect(soilTexture);
    }
  }, [soilTexture]);

  const handleTextureSelect = (texture) => {
    setSelectedTexture(texture);
    setSoilParams(prev => ({ ...prev, texture }));
    
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

  const getRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...soilParams,
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
      
    } catch (err) {
      setError(err.message || 'Failed to get recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GradientView colors={['#f5f7fa', '#e4efe9']} style={styles.container}>
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
        <View style={styles.formCard}>
          {/* Soil Texture */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Soil Texture</Text>
            <FlatList
              horizontal
              data={soilTextures}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TexturePill
                  texture={item}
                  selected={selectedTexture === item}
                  onPress={() => handleTextureSelect(item)}
                />
              )}
              contentContainerStyle={styles.textureContainer}
              showsHorizontalScrollIndicator={false}
            />
            <TextInput
              style={styles.input}
              value={selectedTexture ? '' : soilParams.texture}
              onChangeText={(text) => {
                setSelectedTexture(null);
                setSoilParams(prev => ({ ...prev, texture: text }));
              }}
              placeholder="Or enter custom texture"
              placeholderTextColor="#999"
            />
          </View>

          {/* Soil Nutrients */}
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
                    onChangeText={(text) => 
                      setSoilParams(prev => ({ ...prev, [item.key]: text }))
                    }
                    placeholder={item.placeholder}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity 
              onPress={getRecommendations}
              disabled={isLoading}
            >
              <GradientButton colors={['#5D9C59', '#4A8C4A']}>
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Icon name="search" size={18} color="white" />
                    <Text style={styles.submitButtonText}>Get Recommendations</Text>
                  </View>
                )}
              </GradientButton>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Results Section */}
        {recommendations.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Recommended Crops</Text>
            {recommendations.map((crop, index) => (
              <Animated.View 
                key={index} 
                style={styles.cropCard}
                entering={Animated.spring(
                  new Animated.Value(0),
                  { toValue: 1, useNativeDriver: true }
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
          </View>
        )}
      </Animated.ScrollView>
    </GradientView>
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
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
});

export default CropRecommendationScreen;