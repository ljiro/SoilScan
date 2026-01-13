import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * OpenStreetMap component using Leaflet in a WebView
 * Free, no API key required
 */
const OpenStreetMap = ({
  latitude,
  longitude,
  zoom = 15,
  markers = [],
  polygonCoords = [],
  onMapPress,
  showUserLocation = true,
  style,
}) => {
  const webViewRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);

  // Generate the HTML for the Leaflet map
  const generateMapHTML = () => {
    const markersJS = markers.map((marker, index) => `
      L.marker([${marker.latitude}, ${marker.longitude}])
        .addTo(map)
        .bindPopup('Point ${index + 1}');
    `).join('\n');

    const polygonJS = polygonCoords.length >= 3 ? `
      var polygon = L.polygon([
        ${polygonCoords.map(c => `[${c.latitude}, ${c.longitude}]`).join(',\n')}
      ], {
        color: '#5D9C59',
        fillColor: '#5D9C59',
        fillOpacity: 0.3,
        weight: 3
      }).addTo(map);
    ` : '';

    const userLocationJS = showUserLocation ? `
      // User location marker
      var userIcon = L.divIcon({
        className: 'user-location',
        html: '<div class="pulse"></div><div class="dot"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker([${latitude}, ${longitude}], {icon: userIcon}).addTo(map);
    ` : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map {
      width: 100%;
      height: 100%;
      background: #E8F5E9;
    }

    /* User location pulse animation */
    .user-location {
      position: relative;
    }
    .user-location .dot {
      width: 14px;
      height: 14px;
      background: #5D9C59;
      border: 3px solid white;
      border-radius: 50%;
      position: absolute;
      top: 3px;
      left: 3px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .user-location .pulse {
      width: 20px;
      height: 20px;
      background: rgba(93, 156, 89, 0.4);
      border-radius: 50%;
      position: absolute;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(1); opacity: 1; }
      100% { transform: scale(2.5); opacity: 0; }
    }

    /* Custom controls styling */
    .leaflet-control-zoom a {
      background: white !important;
      color: #5D9C59 !important;
      font-weight: bold;
    }
    .leaflet-control-zoom a:hover {
      background: #E8F5E9 !important;
    }

    /* Attribution styling */
    .leaflet-control-attribution {
      font-size: 10px;
      background: rgba(255,255,255,0.8) !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Initialize map
    var map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView([${latitude}, ${longitude}], ${zoom});

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    ${userLocationJS}
    ${markersJS}
    ${polygonJS}

    // Handle map clicks
    map.on('click', function(e) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapPress',
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      }));
    });

    // Notify that map is ready
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
  </script>
</body>
</html>
    `;
  };

  // Handle messages from WebView
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'mapReady') {
        setIsLoading(false);
      } else if (data.type === 'mapPress' && onMapPress) {
        onMapPress({
          nativeEvent: {
            coordinate: {
              latitude: data.latitude,
              longitude: data.longitude,
            },
          },
        });
      }
    } catch (error) {
      console.error('WebView message error:', error);
    }
  };

  // Update map when coordinates change
  useEffect(() => {
    if (webViewRef.current && !isLoading) {
      webViewRef.current.injectJavaScript(`
        map.setView([${latitude}, ${longitude}], ${zoom});
        true;
      `);
    }
  }, [latitude, longitude, zoom, isLoading]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: generateMapHTML() }}
        style={styles.webView}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={true}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#5D9C59" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E9',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#5D9C59',
    fontWeight: '500',
  },
});

export default OpenStreetMap;
