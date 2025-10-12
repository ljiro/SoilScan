import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
} from "react-native";
import Svg, { Polygon } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

export default function GuideScreen({ navigation }) {
  const [showPolygon, setShowPolygon] = useState(false);

  // Polygon points moved slightly lower (added 20 to Y values)
  const polygonPoints = "150,150 250,180 200,200 100,190";

  const soilData = {
    nitrogen: "25",
    phosphorus: "15", 
    potassium: "30",
    ph: "6.5",
    moisture: "40",
    temperature: "25", // Add default temperature
    humidity: "60", // Add default humidity
  };

  // Animation and gesture for card swipe
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
          // Hide the card and polygon if swiped down enough
          Animated.timing(translateY, {
            toValue: height,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setShowPolygon(false);
            translateY.setValue(0);
          });
        } else {
          // Reset position
          Animated.spring(translateY, {
            toValue: 0,
            bounciness: 6,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleFertilizerRecommendation = () => {
    // Prepare navigation data with soil analysis results
    const navigationData = {
      nitrogen: soilData.nitrogen,
      phosphorous: soilData.phosphorus,
      potassium: soilData.potassium,
      moisture: soilData.moisture,
      temperature: soilData.temperature,
      humidity: soilData.humidity,
      soilType: "Loamy", // You can make this dynamic based on soil analysis
    };

    // Navigate to FertilizerRecommendationScreen with the data
    navigation.navigate('Fertilizer', navigationData);
  };

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../assets/soilscan-map.png")}
        style={styles.map}
        resizeMode="cover"
      >
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
          {showPolygon && (
            <Polygon
              points={polygonPoints}
              fill="rgba(0,200,0,0.3)"
              stroke="green"
              strokeWidth="3"
            />
          )}
        </Svg>

        {/* Draw Zone Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowPolygon(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={26} color="#fff" />
          <Text style={styles.fabText}>Draw Zone</Text>
        </TouchableOpacity>

        {/* Results Card */}
        {showPolygon && (
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
            
            {/* Additional environmental data */}
            <View style={styles.environmentSection}>
              <Text style={styles.sectionSubtitle}>Environmental Data</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Temperature:</Text>
                <Text style={styles.value}>{soilData.temperature}°C</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Humidity:</Text>
                <Text style={styles.value}>{soilData.humidity}%</Text>
              </View>
            </View>
            
            {/* Fertilizer Recommendation Button */}
            <TouchableOpacity
              style={styles.fertilizerButton}
              onPress={handleFertilizerRecommendation}
              activeOpacity={0.8}
            >
              <Ionicons name="leaf-outline" size={20} color="#fff" />
              <Text style={styles.fertilizerButtonText}>
                Fertilizer Recommendation
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  map: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    top: 40,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00A86B",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 50,
    elevation: 4,
    zIndex: 10,
  },
  fabText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -3 },
  },
  swipeIndicator: {
    width: 40,
    height: 5,
    backgroundColor: "#ccc",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 10,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 20,
    marginBottom: 12,
    textAlign: "center",
    color: "#1A3C40",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  label: {
    fontWeight: "500",
    color: "#333",
    fontSize: 14,
  },
  value: {
    fontWeight: "600",
    color: "#00A86B",
    fontSize: 14,
  },
  environmentSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  sectionSubtitle: {
    fontWeight: "600",
    color: "#1A3C40",
    marginBottom: 8,
    fontSize: 16,
  },
  fertilizerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  fertilizerButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },
});