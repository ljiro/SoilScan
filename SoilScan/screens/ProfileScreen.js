import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getScanStats } from '../utils/storage';

const ProfileScreen = ({ navigation }) => {
  const [stats, setStats] = useState({
    scans: 0,
    soilTypes: 0,
    locations: 0,
  });
  const [recentScans, setRecentScans] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load stats from storage when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const scanStats = await getScanStats();
      setStats({
        scans: scanStats.totalScans,
        soilTypes: scanStats.uniqueSoilTypes,
        locations: scanStats.uniqueLocations,
      });
      setRecentScans(scanStats.recentScans || []);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  const handleSavedGuides = () => {
    Alert.alert(
      'Saved Guides',
      'You have no saved guides yet. Bookmark helpful articles from the app to see them here.',
      [{ text: 'OK' }]
    );
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Check out SoilScan - AI-powered soil analysis for smarter farming! Download now: https://soilscan.app',
        title: 'Share SoilScan',
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share the app. Please try again.');
    }
  };

  const handleHelpSupport = () => {
    navigation.navigate('Help');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Signed Out', 'You have been signed out successfully.');
          }
        },
      ]
    );
  };

  const actionItems = [
    {
      icon: 'cog',
      ionicon: 'settings-outline',
      title: 'Settings',
      desc: 'App preferences and notifications',
      onPress: handleSettings,
    },
    {
      icon: 'bookmark',
      ionicon: 'bookmark-outline',
      title: 'Saved Guides',
      desc: 'Your bookmarked articles',
      onPress: handleSavedGuides,
    },
    {
      icon: 'share-alt',
      ionicon: 'share-social-outline',
      title: 'Share App',
      desc: 'Invite friends to SoilScan',
      onPress: handleShareApp,
    },
    {
      icon: 'question-circle',
      ionicon: 'help-circle-outline',
      title: 'Help & Support',
      desc: 'FAQs and contact us',
      onPress: handleHelpSupport,
    },
    {
      icon: 'sign-out-alt',
      ionicon: 'log-out-outline',
      title: 'Sign Out',
      desc: '',
      color: '#DF2E38',
      onPress: handleSignOut,
    },
  ];

  // Helper function to format timestamps
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) {
      const hours = date.getHours();
      const mins = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMins = mins.toString().padStart(2, '0');
      return `Today, ${formattedHours}:${formattedMins} ${ampm}`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.section}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color="#5D9C59" />
          </View>
          <Text style={styles.profileName}>Alex Gardner</Text>
          <Text style={styles.profileEmail}>alex.gardner@example.com</Text>
          <TouchableOpacity style={styles.editProfileButton}>
            <Ionicons name="pencil" size={14} color="#5D9C59" />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#5D9C59" />
          ) : (
            <>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.scans}</Text>
                <Text style={styles.statLabel}>Scans</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.soilTypes}</Text>
                <Text style={styles.statLabel}>Soil Types</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.locations}</Text>
                <Text style={styles.statLabel}>Locations</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
        </View>

        {recentScans.length === 0 ? (
          <View style={styles.emptyActivity}>
            <Ionicons name="scan-outline" size={40} color="#CCC" />
            <Text style={styles.emptyActivityText}>No scans yet</Text>
            <Text style={styles.emptyActivitySubtext}>
              Your soil scan history will appear here
            </Text>
          </View>
        ) : (
          recentScans.map((scan, index) => (
            <View key={scan.id || index} style={styles.activityItem}>
              <View style={[styles.activityIcon, { backgroundColor: `${scan.color}20` || '#E8F5E9' }]}>
                <Ionicons name="scan" size={18} color={scan.color || '#5D9C59'} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{scan.soilType} Soil Detected</Text>
                <Text style={styles.activityTime}>{formatTimestamp(scan.timestamp)}</Text>
              </View>
              <Text style={styles.activityConfidence}>
                {Math.round((scan.confidence || 0) * 100)}%
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Actions */}
      <View style={styles.section}>
        {actionItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.actionItem}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View style={[
              styles.actionIcon,
              item.color ? { backgroundColor: 'rgba(223,46,56,0.1)' } : null
            ]}>
              <Ionicons
                name={item.ionicon}
                size={22}
                color={item.color || '#5D9C59'}
              />
            </View>
            <View style={styles.actionText}>
              <Text style={[styles.actionTitle, item.color ? { color: item.color } : null]}>
                {item.title}
              </Text>
              {item.desc ? (
                <Text style={styles.actionDesc}>{item.desc}</Text>
              ) : null}
            </View>
            {item.desc ? (
              <Ionicons name="chevron-forward" size={18} color="#999" />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {/* Version Info */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>SoilScan v1.0.0</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#1A3C40',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A3C40',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#C7E8CA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A3C40',
    marginBottom: 4,
  },
  profileEmail: {
    color: '#6C757D',
    fontSize: 14,
    marginBottom: 12,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    gap: 6,
  },
  editProfileText: {
    color: '#5D9C59',
    fontSize: 14,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#5D9C59',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6C757D',
    fontWeight: '500',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A3C40',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  activityConfidence: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5D9C59',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(93,156,89,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 13,
    color: '#6C757D',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 13,
    color: '#999',
  },
  emptyActivity: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptyActivitySubtext: {
    fontSize: 13,
    color: '#BBB',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default ProfileScreen;
