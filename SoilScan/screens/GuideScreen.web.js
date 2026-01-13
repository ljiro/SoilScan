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
import { OpenStreetMap } from "../components";

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
      {/* OpenStreetMap for Web */}
      <OpenStreetMap
        latitude={location?.latitude || 14.5995}
        longitude={location?.longitude || 120.9842}
        zoom={15}
        showUserLocation={true}
        style={styles.map}
      />

      {/* Weather Card Overlay */}
      {weatherData && (
        <View style={styles.weatherCard}>
          <Ionicons name="partly-sunny" size={24} color="#FFB347" />
          <Text style={styles.weatherTemp}>{Math.round(weatherData.main.temp)}°C</Text>
          <Text style={styles.weatherDesc}>{weatherData.weather[0].description}</Text>
          <View style={styles.weatherDetails}>
            <View style={styles.weatherItem}>
              <Ionicons name="water" size={14} color="#5D9C59" />
              <Text style={styles.weatherValue}>{weatherData.main.humidity}%</Text>
            </View>
          </View>
        </View>
      )}

      {/* Floating Soil Data Card */}
      <View style={styles.floatingCard}>
        <Text style={styles.cardTitle}>Soil Health Data</Text>
        <View style={styles.dataGrid}>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>N</Text>
            <Text style={styles.dataValue}>{soilData.nitrogen}</Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>P</Text>
            <Text style={styles.dataValue}>{soilData.phosphorus}</Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>K</Text>
            <Text style={styles.dataValue}>{soilData.potassium}</Text>
          </View>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>pH</Text>
            <Text style={styles.dataValue}>{soilData.ph}</Text>
          </View>
        </View>

        {/* Fertilizer Button */}
        <TouchableOpacity
          style={styles.fertilizerButton}
          onPress={handleFertilizerRecommendation}
          activeOpacity={0.8}
        >
          <Ionicons name="leaf-outline" size={18} color="#fff" />
          <Text style={styles.fertilizerButtonText}>Get Recommendation</Text>
        </TouchableOpacity>
      </View>

      {/* OpenStreetMap Attribution */}
      <View style={styles.osmBanner}>
        <Ionicons name="map" size={14} color="#5D9C59" />
        <Text style={styles.osmBannerText}>OpenStreetMap</Text>
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
  map: {
    flex: 1,
  },
  weatherCard: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 120,
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
  weatherDetails: {
    flexDirection: "row",
    marginTop: 8,
  },
  weatherItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  weatherValue: {
    fontSize: 12,
    color: "#495057",
    fontWeight: "500",
    marginLeft: 4,
  },
  floatingCard: {
    position: "absolute",
    bottom: 60,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 12,
    textAlign: "center",
    color: "#1A3C40",
  },
  dataGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 16,
  },
  dataItem: {
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  dataLabel: {
    fontWeight: "600",
    color: "#5D9C59",
    fontSize: 12,
  },
  dataValue: {
    fontWeight: "700",
    color: "#1A3C40",
    fontSize: 18,
    marginTop: 2,
  },
  fertilizerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: "#FF6B35",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  fertilizerButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    marginLeft: 8,
  },
  osmBanner: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  osmBannerText: {
    fontSize: 12,
    color: "#5D9C59",
    fontWeight: "600",
    marginLeft: 6,
  },
});
