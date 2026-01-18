import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';

// Create the context
const NetworkContext = createContext({
  isOnline: true,
  isInternetReachable: true,
  connectionType: null,
});

/**
 * NetworkProvider - Provides network status throughout the app
 *
 * Uses @react-native-community/netinfo to monitor connectivity changes
 */
export function NetworkProvider({ children }) {
  const [networkState, setNetworkState] = useState({
    isOnline: true,
    isInternetReachable: true,
    connectionType: null,
  });

  const unsubscribeRef = useRef(null);

  useEffect(() => {
    // Fetch initial network state
    NetInfo.fetch().then((state) => {
      setNetworkState({
        isOnline: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
        connectionType: state.type,
      });
    });

    // Subscribe to network state updates
    unsubscribeRef.current = NetInfo.addEventListener((state) => {
      setNetworkState({
        isOnline: state.isConnected ?? true,
        isInternetReachable: state.isInternetReachable ?? true,
        connectionType: state.type,
      });
    });

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
}

/**
 * useNetwork - Hook to access network status
 *
 * Returns:
 * - isOnline: boolean - Whether device has network connection
 * - isInternetReachable: boolean - Whether internet is actually reachable
 * - connectionType: string - Type of connection (wifi, cellular, etc.)
 */
export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

export default NetworkContext;
