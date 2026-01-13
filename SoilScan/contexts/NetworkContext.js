import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';

const NetworkContext = createContext({
  isConnected: true,
  isInternetReachable: true,
});

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider = ({ children }) => {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isInternetReachable: true,
  });
  const [showBanner, setShowBanner] = useState(false);
  const slideAnim = useState(new Animated.Value(-60))[0];

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isOnline = state.isConnected && state.isInternetReachable;

      setNetworkState({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
      });

      if (!isOnline) {
        setShowBanner(true);
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 8,
        }).start();
      } else if (showBanner) {
        // Show "Back online" briefly then hide
        setTimeout(() => {
          Animated.timing(slideAnim, {
            toValue: -60,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowBanner(false));
        }, 2000);
      }
    });

    return () => unsubscribe();
  }, [showBanner]);

  const isOnline = networkState.isConnected && networkState.isInternetReachable;

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
      {showBanner && (
        <Animated.View
          style={[
            styles.banner,
            isOnline ? styles.bannerOnline : styles.bannerOffline,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Ionicons
            name={isOnline ? 'wifi' : 'cloud-offline'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.bannerText}>
            {isOnline ? 'Back online' : 'No internet connection'}
          </Text>
        </Animated.View>
      )}
    </NetworkContext.Provider>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 10,
    zIndex: 9999,
  },
  bannerOffline: {
    backgroundColor: '#E53935',
  },
  bannerOnline: {
    backgroundColor: '#43A047',
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default NetworkContext;
