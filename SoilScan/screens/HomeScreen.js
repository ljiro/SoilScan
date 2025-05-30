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
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

const API_ENDPOINT = 'https://soilscanMLtraining-soilscan-api2.hf.space/predict_texture';

const HomeScreen = ({ navigation }) => {
  const [image, setImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedTexture, setSelectedTexture] = useState(null);
  const [showRecommendationPrompt, setShowRecommendationPrompt] = useState(false);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState(null);
  const [showLoadingModal, setShowLoadingModal] = useState(false);

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
      question: "Why are crop recommendations important?",
      answer: "Different crops thrive in different soil types. Our recommendations help you choose crops that will grow best in your specific soil conditions."
    },
    {
      question: "How accurate are the soil analysis results?",
      answer: "Our AI model has an accuracy of about 85-90% for common soil types. For best results, ensure your photo is clear and representative of your soil."
    }
  ];

  useEffect(() => {
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
    setExpandedFaqIndex(expandedFaqIndex === index ? null : index);
  };

  const uploadImageToAPI = async (fileUri) => {
    try {
      setShowLoadingModal(true);
      setIsAnalyzing(true);
      
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
        const error = await response.json();
        throw new Error(error.detail || 'Request failed');
      }

      const data = await response.json();
      
      // Simulate some mock data for demonstration
      const mockResults = [
        {
          name: "Loamy Soil",
          confidence: 85,
          color: "#8B4513",
          description: "Loamy soil is a balanced mixture of sand, silt, and clay. It has good drainage and moisture retention, making it ideal for most plants.",
          properties: ["Good drainage", "Retains moisture", "Rich in nutrients"]
        },
        {
          name: "Sandy Soil",
          confidence: 12,
          color: "#F4A460",
          description: "Sandy soil has large particles and drains quickly. It warms up fast in spring but doesn't hold nutrients well.",
          properties: ["Fast drainage", "Low nutrients", "Easy to work"]
        },
        {
          name: "Clay Soil",
          confidence: 3,
          color: "#5F4B32",
          description: "Clay soil has very small particles that stick together. It holds water well but drains poorly and can be hard for roots to penetrate.",
          properties: ["High nutrients", "Poor drainage", "Compacts easily"]
        }
      ];
      
      setResults(data.predictions);
      setSelectedTexture(data.primary_prediction);
      setShowRecommendationPrompt(true);
      
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to analyze soil. Please try again.');
    } finally {
      setShowLoadingModal(false);
      setIsAnalyzing(false);
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
        setResults([]);
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
        setResults([]);
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
    if (response) {
      navigation.navigate('CropRecommendation', { 
        soilTexture: selectedTexture.name 
      });
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Scan Soil Sample Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scan Soil Sample</Text>

        <View style={styles.scanPreview}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Icon
                name="camera"
                size={48}
                color="#1A3C40"
                style={styles.placeholderIcon}
              />
              <Text style={styles.placeholderText}>No image captured</Text>
            </View>
          )}

          {isAnalyzing && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#5D9C59" />
              <Text style={styles.loadingText}>Analyzing soil texture...</Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleCapture}>
            <Icon name="camera" size={18} color="white" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Capture</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineButton} onPress={handleUpload}>
            <Icon name="upload" size={18} color="#5D9C59" style={styles.buttonIcon} />
            <Text style={[styles.buttonText, { color: '#5D9C59' }]}>Upload</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* FAQ Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="question-circle" size={20} color="#5D9C59" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        </View>

        {faqs.map((faq, index) => (
          <View key={index} style={styles.faqItem}>
            <TouchableOpacity 
              style={styles.faqQuestion} 
              onPress={() => toggleFaq(index)}
            >
              <Text style={styles.faqQuestionText}>{faq.question}</Text>
              <Icon 
                name={expandedFaqIndex === index ? "chevron-up" : "chevron-down"} 
                size={16} 
                color="#5D9C59" 
              />
            </TouchableOpacity>
            
            {expandedFaqIndex === index && (
              <View style={styles.faqAnswer}>
                <Text style={styles.faqAnswerText}>{faq.answer}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Results Sections */}
      {selectedTexture && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="leaf" size={20} color="#5D9C59" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Primary Soil Texture</Text>
          </View>

          <View style={styles.primaryResultCard}>
            <View style={styles.textureHeader}>
              <View style={[styles.colorSwatch, { backgroundColor: selectedTexture.color }]} />
              <View>
                <Text style={styles.primaryTextureName}>{selectedTexture.name}</Text>
                <Text style={styles.confidenceValue}>
                  {selectedTexture.confidence}% Confidence
                </Text>
              </View>
            </View>

            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${selectedTexture.confidence}%`, backgroundColor: selectedTexture.color },
                ]}
              />
            </View>

            <Text style={styles.description}>{selectedTexture.description}</Text>

            <View style={styles.propertiesContainer}>
              {selectedTexture.properties.map((prop, i) => (
                <View key={i} style={[styles.propertyTag, { borderColor: selectedTexture.color }]}>
                  <Text style={styles.propertyText}>{prop}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.cropRecommendationButton, { borderColor: selectedTexture.color }]}
              onPress={() => handleRecommendationResponse(true)}
            >
              <Text style={[styles.cropRecommendationText, { color: selectedTexture.color }]}>
                Get Crop Recommendations
              </Text>
              <Icon name="arrow-right" size={14} color={selectedTexture.color} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {results.length > 1 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="list" size={20} color="#5D9C59" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Alternative Textures</Text>
          </View>

          {results.slice(1, 5).map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.textureCard}
              onPress={() => {
                setSelectedTexture(item);
              }}
            >
              <View style={styles.textureHeader}>
                <View style={[styles.colorSwatch, { backgroundColor: item.color }]} />
                <View>
                  <Text style={styles.textureType}>{item.name}</Text>
                  <Text style={styles.confidenceValue}>{item.confidence}%</Text>
                </View>
              </View>

              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    { width: `${item.confidence}%`, backgroundColor: item.color },
                  ]}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recommendation Prompt Modal */}
      <Modal
        visible={showRecommendationPrompt}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRecommendationPrompt(false)}
      >
        <View style={styles.promptContainer}>
          <View style={styles.promptContent}>
            <Text style={styles.promptTitle}>Soil Analysis Complete</Text>
            <Text style={styles.promptText}>
              The detected soil texture is: {selectedTexture?.name}
            </Text>
            <Text style={styles.promptText}>
              Would you like to get crop recommendations for this soil type?
            </Text>
            <View style={styles.promptButtonContainer}>
              <TouchableOpacity
                style={styles.promptButtonNo}
                onPress={() => handleRecommendationResponse(false)}
              >
                <Text style={styles.promptButtonText}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.promptButtonYes}
                onPress={() => handleRecommendationResponse(true)}
              >
                <Text style={[styles.promptButtonText, { color: 'white' }]}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
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
          <View style={styles.loadingModalContent}>
            <ActivityIndicator size="large" color="#5D9C59" />
            <Text style={styles.loadingModalText}>Analyzing Soil Sample</Text>
            <Text style={styles.loadingModalSubtext}>Please wait while we process your image...</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIcon: {
    marginRight: 8,
  },
  scanPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#EDF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
  },
  placeholderIcon: {
    marginBottom: 8,
  },
  placeholderText: {
    color: '#1A3C40',
    fontSize: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    color: '#1A3C40',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#5D9C59',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  outlineButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#5D9C59',
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
  primaryResultCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
  },
  textureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  primaryTextureName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3C40',
  },
  confidenceValue: {
    fontSize: 14,
    color: '#666',
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#EEE',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
  },
  description: {
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  propertiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  propertyTag: {
    padding: 8,
    borderRadius: 4,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  propertyText: {
    color: '#1A3C40',
    fontSize: 12,
  },
  cropRecommendationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cropRecommendationText: {
    fontWeight: '600',
    marginRight: 8,
  },
  textureCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  textureType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A3C40',
  },
  promptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  promptContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '80%',
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 12,
    textAlign: 'center',
  },
  promptText: {
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  promptButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  promptButtonNo: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#5D9C59',
    borderRadius: 8,
    marginRight: 8,
  },
  promptButtonYes: {
    flex: 1,
    backgroundColor: '#5D9C59',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  promptButtonText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  // FAQ Styles
  faqItem: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 12,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1A3C40',
  },
  faqAnswer: {
    paddingVertical: 8,
    paddingLeft: 8,
  },
  faqAnswerText: {
    color: '#666',
    lineHeight: 20,
  },
   loadingModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  loadingModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
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
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default HomeScreen;