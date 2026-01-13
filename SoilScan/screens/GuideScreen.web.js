import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

// OpenWeatherMap API (free tier)
const WEATHER_API_KEY = "bd5e378503939ddaee76f12ad7a97608";

export default function GuideScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [soilData, setSoilData] = useState({
    nitrogen: "25",
    phosphorus: "15",
    potassium: "30",
    ph: "6.5",
    moisture: "40",
    temperature: "--",
    humidity: "--",
  });

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          let currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low,
          });
          setLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          });
          fetchWeather(currentLocation.coords.latitude, currentLocation.coords.longitude);
        } else {
          setLocation({ latitude: 14.5995, longitude: 120.9842 });
        }
      } catch (error) {
        setLocation({ latitude: 14.5995, longitude: 120.9842 });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const fetchWeather = async (lat, lon) => {
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`
      );
      if (response.ok) {
        const data = await response.json();
        setWeatherData(data);
        setSoilData(prev => ({
          ...prev,
          temperature: Math.round(data.main.temp).toString(),
          humidity: Math.round(data.main.humidity).toString(),
        }));
      }
    } catch (error) {
      console.error("Weather fetch error:", error);
    }
  };

  const handleFertilizerRecommendation = () => {
    navigation.navigate("Fertilizer", {
      nitrogen: soilData.nitrogen,
      phosphorous: soilData.phosphorus,
      potassium: soilData.potassium,
      moisture: soilData.moisture,
      temperature: soilData.temperature,
      humidity: soilData.humidity,
      soilType: "Loamy",
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5D9C59" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Web Placeholder for Map */}
      <View style={styles.webMapPlaceholder}>
        <Ionicons name="map-outline" size={64} color="#5D9C59" />
        <Text style={styles.webMapText}>Map View</Text>
        <Text style={styles.webMapSubtext}>Maps are only available on mobile devices</Text>

        {/* Weather Info */}
        {weatherData && (
          <View style={styles.weatherCard}>
            <Ionicons name="partly-sunny" size={24} color="#FFB347" />
            <Text style={styles.weatherTemp}>{Math.round(weatherData.main.temp)}°C</Text>
            <Text style={styles.weatherDesc}>{weatherData.weather[0].description}</Text>
          </View>
        )}

        {/* Location Info */}
        {location && (
          <Text style={styles.locationText}>
            Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </Text>
        )}

        {/* Soil Data Card */}
        <View style={styles.dataCard}>
          <Text style={styles.cardTitle}>Soil Health Data</Text>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Nitrogen:</Text>
            <Text style={styles.dataValue}>{soilData.nitrogen} ppm</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Phosphorus:</Text>
            <Text style={styles.dataValue}>{soilData.phosphorus} ppm</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Potassium:</Text>
            <Text style={styles.dataValue}>{soilData.potassium} ppm</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>pH:</Text>
            <Text style={styles.dataValue}>{soilData.ph}</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Temperature:</Text>
            <Text style={styles.dataValue}>{soilData.temperature}°C</Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>Humidity:</Text>
            <Text style={styles.dataValue}>{soilData.humidity}%</Text>
          </View>
        </View>

        {/* Fertilizer Button */}
        <TouchableOpacity
          style={styles.fertilizerButton}
          onPress={handleFertilizerRecommendation}
          activeOpacity={0.8}
        >
          <Ionicons name="leaf-outline" size={20} color="#fff" />
          <Text style={styles.fertilizerButtonText}>Get Fertilizer Recommendation</Text>
        </TouchableOpacity>
      </View>
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
  webMapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    padding: 24,
  },
  webMapText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1A3C40",
    marginTop: 16,
  },
  webMapSubtext: {
    fontSize: 14,
    color: "#6c757d",
    marginTop: 8,
    marginBottom: 24,
  },
  weatherCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  },
  locationText: {
    fontSize: 12,
    color: "#6c757d",
    marginBottom: 16,
  },
  dataCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 16,
    textAlign: "center",
    color: "#1A3C40",
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dataLabel: {
    fontWeight: "500",
    color: "#495057",
    fontSize: 14,
  },
  dataValue: {
    fontWeight: "600",
    color: "#5D9C59",
    fontSize: 14,
  },
  fertilizerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginTop: 24,
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
