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
  Image,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import {
  getScanStats,
  getUserProfile,
  saveUserProfile,
  saveUserAvatar,
  getSavedGuides,
  removeGuide,
} from '../utils/storage';

const ProfileScreen = ({ navigation }) => {
  const [stats, setStats] = useState({
    scans: 0,
    soilTypes: 0,
    locations: 0,
  });
  const [recentScans, setRecentScans] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: 'SoilScan User',
    email: '',
    avatarUri: null,
  });
  const [savedGuides, setSavedGuides] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGuidesModal, setShowGuidesModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Load stats and profile when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [scanStats, userProfile, guides] = await Promise.all([
        getScanStats(),
        getUserProfile(),
        getSavedGuides(),
      ]);

      setStats({
        scans: scanStats.totalScans,
        soilTypes: scanStats.uniqueSoilTypes,
        locations: scanStats.uniqueLocations,
      });
      setRecentScans(scanStats.recentScans || []);
      setProfile(userProfile);
      setSavedGuides(guides);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to set an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const savedUri = await saveUserAvatar(result.assets[0].uri);
      if (savedUri) {
        setProfile(prev => ({ ...prev, avatarUri: savedUri }));
        Alert.alert('Success', 'Avatar updated successfully!');
      }
    }
  };

  const handleEditProfile = () => {
    setEditName(profile.name);
    setEditEmail(profile.email);
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    await saveUserProfile({
      name: editName.trim() || 'SoilScan User',
      email: editEmail.trim(),
    });
    setProfile(prev => ({
      ...prev,
      name: editName.trim() || 'SoilScan User',
      email: editEmail.trim(),
    }));
    setShowEditModal(false);
    Alert.alert('Success', 'Profile updated successfully!');
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  const handleSavedGuides = () => {
    if (savedGuides.length === 0) {
      Alert.alert(
        'Saved Guides',
        'You have no saved guides yet. Bookmark helpful articles from the Guide screen to see them here.',
        [{ text: 'OK' }]
      );
    } else {
      setShowGuidesModal(true);
    }
  };

  const handleRemoveGuide = async (guideId) => {
    const updated = await removeGuide(guideId);
    setSavedGuides(updated);
    if (updated.length === 0) {
      setShowGuidesModal(false);
    }
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
      ionicon: 'settings-outline',
      title: 'Settings',
      desc: 'App preferences and notifications',
      onPress: handleSettings,
    },
    {
      ionicon: 'bookmark-outline',
      title: 'Saved Guides',
      desc: savedGuides.length > 0 ? `${savedGuides.length} saved` : 'Your bookmarked articles',
      onPress: handleSavedGuides,
      badge: savedGuides.length > 0 ? savedGuides.length : null,
    },
    {
      ionicon: 'share-social-outline',
      title: 'Share App',
      desc: 'Invite friends to SoilScan',
      onPress: handleShareApp,
    },
    {
      ionicon: 'help-circle-outline',
      title: 'Help & Support',
      desc: 'FAQs and contact us',
      onPress: handleHelpSupport,
    },
    {
      ionicon: 'log-out-outline',
      title: 'Sign Out',
      desc: '',
      color: '#DF2E38',
      onPress: handleSignOut,
    },
  ];

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
          <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarContainer}>
            {profile.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="person" size={40} color="#5D9C59" />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{profile.name}</Text>
          {profile.email ? (
            <Text style={styles.profileEmail}>{profile.email}</Text>
          ) : null}
          <TouchableOpacity style={styles.editProfileButton} onPress={handleEditProfile}>
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
            {item.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            ) : null}
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

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color="#1A3C40" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your name"
                placeholderTextColor="#999"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Saved Guides Modal */}
      <Modal
        visible={showGuidesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGuidesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Saved Guides</Text>
              <TouchableOpacity onPress={() => setShowGuidesModal(false)}>
                <Ionicons name="close" size={24} color="#1A3C40" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.guidesList}>
              {savedGuides.map((guide) => (
                <View key={guide.id} style={styles.guideItem}>
                  <View style={styles.guideIcon}>
                    <Ionicons name="document-text" size={20} color="#5D9C59" />
                  </View>
                  <View style={styles.guideContent}>
                    <Text style={styles.guideTitle}>{guide.title}</Text>
                    <Text style={styles.guideDate}>
                      Saved {formatTimestamp(guide.savedAt)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveGuide(guide.id)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#DF2E38" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#C7E8CA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#5D9C59',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
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
  badge: {
    backgroundColor: '#5D9C59',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A3C40',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A3C40',
  },
  saveButton: {
    backgroundColor: '#5D9C59',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  guidesList: {
    maxHeight: 400,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  guideIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(93,156,89,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  guideContent: {
    flex: 1,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 2,
  },
  guideDate: {
    fontSize: 12,
    color: '#999',
  },
  removeButton: {
    padding: 8,
  },
});

export default ProfileScreen;
