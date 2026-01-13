import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import Icon from 'react-native-vector-icons/FontAwesome';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Lens cap configuration
const GUIDE_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.75; // 75% of smaller dimension
const TARGET_SIZE = 224; // Model input requirement

const CameraScreen = ({ navigation }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entry animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Pulse animation for guide frame
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Calculate crop region based on camera preview vs actual photo dimensions
  const calculateCropRegion = (photoWidth, photoHeight) => {
    const screenAspect = SCREEN_WIDTH / SCREEN_HEIGHT;
    const photoAspect = photoWidth / photoHeight;

    let scale, offsetX, offsetY;

    if (photoAspect > screenAspect) {
      // Photo is wider - height is constraining factor
      scale = photoHeight / SCREEN_HEIGHT;
      offsetX = (photoWidth - SCREEN_WIDTH * scale) / 2;
      offsetY = 0;
    } else {
      // Photo is taller - width is constraining factor
      scale = photoWidth / SCREEN_WIDTH;
      offsetX = 0;
      offsetY = (photoHeight - SCREEN_HEIGHT * scale) / 2;
    }

    const guideCenterX = SCREEN_WIDTH / 2;
    const guideCenterY = SCREEN_HEIGHT / 2;
    const halfGuide = GUIDE_SIZE / 2;

    return {
      originX: Math.max(0, offsetX + (guideCenterX - halfGuide) * scale),
      originY: Math.max(0, offsetY + (guideCenterY - halfGuide) * scale),
      width: GUIDE_SIZE * scale,
      height: GUIDE_SIZE * scale,
    };
  };

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      const { width: photoWidth, height: photoHeight, uri } = photo;

      // Calculate crop region
      const cropRegion = calculateCropRegion(photoWidth, photoHeight);

      // Use expo-image-manipulator to crop and resize
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX: Math.round(cropRegion.originX),
              originY: Math.round(cropRegion.originY),
              width: Math.round(cropRegion.width),
              height: Math.round(cropRegion.height),
            },
          },
          {
            resize: {
              width: TARGET_SIZE,
              height: TARGET_SIZE,
            },
          },
        ],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Navigate back with the processed image
      navigation.navigate('MainTabs', {
        screen: 'Home',
        params: {
          capturedImageUri: manipulatedImage.uri,
          fromCamera: true,
        },
      });
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const handleClose = () => {
    navigation.goBack();
  };

  // Permission handling
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#5D9C59" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Icon name="camera" size={64} color="#5D9C59" />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          SoilScan needs camera access to photograph soil samples for analysis.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {/* Lens Cap Overlay */}
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          {/* Top dark area */}
          <View style={[styles.darkArea, { height: (SCREEN_HEIGHT - GUIDE_SIZE) / 2 }]} />

          {/* Middle row */}
          <View style={styles.middleRow}>
            {/* Left dark area */}
            <View style={[styles.darkArea, { width: (SCREEN_WIDTH - GUIDE_SIZE) / 2 }]} />

            {/* Guide frame (transparent center) */}
            <Animated.View
              style={[
                styles.guideFrame,
                {
                  width: GUIDE_SIZE,
                  height: GUIDE_SIZE,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              {/* Corner brackets */}
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </Animated.View>

            {/* Right dark area */}
            <View style={[styles.darkArea, { width: (SCREEN_WIDTH - GUIDE_SIZE) / 2 }]} />
          </View>

          {/* Bottom dark area */}
          <View style={[styles.darkArea, { flex: 1 }]} />
        </Animated.View>

        {/* Instruction text */}
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>Position soil sample here</Text>
          <Text style={styles.subInstructionText}>Fill the frame with your sample</Text>
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Icon name="times" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Capture button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <ActivityIndicator size="large" color="#5D9C59" />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Placeholder for symmetry */}
          <View style={styles.placeholder} />
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  darkArea: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  middleRow: {
    flexDirection: 'row',
    height: GUIDE_SIZE,
  },
  guideFrame: {
    borderWidth: 3,
    borderColor: '#5D9C59',
    borderRadius: 12,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 5,
    borderRightWidth: 5,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 5,
    borderLeftWidth: 5,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 5,
    borderRightWidth: 5,
    borderBottomRightRadius: 12,
  },
  instructionContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  subInstructionText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 15,
    marginTop: 6,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 5,
    borderColor: '#5D9C59',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#5D9C59',
  },
  closeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    width: 50,
    height: 50,
  },
  // Permission screen styles
  permissionContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A3C40',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionText: {
    fontSize: 16,
    color: '#6C757D',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#5D9C59',
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 15,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#6C757D',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default CameraScreen;
