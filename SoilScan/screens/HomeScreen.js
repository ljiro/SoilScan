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
  Linking,
  Modal,
  TextInput,
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
  const [showCropRecommendationModal, setShowCropRecommendationModal] = useState(false);
  const [soilTextureParam, setSoilTextureParam] = useState('');
  const [showRecommendationPrompt, setShowRecommendationPrompt] = useState(false);

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

  const uploadImageToAPI = async (fileUri) => {
    setIsAnalyzing(true);

    let result = null;

    try {
      const fileName = fileUri.split('/').pop();
      const fileType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';

      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: fileType,
      });

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';

      console.log("Raw response:", text);
      if (!contentType.includes('application/json')) {
        throw new Error(`Non-JSON response: ${text.slice(0, 300)}`);
      }

      try {
        result = JSON.parse(text);
      } catch (e) {
        throw new Error(`Failed to parse JSON: ${text.slice(0, 300)}`);
      }

      if (!result || result.error) {
        throw new Error(result?.error || 'Unknown error');
      }

      // Process the new response format
      const primaryPrediction = {
        name: result.predicted_class || 'Unknown',
        description: result.description || 'No description available.',
        properties: result.properties || [],
        confidence: Math.round(result.confidence * 100),
        color: result.color || '#C19A6B',
      };

      // Process alternative predictions
      const alternativePredictions = [];
      if (result.all_confidences) {
        for (const [texture, data] of Object.entries(result.all_confidences)) {
          alternativePredictions.push({
            name: texture,
            confidence: Math.round(data.score * 100),
            color: data.color || '#C19A6B',
          });
        }
      }

      // Sort alternatives by confidence (descending)
      alternativePredictions.sort((a, b) => b.confidence - a.confidence);

      setResults([primaryPrediction, ...alternativePredictions]);
      setSelectedTexture(primaryPrediction);
      setSoilTextureParam(primaryPrediction.name);
      setShowRecommendationPrompt(true);

    } catch (error) {
      console.error('Upload Error:', error);
      Alert.alert('Error', `Failed to analyze soil texture:\n\n${error.message}`);
      setResults([]);
      setSelectedTexture(null);
      setShowRecommendationPrompt(false);
    } finally {
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

  const handleCropRecommendation = () => {
    setShowCropRecommendationModal(true);
  };

  const navigateToCropRecommendation = () => {
    navigation.navigate('CropRecommendation', { soilTexture: soilTextureParam });
    setShowCropRecommendationModal(false);
    setShowRecommendationPrompt(false);
  };

  const handleRecommendationResponse = (response) => {
    setShowRecommendationPrompt(false);
    if (response) {
      handleCropRecommendation();
    }
  };

  return (
    <ScrollView style={styles.container}>
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
              onPress={handleCropRecommendation}
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
                setSoilTextureParam(item.name);
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
              Would you like to get crop recommendations for {selectedTexture?.name} soil?
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

      <Modal
        visible={showCropRecommendationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCropRecommendationModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Crop Recommendation</Text>
            <Text style={styles.modalText}>
              The detected soil texture is: {selectedTexture?.name}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Soil Texture (you can modify)</Text>
              <TextInput
                style={styles.input}
                value={soilTextureParam}
                onChangeText={setSoilTextureParam}
                placeholder="Enter soil texture"
              />
            </View>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setShowCropRecommendationModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalConfirmButton}
                onPress={navigateToCropRecommendation}
              >
                <Text style={[styles.modalButtonText, { color: 'white' }]}>Continue</Text>
              </TouchableOpacity>
            </View>
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
  content: {
    padding: 16,
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
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A3C59',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalText: {
    color: '#1A3C40',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#5D9C59',
    borderRadius: 8,
    marginRight: 8,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#5D9C59',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalButtonText: {
    textAlign: 'center',
    fontWeight: '600',
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
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  promptButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
});

export default HomeScreen;