import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

const HomeScreen = () => {
  const [image, setImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState([
    {
      type: 'Nitrogen',
      confidence: 87,
      description: 'Might experience excessive vegetative growth at the expense of fruit or flower production...',
      properties: ['High Density', 'Rich Nutrients'],
    },
    {
      type: 'Phosphorous',
      confidence: 12,
      description: '',
      properties: [],
    },
    {
      type: 'Potassium',
      confidence: 87,
      description: '',
      properties: [],
    },
  ]);

  const handleCapture = () => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
      },
      (response) => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.error) {
          console.log('ImagePicker Error: ', response.error);
        } else {
          setIsAnalyzing(true);
          setImage(response.assets[0].uri);
          
          // Simulate analysis
          setTimeout(() => {
            setIsAnalyzing(false);
          }, 2000);
        }
      }
    );
  };

  const handleUpload = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
      },
      (response) => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
        } else if (response.error) {
          console.log('ImagePicker Error: ', response.error);
        } else {
          setIsAnalyzing(true);
          setImage(response.assets[0].uri);
          
          // Simulate analysis
          setTimeout(() => {
            setIsAnalyzing(false);
          }, 2000);
        }
      }
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Scan Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Scan Soil Sample</Text>
        
        <View style={styles.scanPreview}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} />
          ) : (
            <View style={styles.placeholder}>
              <Icon name="camera" size={48} color="#1A3C40" style={styles.placeholderIcon} />
              <Text style={styles.placeholderText}>No image captured</Text>
            </View>
          )}
          
          {isAnalyzing && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#5D9C59" />
              <Text style={styles.loadingText}>Analyzing soil sample...</Text>
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
      
      {/* Results Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="seedling" size={20} color="#5D9C59" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Analysis Results</Text>
        </View>
        
        {results.map((item, index) => (
          <View key={index} style={styles.soilCard}>
            <Text style={styles.soilType}>{item.type}</Text>
            
            <View style={styles.confidenceContainer}>
              <Text style={styles.confidenceValue}>{Math.round(item.confidence)}%</Text>
              <View style={styles.confidenceBar}>
                <View style={[styles.confidenceFill, { width: `${item.confidence}%` }]} />
              </View>
            </View>
            
            {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
            
            {item.properties.length > 0 && (
              <View style={styles.propertiesContainer}>
                {item.properties.map((prop, i) => (
                  <View key={i} style={styles.propertyTag}>
                    <Text style={styles.propertyText}>{prop}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
      
      {/* History Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="history" size={20} color="#5D9C59" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Scan History</Text>
        </View>
        
        <HistoryItem color="#A67B5B" type="Sandy Loam" date="Today, 10:23 AM" />
        <HistoryItem color="#7B5B3E" type="Clay Soil" date="Yesterday, 4:45 PM" />
        <HistoryItem color="#D2B48C" type="Sandy Soil" date="March 28, 2023" />
      </View>
    </ScrollView>
  );
};

const HistoryItem = ({ color, type, date }) => (
  <View style={styles.historyItem}>
    <View style={[styles.historyColor, { backgroundColor: color }]} />
    <View style={styles.historyInfo}>
      <Text style={styles.historyType}>{type}</Text>
      <Text style={styles.historyDate}>{date}</Text>
    </View>
    <Icon name="chevron-right" size={16} color="#666" />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A3C40',
  },
  sectionIcon: {
    marginRight: 8,
  },
  scanPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#C7E8CA',
    borderRadius: 12,
    marginVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    opacity: 0.7,
    marginBottom: 8,
  },
  placeholderText: {
    color: '#1A3C40',
    opacity: 0.7,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#5D9C59',
    borderRadius: 25,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    shadowColor: '#5D9C59',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  outlineButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#5D9C59',
    borderRadius: 25,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  soilCard: {
    backgroundColor: '#C7E8CA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  soilType: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A3C40',
    marginBottom: 8,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  confidenceValue: {
    fontWeight: '600',
    marginRight: 8,
    color: '#1A3C40',
  },
  confidenceBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#5D9C59',
    borderRadius: 4,
  },
  description: {
    marginTop: 8,
    color: '#1A3C40',
  },
  propertiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  propertyTag: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 25,
    marginRight: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  propertyText: {
    fontSize: 12,
    fontWeight: '500',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  historyColor: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyType: {
    fontWeight: '600',
    color: '#1A3C40',
  },
  historyDate: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.6)',
  },
});

export default HomeScreen;