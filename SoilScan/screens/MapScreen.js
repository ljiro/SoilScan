import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import MapView from 'react-native-maps';

const MapScreen = () => {
  const legendItems = [
    { color: '#A67B5B', label: 'Sandy Soil' },
    { color: '#7B5B3E', label: 'Clay Soil' },
    { color: '#8FBC8F', label: 'Loamy Soil' },
    { color: '#D2B48C', label: 'Sandy Loam' },
    { color: '#5D9C59', label: 'Peaty Soil' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="map-marked-alt" size={20} color="#5D9C59" style={styles.sectionIcon} />
          <Text style={styles.sectionTitle}>Soil Map</Text>
        </View>
        <Text style={styles.sectionDescription}>
          View soil types in your area and compare with your test results.
        </Text>
        
        <View style={styles.mapContainer}>
          <View style={styles.mapPlaceholder}>
            <Icon name="map" size={48} color="#5D9C59" style={styles.placeholderIcon} />
            <Text style={styles.placeholderText}>Interactive map would display here</Text>
          </View>
        </View>
        
        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.mapButton}>
            <Icon name="location-arrow" size={16} color="#5D9C59" style={styles.buttonIcon} />
            <Text style={styles.mapButtonText}>My Location</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.mapButton}>
            <Icon name="layer-group" size={16} color="#5D9C59" style={styles.buttonIcon} />
            <Text style={styles.mapButtonText}>Layers</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.legend}>
          <View style={styles.sectionHeader}>
            <Icon name="list-alt" size={20} color="#5D9C59" style={styles.sectionIcon} />
            <Text style={styles.sectionTitle}>Soil Legend</Text>
          </View>
          
          {legendItems.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A3C40',
  },
  sectionDescription: {
    color: '#666',
    marginBottom: 16,
  },
  sectionIcon: {
    marginRight: 8,
  },
  mapContainer: {
    height: 300,
    backgroundColor: '#eee',
    borderRadius: 12,
    marginVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  mapPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    marginBottom: 16,
  },
  placeholderText: {
    color: '#666',
  },
  mapControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5D9C59',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  mapButtonText: {
    color: '#5D9C59',
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  legend: {
    marginTop: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 12,
  },
  legendLabel: {
    color: '#1A3C40',
  },
});

export default MapScreen;