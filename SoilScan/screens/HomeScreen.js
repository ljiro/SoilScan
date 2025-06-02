import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  Animated,
  Easing,
  LayoutAnimation
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';

const API_ENDPOINT = 'https://soilscanMLtraining-soilscan-api2.hf.space/predict_texture';

const HomeScreen = ({ navigation }) => {
  // State initialization
  const [image, setImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedTexture, setSelectedTexture] = useState(null);
  const [showRecommendationPrompt, setShowRecommendationPrompt] = useState(false);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState(null);
  const [showLoadingModal, setShowLoadingModal] = useState(false);

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideUpAnim = useState(new Animated.Value(300))[0];
  const cardScale = useState(new Animated.Value(0.9))[0];
  const buttonScale = useState(new Animated.Value(1))[0];
  const rotateAnim = useState(new Animated.Value(0))[0];
  const shakeAnim = useState(new Animated.Value(0))[0];

  // FAQ data
  const faqs = [
    {
      question: "How do I take a good soil sample photo?",
      answer: "Take a close-up photo of dry soil in good lighting. Remove any debris or rocks. The photo should clearly show the soil texture and color."
    },
    {
      question: "What soil properties does the app analyze?",
      answer: "The app analyzes texture (sand, silt, clay composition), color, and structure to determine soil type and provide recommendations."
    },
    {
      question: "Why are fertilizer recommendations important?",
      answer: "Different crops thrive in different soil types. Our recommendations help you choose fertilizers that will grow best in your specific soil conditions."
    },
    {
      question: "How accurate are the soil analysis results?",
      answer: "Our AI model has an accuracy of about 85-90% for common soil types. For best results, ensure your photo is clear and representative of your soil."
    }
  ];
  
  // Configure LayoutAnimation
  LayoutAnimation.configureNext(LayoutAnimation.create(
    300,
    LayoutAnimation.Types.easeInEaseOut,
    LayoutAnimation.Properties.opacity
  ));

  useEffect(() => {
    // Entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
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

    // Request permissions
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
          Alert.alert(
            'Permissions Required',
            'Camera and media library permissions are required to use this app.'
          );
        }
      }
    })();
  }, []);

  const toggleFaq = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedFaqIndex(expandedFaqIndex === index ? null : index);
  };

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true
    }).start();
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  const uploadImageToAPI = async (fileUri) => {
    try {
      setShowLoadingModal(true);
      setIsAnalyzing(true);
      
      // Loading animation
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true
        })
      ).start();

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: 'image.jpg',
        type: 'image/jpeg',
      });

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      
      // Validate API response structure
      if (!data || !data.predicted_class || !data.confidence) {
        console.log('Invalid API response structure:', data);
        throw new Error('Received unexpected data format from server');
      }

      // Format the response to match our expected structure
      const formattedResult = {
        name: data.predicted_class,
        confidence: Math.round(data.confidence * 100), // Convert to percentage
        description: data.description,
        properties: data.properties || [],
        color: data.color || '#FFFFFF',
        all_confidences: data.all_confidences || {}
      };

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

      setResults(formattedResult);
      setSelectedTexture(formattedResult);
      setShowRecommendationPrompt(true);
      
    } catch (error) {
      console.error('Upload error:', error);
      
      // Show more specific error messages
      let errorMessage = 'Failed to analyze soil. Please try again.';
      if (error.message.includes('Network request failed')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('Unexpected data format')) {
        errorMessage = 'Server returned unexpected data. Please try again.';
      }
      
      Alert.alert('Error', errorMessage);
      
      // Error shake animation
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
      ]).start();
      
    } finally {
      setShowLoadingModal(false);
      setIsAnalyzing(false);
      rotateAnim.setValue(0);
    }
  };

  const handleCapture = async () => {
    try {
      const pickerResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!pickerResult.canceled && pickerResult.assets?.length > 0) {
        const imageUri = pickerResult.assets[0].uri;
        setImage(imageUri);
        setResults(null);
        setSelectedTexture(null);
        setShowRecommendationPrompt(false);
        await uploadImageToAPI(imageUri);
      }
    } catch (error) {
      Alert.alert('Error', `Camera error: ${error.message}`);
    }
  };

  const handleUpload = async () => {
    try {
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [4, 3],
      });

      if (!pickerResult.canceled && pickerResult.assets?.length > 0) {
        const imageUri = pickerResult.assets[0].uri;
        setImage(imageUri);
        setResults(null);
        setSelectedTexture(null);
        setShowRecommendationPrompt(false);
        await uploadImageToAPI(imageUri);
      }
    } catch (error) {
      Alert.alert('Error', `Upload error: ${error.message}`);
    }
  };

  const handleRecommendationResponse = (response) => {
    setShowRecommendationPrompt(false);
    if (response && selectedTexture) {
      navigation.navigate('Crop', { 
        soilTexture: selectedTexture.name 
      });
    }
  };

  // Render the confidence bars for other soil types
  const renderOtherSoilTypes = () => {
    if (!results?.all_confidences) return null;

    return (
      <View style={styles.otherResultsContainer}>
        <Text style={styles.otherResultsTitle}>Other Possible Soil Types</Text>
        {Object.entries(results.all_confidences)
          .filter(([name]) => name !== results.name) // Exclude the primary result
          .sort((a, b) => b[1].score - a[1].score) // Sort by confidence
          .map(([name, data], index) => (
            <View key={index} style={styles.otherResultItem}>
              <View style={styles.otherResultHeader}>
                <View style={[styles.otherColorSwatch, { backgroundColor: data.color }]} />
                <Text style={styles.otherTextureName}>{name}</Text>
                <Text style={styles.otherConfidenceValue}>
                  {Math.round(data.score * 100)}%
                </Text>
              </View>
              <View style={styles.otherProgressContainer}>
                <View style={styles.otherProgressBackground} />
                <View
                  style={[
                    styles.otherProgressFill,
                    { 
                      width: `${data.score * 100}%`, 
                      backgroundColor: data.color,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
      </View>
    );
  };

  return (
    <Animated.ScrollView 
      style={[styles.container, { opacity: fadeAnim }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Hero Section */}
      <Animated.View style={[styles.heroContainer, { transform: [{ translateY: slideUpAnim }] }]}>
        <Text style={styles.heroTitle}>SoilScan</Text>
        <Text style={styles.heroSubtitle}>Analyze your soil with AI</Text>
      </Animated.View>

      {/* Scan Card */}
      <Animated.View style={[
        styles.scanCard, 
        { 
          transform: [
            { translateY: slideUpAnim },
            { scale: cardScale }
          ] 
        }
      ]}>
        <Text style={styles.sectionTitle}>Scan Soil Sample</Text>
        <Text style={styles.sectionSubtitle}>Get instant soil analysis</Text>

        <View style={styles.scanPreview}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                <Icon
                  name="camera"
                  size={48}
                  color="#FFFFFF"
                  style={styles.placeholderIcon}
                />
              </Animated.View>
              <Text style={styles.placeholderText}>No image captured</Text>
            </View>
          )}

          {isAnalyzing && (
            <View style={styles.loadingOverlay}>
              <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </Animated.View>
              <Text style={styles.loadingText}>Analyzing soil texture...</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity 
              style={styles.primaryButton} 
              onPress={handleCapture}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              activeOpacity={0.8}
            >
              <Icon name="camera" size={18} color="white" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Capture</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity 
              style={styles.secondaryButton} 
              onPress={handleUpload}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              activeOpacity={0.8}
            >
              <Icon name="image" size={18} color="#5D9C59" style={styles.buttonIcon} />
              <Text style={[styles.buttonText, { color: '#5D9C59' }]}>Gallery</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Results Section */}
      {selectedTexture && (
        <Animated.View 
          style={[
            styles.resultsContainer, 
            { opacity: fadeAnim }
          ]}
        >
          <Text style={styles.resultsTitle}>Analysis Results</Text>
          
          <Animated.View 
            style={[
              styles.primaryResultCard,
              { transform: [{ scale: cardScale }] }
            ]}
          >
            <View style={styles.textureHeader}>
              <View style={[styles.colorSwatch, { backgroundColor: selectedTexture.color }]} />
              <View>
                <Text style={styles.primaryTextureName}>{selectedTexture.name}</Text>
                <Text style={styles.confidenceValue}>
                  {selectedTexture.confidence}% Confidence
                </Text>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressBackground} />
              <View
                style={[
                  styles.progressFill,
                  { 
                    width: `${selectedTexture.confidence}%`, 
                    backgroundColor: selectedTexture.color,
                  },
                ]}
              />
            </View>

            <Text style={styles.description}>{selectedTexture.description}</Text>

            <View style={styles.propertiesContainer}>
              {selectedTexture.properties?.map((prop, i) => (
                <View key={i} style={[styles.propertyTag, { backgroundColor: `${selectedTexture.color}20` }]}>
                  <Text style={[styles.propertyText, { color: selectedTexture.color }]}>{prop}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: selectedTexture.color }]}
              onPress={() => handleRecommendationResponse(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>
                Get Crop Recommendations
              </Text>
              <Icon name="arrow-right" size={14} color="white" />
            </TouchableOpacity>
          </Animated.View>

          {/* Other possible soil types */}
          {renderOtherSoilTypes()}
        </Animated.View>
      )}

      {/* FAQ Section */}
      <Animated.View style={[styles.faqContainer, { opacity: fadeAnim }]}>
        <Text style={styles.sectionTitle}>Need Help?</Text>
        <Text style={styles.sectionSubtitle}>Frequently asked questions</Text>
        
        {faqs.map((faq, index) => (
          <View key={index}>
            <TouchableOpacity 
              style={styles.faqCard}
              onPress={() => toggleFaq(index)}
              activeOpacity={0.7}
            >
              <View style={styles.faqHeader}>
                <Text style={styles.faqQuestionText}>{faq.question}</Text>
                <Icon 
                  name={expandedFaqIndex === index ? "minus" : "plus"} 
                  size={16} 
                  color="#5D9C59" 
                />
              </View>
            </TouchableOpacity>
            
            <View 
              style={{
                maxHeight: expandedFaqIndex === index ? 1000 : 0,
                overflow: 'hidden',
                opacity: expandedFaqIndex === index ? 1 : 0,
                transform: [{
                  translateY: expandedFaqIndex === index ? 0 : -10
                }]
              }}
            >
              <Text style={styles.faqAnswerText}>{faq.answer}</Text>
            </View>
          </View>
        ))}
      </Animated.View>

      {/* Recommendation Prompt Modal */}
      <Modal
        visible={showRecommendationPrompt}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRecommendationPrompt(false)}
      >
        <View style={styles.promptContainer}>
          <Animated.View 
            style={[
              styles.promptContent,
              { 
                transform: [{ scale: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1]
                })}],
                opacity: fadeAnim
              }
            ]}
          >
            <Text style={styles.promptTitle}>Soil Analysis Complete</Text>
            <Text style={styles.promptText}>
              The detected soil texture is: {selectedTexture?.name || 'Unknown'}
            </Text>
            <Text style={styles.promptText}>
              Would you like to get fertilizer recommendations for this soil type?
            </Text>
            <View style={styles.promptButtonContainer}>
              <TouchableOpacity
                style={styles.promptButtonNo}
                onPress={() => handleRecommendationResponse(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.promptButtonText}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.promptButtonYes}
                onPress={() => handleRecommendationResponse(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.promptButtonText, { color: 'white' }]}>Yes</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Loading Modal */}
      <Modal
        visible={showLoadingModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.loadingModalContainer}>
          <Animated.View 
            style={[
              styles.loadingModalContent,
              { 
                opacity: fadeAnim,
                transform: [{ scale: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1]
                })}] 
              }
            ]}
          >
            <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
              <ActivityIndicator size="large" color="#5D9C59" />
            </Animated.View>
            <Text style={styles.loadingModalText}>Analyzing Soil Sample</Text>
            <Text style={styles.loadingModalSubtext}>Please wait while we process your image...</Text>
          </Animated.View>
        </View>
      </Modal>
    </Animated.ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  heroContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1A3C40',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6C757D',
    fontWeight: '500',
  },
  scanCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#1A3C40',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A3C40',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 16,
    fontWeight: '500',
  },
  scanPreview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#5D9C59',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
  },
  placeholderIcon: {
    marginBottom: 12,
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: 'white',
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#5D9C59',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5D9C59',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  resultsContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A3C40',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  primaryResultCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#1A3C40',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    marginBottom: 16,
  },
  textureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryTextureName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3C40',
  },
  confidenceValue: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 4,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#E9ECEF',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#E9ECEF',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  description: {
    color: '#6C757D',
    marginBottom: 16,
    lineHeight: 22,
    fontSize: 14,
  },
  propertiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8,
  },
  propertyTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  propertyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonText: {
    fontWeight: '600',
    marginRight: 8,
    color: 'white',
  },
  // Other soil types styles
  otherResultsContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#1A3C40',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  otherResultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 12,
  },
  otherResultItem: {
    marginBottom: 12,
  },
  otherResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  otherColorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 12,
  },
  otherTextureName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#1A3C40',
  },
  otherConfidenceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6C757D',
  },
  otherProgressContainer: {
    height: 6,
    backgroundColor: '#E9ECEF',
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  otherProgressBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#E9ECEF',
    borderRadius: 3,
  },
  otherProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  // FAQ styles
  faqContainer: {
    paddingHorizontal: 16,
  },
  faqCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#1A3C40',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1A3C40',
  },
  faqAnswerText: {
    color: '#6C757D',
    lineHeight: 22,
    padding: 16,
    paddingTop: 8,
    fontSize: 14,
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: -8,
    marginBottom: 12,
  },
  // Modal styles
  promptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  promptContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '80%',
  },
  promptTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A3C40',
    marginBottom: 12,
    textAlign: 'center',
  },
  promptText: {
    color: '#6C757D',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  promptButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  promptButtonNo: {
    flex: 1,
    padding: 14,
    borderWidth: 1,
    borderColor: '#5D9C59',
    borderRadius: 12,
  },
  promptButtonYes: {
    flex: 1,
    backgroundColor: '#5D9C59',
    padding: 14,
    borderRadius: 12,
  },
  promptButtonText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  loadingModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    width: '80%',
    alignItems: 'center',
  },
  loadingModalText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A3C40',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingModalSubtext: {
    fontSize: 14,
    color: '#6C757D',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default HomeScreen;