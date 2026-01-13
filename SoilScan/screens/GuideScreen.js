import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

// OpenWeatherMap API (free tier)
const WEATHER_API_KEY = "bd5e378503939ddaee76f12ad7a97608"; // Public demo key

export default function GuideScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [polygonCoords, setPolygonCoords] = useState([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [markers, setMarkers] = useState([]);
  const [mapError, setMapError] = useState(false);

  const mapRef = useRef(null);

  // Soil data based on location (simulated - in real app would come from soil database)
  const [soilData, setSoilData] = useState({
    nitrogen: "25",
    phosphorus: "15",
    potassium: "30",
    ph: "6.5",
    moisture: "40",
    temperature: "--",
    humidity: "--",
  });

  // Animation for card swipe
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
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
            setShowResults(false);
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

  // Get user location on mount
  useEffect(() => {
    (async () => {
      setIsLoading(true);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Location permission denied. Please enable location services.");
        setIsLoading(false);
        // Set default location (Manila, Philippines as example)
        setLocation({
          latitude: 14.5995,
          longitude: 120.9842,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        return;
      }

      try {
        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const newLocation = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };

        setLocation(newLocation);

        // Fetch weather for this location
        fetchWeather(currentLocation.coords.latitude, currentLocation.coords.longitude);
      } catch (error) {
        console.error("Location error:", error);
        setErrorMsg("Could not get your location. Using default.");
        setLocation({
          latitude: 14.5995,
          longitude: 120.9842,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Fetch weather data
  const fetchWeather = async (lat, lon) => {
    setWeatherLoading(true);
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`
      );

      if (response.ok) {
        const data = await response.json();
        setWeatherData(data);

        // Update soil data with real weather
        setSoilData(prev => ({
          ...prev,
          temperature: Math.round(data.main.temp).toString(),
          humidity: Math.round(data.main.humidity).toString(),
        }));
      }
    } catch (error) {
      console.error("Weather fetch error:", error);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Handle map press for drawing zones
  const handleMapPress = (event) => {
    if (!isDrawingMode) return;

    const { coordinate } = event.nativeEvent;
    setPolygonCoords(prev => [...prev, coordinate]);
    setMarkers(prev => [...prev, coordinate]);
  };

  // Complete the zone drawing
  const handleDrawZone = () => {
    if (isDrawingMode) {
      // Finish drawing
      if (polygonCoords.length >= 3) {
        setShowResults(true);
        setIsDrawingMode(false);
      } else {
        Alert.alert("Draw Zone", "Please tap at least 3 points on the map to create a zone.");
      }
    } else {
      // Start drawing
      setPolygonCoords([]);
      setMarkers([]);
      setIsDrawingMode(true);
      Alert.alert(
        "Draw Mode",
        "Tap on the map to place points. Tap 'Complete Zone' when finished.",
        [{ text: "OK" }]
      );
    }
  };

  // Clear the drawn zone
  const handleClearZone = () => {
    setPolygonCoords([]);
    setMarkers([]);
    setShowResults(false);
    setIsDrawingMode(false);
  };

  // Navigate to fertilizer recommendations
  const handleFertilizerRecommendation = () => {
    const navigationData = {
      nitrogen: soilData.nitrogen,
      phosphorous: soilData.phosphorus,
      potassium: soilData.potassium,
      moisture: soilData.moisture,
      temperature: soilData.temperature,
      humidity: soilData.humidity,
      soilType: "Loamy",
    };

    navigation.navigate("Fertilizer", navigationData);
  };

  // Center map on user location
  const centerOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion(location, 1000);
    }
  };

  // Refresh weather data
  const refreshWeather = () => {
    if (location) {
      fetchWeather(location.latitude, location.longitude);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5D9C59" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  // Fallback UI when map fails to load (e.g., missing Google Maps API key on Android)
  const renderMapFallback = () => (
    <View style={styles.mapFallback}>
      <Ionicons name="map-outline" size={64} color="#5D9C59" />
      <Text style={styles.mapFallbackTitle}>Map Unavailable</Text>
      <Text style={styles.mapFallbackText}>
        {Platform.OS === 'android'
          ? 'Google Maps API key is required for Android. The map feature will be available in the next update.'
          : 'Unable to load map. Please check your internet connection.'}
      </Text>
      {location && (
        <View style={styles.locationInfo}>
          <Ionicons name="location" size={16} color="#5D9C59" />
          <Text style={styles.locationInfoText}>
            Your location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.openMapsButton}
        onPress={() => {
          if (location) {
            const url = Platform.select({
              ios: `maps:?q=${location.latitude},${location.longitude}`,
              android: `geo:${location.latitude},${location.longitude}?q=${location.latitude},${location.longitude}`,
            });
            Linking.openURL(url).catch(() => {
              Alert.alert('Error', 'Could not open maps application');
            });
          }
        }}
      >
        <Ionicons name="navigate" size={18} color="#fff" />
        <Text style={styles.openMapsButtonText}>Open in Maps App</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Map View with error handling */}
      {mapError ? (
        renderMapFallback()
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={location}
          showsUserLocation={true}
          showsMyLocationButton={false}
          onPress={handleMapPress}
          onMapReady={() => {
            console.log('Map loaded successfully');
          }}
          onError={(error) => {
            console.error('Map error:', error);
            setMapError(true);
          }}
          mapType="standard"
          loadingEnabled={true}
          loadingIndicatorColor="#5D9C59"
          loadingBackgroundColor="#f8f8f8"
        >
          {/* Drawn polygon */}
          {polygonCoords.length >= 3 && (
            <Polygon
              coordinates={polygonCoords}
              fillColor="rgba(93, 156, 89, 0.3)"
              strokeColor="#5D9C59"
              strokeWidth={3}
            />
          )}

          {/* Markers for polygon vertices */}
          {markers.map((coord, index) => (
            <Marker
              key={index}
              coordinate={coord}
              pinColor="#5D9C59"
            />
          ))}
        </MapView>
      )}

      {/* Weather Card */}
      {weatherData && (
        <View style={styles.weatherCard}>
          <TouchableOpacity onPress={refreshWeather} style={styles.weatherRefresh}>
            <Ionicons name="refresh" size={16} color="#5D9C59" />
          </TouchableOpacity>
          <Ionicons name="partly-sunny" size={24} color="#FFB347" />
          <Text style={styles.weatherTemp}>{Math.round(weatherData.main.temp)}°C</Text>
          <Text style={styles.weatherDesc}>{weatherData.weather[0].description}</Text>
          <View style={styles.weatherDetails}>
            <View style={styles.weatherItem}>
              <Ionicons name="water" size={14} color="#5D9C59" />
              <Text style={styles.weatherValue}>{weatherData.main.humidity}%</Text>
            </View>
            <View style={styles.weatherItem}>
              <Ionicons name="speedometer" size={14} color="#5D9C59" />
              <Text style={styles.weatherValue}>{weatherData.wind.speed} m/s</Text>
            </View>
          </View>
        </View>
      )}

      {/* Error message */}
      {errorMsg && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning" size={16} color="#FF6B35" />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {/* My Location Button */}
        <TouchableOpacity style={styles.controlButton} onPress={centerOnUser}>
          <Ionicons name="locate" size={24} color="#5D9C59" />
        </TouchableOpacity>

        {/* Clear Zone Button (only show when zone exists) */}
        {polygonCoords.length > 0 && (
          <TouchableOpacity
            style={[styles.controlButton, styles.clearButton]}
            onPress={handleClearZone}
          >
            <Ionicons name="trash" size={24} color="#FF6B35" />
          </TouchableOpacity>
        )}
      </View>

      {/* Draw Zone FAB */}
      <TouchableOpacity
        style={[styles.fab, isDrawingMode && styles.fabActive]}
        onPress={handleDrawZone}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isDrawingMode ? "checkmark" : "create-outline"}
          size={26}
          color="#fff"
        />
        <Text style={styles.fabText}>
          {isDrawingMode ? "Complete Zone" : "Draw Zone"}
        </Text>
      </TouchableOpacity>

      {/* Drawing instructions */}
      {isDrawingMode && (
        <View style={styles.instructionBanner}>
          <Ionicons name="information-circle" size={20} color="#fff" />
          <Text style={styles.instructionText}>
            Tap on the map to draw your zone ({polygonCoords.length} points)
          </Text>
        </View>
      )}

      {/* Results Card */}
      {showResults && (
        <Animated.View
          style={[styles.card, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}
        >
          <View style={styles.swipeIndicator} />
          <Text style={styles.cardTitle}>Soil Health Results</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Nitrogen:</Text>
            <Text style={styles.value}>{soilData.nitrogen} ppm</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phosphorus:</Text>
            <Text style={styles.value}>{soilData.phosphorus} ppm</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Potassium:</Text>
            <Text style={styles.value}>{soilData.potassium} ppm</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>pH:</Text>
            <Text style={styles.value}>{soilData.ph}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Moisture:</Text>
            <Text style={styles.value}>{soilData.moisture}%</Text>
          </View>

          {/* Environmental data from weather API */}
          <View style={styles.environmentSection}>
            <Text style={styles.sectionSubtitle}>
              Environmental Data {weatherLoading && <ActivityIndicator size="small" color="#5D9C59" />}
            </Text>
            <View style={styles.row}>
              <Text style={styles.label}>Temperature:</Text>
              <Text style={styles.value}>{soilData.temperature}°C</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Humidity:</Text>
              <Text style={styles.value}>{soilData.humidity}%</Text>
            </View>
          </View>

          {/* Zone info */}
          <View style={styles.zoneInfo}>
            <Ionicons name="location" size={16} color="#5D9C59" />
            <Text style={styles.zoneInfoText}>
              Zone Area: {polygonCoords.length} vertices
            </Text>
          </View>

          {/* Fertilizer Recommendation Button */}
          <TouchableOpacity
            style={styles.fertilizerButton}
            onPress={handleFertilizerRecommendation}
            activeOpacity={0.8}
          >
            <Ionicons name="leaf-outline" size={20} color="#fff" />
            <Text style={styles.fertilizerButtonText}>
              Get Fertilizer Recommendation
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6c757d",
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    padding: 24,
  },
  mapFallbackTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A3C40",
    marginTop: 16,
    marginBottom: 8,
  },
  mapFallbackText: {
    fontSize: 14,
    color: "#6c757d",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  locationInfoText: {
    fontSize: 13,
    color: "#495057",
    marginLeft: 8,
  },
  openMapsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#5D9C59",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    shadowColor: "#5D9C59",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  openMapsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 10,
  },
  weatherCard: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    minWidth: 120,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  weatherRefresh: {
    position: "absolute",
    top: 8,
    right: 8,
    padding: 4,
  },
  weatherTemp: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A3C40",
    marginTop: 4,
  },
  weatherDesc: {
    fontSize: 12,
    color: "#6c757d",
    textTransform: "capitalize",
    marginBottom: 8,
  },
  weatherDetails: {
    flexDirection: "row",
    gap: 16,
  },
  weatherItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  weatherValue: {
    fontSize: 12,
    color: "#495057",
    fontWeight: "500",
  },
  errorBanner: {
    position: "absolute",
    top: 16,
    left: 150,
    right: 16,
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: "#E65100",
  },
  controlsContainer: {
    position: "absolute",
    right: 16,
    bottom: 140,
    gap: 12,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  clearButton: {
    backgroundColor: "#FFF3E0",
  },
  fab: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#5D9C59",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 50,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  fabActive: {
    backgroundColor: "#FF6B35",
  },
  fabText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 8,
    fontSize: 15,
  },
  instructionBanner: {
    position: "absolute",
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: "#5D9C59",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  instructionText: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  card: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    paddingTop: 12,
    paddingBottom: 30,
    paddingHorizontal: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
  },
  swipeIndicator: {
    width: 40,
    height: 5,
    backgroundColor: "#E0E0E0",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 20,
    marginBottom: 16,
    textAlign: "center",
    color: "#1A3C40",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  label: {
    fontWeight: "500",
    color: "#495057",
    fontSize: 15,
  },
  value: {
    fontWeight: "600",
    color: "#5D9C59",
    fontSize: 15,
  },
  environmentSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  sectionSubtitle: {
    fontWeight: "600",
    color: "#1A3C40",
    marginBottom: 8,
    fontSize: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  zoneInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#E8F5E9",
    borderRadius: 10,
  },
  zoneInfoText: {
    color: "#2E7D32",
    fontSize: 14,
    fontWeight: "500",
  },
  fertilizerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 16,
    elevation: 3,
    shadowColor: "#FF6B35",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fertilizerButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    marginLeft: 10,
  },
});
