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

const API_ENDPOINT = 'https://soilscanMLtraining-soilscan-api2.hf.space/predict';

const HomeScreen = ({ navigation }) => {
  const [image, setImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState([]);
  const [selectedTexture, setSelectedTexture] = useState(null);
  const [showCropRecommendationModal, setShowCropRecommendationModal] = useState(false);
  const [soilTextureParam, setSoilTextureParam] = useState('');

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

      const output = result.predictions;

      if (!Array.isArray(output)) {
        throw new Error('Unexpected API response format');
      }

      // Format results for texture predictions
      const formattedResults = output.map((item) => ({
        name: item.texture_name || 'Unknown',
        description: item.description || 'No description available.',
        properties: item.properties || [],
        confidence: Math.round(item.confidence * 100),
        classification: item.classification || 'N/A',
      }));

      setResults(formattedResults);
      setSelectedTexture(formattedResults[0]);
      setSoilTextureParam(formattedResults[0].name); // Set top prediction as default for crop recommendation

    } catch (error) {
      console.error('Upload Error:', error);
      Alert.alert('Error', `Failed to analyze soil texture:\n\n${error.message}`);
      setResults([]);
      setSelectedTexture(null);
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
              <View style={styles.textureIconContainer}>
                <Icon name="pagelines" size={24} color="#5D9C59" />
              </View>
              <View>
                <Text style={styles.primaryTextureName}>{selectedTexture.name}</Text>
                <Text style={styles.classification}>{selectedTexture.classification}</Text>
              </View>
            </View>

            <View style={styles.confidenceContainer}>
              <Text style={styles.confidenceValue}>
                {selectedTexture.confidence}% Confidence
              </Text>
              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    { width: `${selectedTexture.confidence}%` },
                  ]}
                />
              </View>
            </View>

            <Text style={styles.description}>{selectedTexture.description}</Text>

            <View style={styles.propertiesContainer}>
              {selectedTexture.properties.map((prop, i) => (
                <View key={i} style={styles.propertyTag}>
                  <Text style={styles.propertyText}>{prop}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.cropRecommendationButton}
              onPress={handleCropRecommendation}
            >
              <Text style={styles.cropRecommendationText}>
                Get Crop Recommendations
              </Text>
              <Icon name="arrow-right" size={14} color="#5D9C59" />
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
                <View style={styles.textureIconContainer}>
                  <Icon name="pagelines" size={20} color="#5D9C59" />
                </View>
                <View>
                  <Text style={styles.textureType}>{item.name}</Text>
                  <Text style={styles.classification}>{item.classification}</Text>
                </View>
              </View>

              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceValue}>{item.confidence}%</Text>
                <View style={styles.confidenceBar}>
                  <View
                    style={[
                      styles.confidenceFill,
                      { width: `${item.confidence}%` },
                    ]}
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

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
  // ... (keep all your existing styles)

  // Add these new styles:
  textureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  textureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EDF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  primaryTextureName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A3C40',
  },
  textureType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A3C40',
  },
  classification: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  cropRecommendationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#EDF7ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5D9C59',
  },
  cropRecommendationText: {
    color: '#5D9C59',
    fontWeight: '600',
    marginRight: 8,
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
    color: '#1A3C40',
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
});

export default HomeScreen;