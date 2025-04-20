import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const ProfileScreen = () => {
  const actionItems = [
    { icon: 'cog', title: 'Settings', desc: 'App preferences and notifications' },
    { icon: 'bookmark', title: 'Saved Guides', desc: 'Your bookmarked articles' },
    { icon: 'share-alt', title: 'Share App', desc: 'Invite friends to SoilScan' },
    { icon: 'question-circle', title: 'Help & Support', desc: 'FAQs and contact us' },
    { icon: 'sign-out-alt', title: 'Sign Out', desc: '', color: '#DF2E38' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.section}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Icon name="user" size={40} color="#5D9C59" />
          </View>
          <Text style={styles.profileName}>Alex Gardner</Text>
          <Text style={styles.profileEmail}>alex.gardner@example.com</Text>
        </View>
        
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>24</Text>
            <Text style={styles.statLabel}>Scans</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>5</Text>
            <Text style={styles.statLabel}>Soil Types</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>12</Text>
            <Text style={styles.statLabel}>Locations</Text>
          </View>
        </View>
      </View>
      
      {/* Actions */}
      <View style={styles.section}>
        {actionItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.actionItem}>
            <View style={[styles.actionIcon, item.color ? { backgroundColor: 'rgba(223,46,56,0.1)' } : null]}>
              <Icon 
                name={item.icon} 
                size={20} 
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
              <Icon name="chevron-right" size={16} color="#666" />
            ) : null}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    fontSize: 20,
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 4,
  },
  profileEmail: {
    color: '#666',
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#5D9C59',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(93,156,89,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontWeight: '600',
    color: '#1A3C40',
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 12,
    color: '#666',
  },
});

export default ProfileScreen;