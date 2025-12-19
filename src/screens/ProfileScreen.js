import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMutation, useQuery } from '@apollo/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';

import { useAuth } from '../context/AuthContext';
import { jwtDecode } from 'jwt-decode';
import { DELETE_USER, GET_ME } from '../graphql/mutations'; // Imported GET_ME
import { client } from '../apollo/client';
import Navbar from '../components/Navbar';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { logout } = useAuth();
  const [deleteUser] = useMutation(DELETE_USER);
  const [userProfile, setUserProfile] = useState({ name: 'User', email: 'Loading...' });

  // Fetch user details: Try GET_ME first, fallback to Token Decode
  const { data: userData, loading, error, refetch } = useQuery(GET_ME, {
    fetchPolicy: 'network-only',
    onCompleted: async (data) => {
      console.log('👤 GET_ME Query Response:', JSON.stringify(data, null, 2));
      if (data?.me) {
        console.log('👤 User Profile Data:', data.me);
        console.log('👤 Linked Accounts:', data.me.linked_accounts);
        
        // Get payment info from token (GET_ME doesn't return payment info)
        let paymentInfo = {};
        try {
          const token = await AsyncStorage.getItem('accessToken');
          if (token) {
            const decoded = jwtDecode(token);
            paymentInfo = {
              paymentPlan: decoded.paymentPlan,
              paymentDate: decoded.paymentDate,
              paymentExpiryDate: decoded.paymentExpiryDate,
            };
            console.log('👤 Payment info from token:', paymentInfo);
          }
        } catch (e) {
          console.warn('Failed to get payment info from token:', e);
        }
        
        // Merge GET_ME data with payment info from token
        setUserProfile(prev => ({
          ...data.me,
          ...paymentInfo,
        }));
      }
    },
    onError: async (err) => {
      console.log('GET_ME failed, trying token decode', err);
      // Fallback: Decode token
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          const decoded = jwtDecode(token);
          console.log('Decoded Token:', decoded);
          setUserProfile({
            name: decoded.name || decoded.unique_name || decoded.given_name || 'User',
            email: decoded.email || decoded.upn || 'No Email',
            id: decoded.id || decoded.sub,
            linked_accounts: decoded.linked_accounts,
            paymentPlan: decoded.paymentPlan,
            paymentDate: decoded.paymentDate,
            paymentExpiryDate: decoded.paymentExpiryDate,
          });
        }
      } catch (e) {
        console.error('Token decode failed', e);
      }
    }
  });

  // Refetch data when screen comes into focus (e.g. returning from linking)
  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Also try decode on mount just in case GET_ME is slow or fails silently
  useEffect(() => {
    const loadFromToken = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          const decoded = jwtDecode(token);
          console.log('👤 Decoded JWT token:', decoded);
          // Only update if we don't have data yet or if GET_ME failed
          setUserProfile(prev => ({
            ...prev,
            name: decoded.name || decoded.unique_name || decoded.given_name || prev.name,
            email: decoded.email || decoded.upn || prev.email,
            id: decoded.id || decoded.sub || prev.id,
            linked_accounts: decoded.linked_accounts || prev.linked_accounts,
            // Payment/Subscription info from token
            paymentPlan: decoded.paymentPlan || prev.paymentPlan,
            paymentDate: decoded.paymentDate || prev.paymentDate,
            paymentExpiryDate: decoded.paymentExpiryDate || prev.paymentExpiryDate,
          }));
        }
      } catch (e) {
        console.error('Initial token decode failed', e);
      }
    };
    loadFromToken();
  }, []);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Do you really want to delete the account? If you delete then your data will be lost. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('accessToken');
              const userId = userProfile?.id;

              if (!userId || !token) {
                Toast.show({
                  type: 'error',
                  text1: 'Error',
                  text2: 'Unable to verify identity. Please login again.',
                });
                return;
              }

              await deleteUser({
                variables: { id: userId },
                context: { headers: { authorization: `Bearer ${token}` } }
              });

              // Clear all local data
              await AsyncStorage.multiRemove([
                'accessToken',
                'refreshToken',
                'apiKey',
                'currentUserId',
                'mfaToken',
              ]);

              Toast.show({
                type: 'success',
                text1: 'Account Deleted',
                text2: 'Your account has been permanently deleted.',
              });

              // Logout and navigate to auth
              logout();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              });
            } catch (error) {
              console.error('Delete account error:', error);
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error?.message || 'Failed to delete account.',
              });
            }
          },
        },
      ],
    );
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://safetycamai.com/privacy/');
  };

  return (
    <>
      <Navbar />
      <LinearGradient colors={['#007bff', '#67b0fa']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#007bff" />
        <ScrollView contentContainerStyle={styles.scrollContent}>

          {/* Profile Card */}
          <View style={styles.card}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Icon name="user" size={40} color="#fff" />
              </View>
              {loading ? (
                <ActivityIndicator size="small" color="#007bff" />
              ) : (
                <>
                  <Text style={styles.userName}>{userProfile?.name || 'User'}</Text>
                  <Text style={styles.userEmail}>{userProfile?.email || 'Loading email...'}</Text>
                </>
              )}
            </View>

            <View style={styles.badgeContainer}>
              <View style={styles.badge}>
                <Icon name="check-circle" size={16} color="#155724" style={{ marginRight: 6 }} />
                <Text style={styles.badgeText}>Account Verified</Text>
              </View>
            </View>
          </View>

          {/* Account Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Information</Text>
            <View style={styles.infoRow}>
              <View>
                <Text style={styles.label}>Email Address</Text>
                <Text style={styles.value}>{userProfile?.email || '...'}</Text>
              </View>
            </View>
          </View>

          {/* Subscription Status */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Subscription Status</Text>
            
            {/* Debug info - remove in production */}
            {__DEV__ && (
              <Text style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>
                Debug: paymentPlan = {userProfile?.paymentPlan || 'null'}
              </Text>
            )}
            
            {userProfile?.paymentPlan ? (
              // User has a subscription (Premium)
              <>
                <View style={styles.proBadgeContainer}>
                  <View style={styles.proBadge}>
                    <Icon name="star" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.proBadgeText}>Premium</Text>
                  </View>
                </View>
                
                <View style={styles.subscriptionDetails}>
                  <View style={styles.subscriptionRow}>
                    <Text style={styles.subscriptionLabel}>Plan</Text>
                    <Text style={styles.subscriptionValue}>
                      {userProfile.paymentPlan.includes('Monthly') ? 'Monthly' : 'Premium'}
                    </Text>
                  </View>
                  {userProfile.paymentExpiryDate && (
                    <View style={[styles.subscriptionRow, { borderBottomWidth: 0 }]}>
                      <Text style={styles.subscriptionLabel}>Expires</Text>
                      <Text style={styles.subscriptionValue}>
                        {(() => {
                          try {
                            // Handle date format: "12/19/2025 5:50:04 AM +00:00"
                            const dateStr = userProfile.paymentExpiryDate;
                            const date = new Date(dateStr);
                            if (isNaN(date.getTime())) {
                              // Fallback: extract just the date part
                              const parts = dateStr.split(' ');
                              return parts[0] || dateStr;
                            }
                            return date.toLocaleDateString();
                          } catch (e) {
                            return userProfile.paymentExpiryDate;
                          }
                        })()}
                      </Text>
                    </View>
                  )}
                </View>
              </>
            ) : (
              // User is on Free plan
              <>
                <View style={styles.freeBadgeContainer}>
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeBadgeText}>Free Plan</Text>
                  </View>
                </View>
                
                <Text style={styles.freeDescription}>
                  Upgrade to Premium for unlimited searches and advanced features.
                </Text>

                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => navigation.navigate('Subscription')}
                >
                  <Icon name="rocket" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Linked Accounts */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Linked Accounts</Text>
            <Text style={styles.cardSubtitle}>Manage your linked social accounts</Text>

            {['google', 'apple'].map((provider) => {
              // Parse linked_accounts if it's a string (from JWT)
              let linkedAccountsArray = [];
              try {
                if (typeof userProfile?.linked_accounts === 'string') {
                  linkedAccountsArray = JSON.parse(userProfile.linked_accounts);
                } else if (Array.isArray(userProfile?.linked_accounts)) {
                  linkedAccountsArray = userProfile.linked_accounts;
                }
              } catch (e) {
                console.error('Failed to parse linked_accounts:', e);
              }

              // Check if linked: compare uppercase provider names
              const isLinked = Array.isArray(linkedAccountsArray) &&
                linkedAccountsArray.some(acc =>
                  (typeof acc === 'string' && acc.toLowerCase() === provider) ||
                  (acc?.Provider?.toLowerCase() === provider) ||
                  (acc?.provider?.toLowerCase() === provider)
                );

              console.log(`👤 Checking ${provider} - linked_accounts:`, userProfile?.linked_accounts);
              console.log(`👤 Parsed array:`, linkedAccountsArray);
              console.log(`👤 ${provider} isLinked:`, isLinked);

              return (
                <View key={provider} style={styles.accountRow}>
                  <View style={styles.accountInfo}>
                    <Icon
                      name={provider === 'google' ? 'google' : 'apple'}
                      size={20}
                      color={provider === 'google' ? '#DB4437' : '#000'}
                    />
                    <Text style={styles.accountName}>
                      {provider.charAt(0).toUpperCase() + provider.slice(1)}
                    </Text>
                  </View>

                  {isLinked ? (
                    <View style={styles.linkedBadge}>
                      <Icon name="check" size={12} color="#155724" />
                      <Text style={styles.linkedText}>Linked</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.linkButtonSmall}
                      onPress={() => {
                        const baseUrl = 'https://api.safetycamai.com'; // Or use API_BASE_URL from config
                        // Using client=mobile to ensure it redirects back to app if configured
                        // Added redirect_uri to ensure it comes back to Profile
                        const redirectUri = 'safetycamai://profile';
                        const url = `${baseUrl}/auth/${provider}?client=mobile&purpose=link&userId=${userProfile.id}&redirect_uri=${encodeURIComponent(redirectUri)}`;
                        Linking.openURL(url);
                      }}
                    >
                      <Text style={styles.linkButtonSmallText}>Link</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          {/* Privacy & Data */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Privacy & Data</Text>
            <TouchableOpacity style={styles.linkButton} onPress={openPrivacyPolicy}>
              <Text style={styles.linkButtonText}>Privacy Policy & Face Data Usage</Text>
            </TouchableOpacity>
            <Text style={styles.privacyNote}>
              We use facial recognition to analyze photos and match them against our criminal database.
              Face data is processed securely on our servers and is not permanently stored on your device.
            </Text>
          </View>

          {/* Danger Zone - Professional Look */}
          <View style={styles.dangerZoneCard}>
            <View style={styles.dangerHeader}>
              <Icon name="exclamation-triangle" size={20} color="#dc3545" />
              <Text style={styles.dangerTitle}>Danger Zone</Text>
            </View>

            <Text style={styles.dangerDesc}>
              Deleting your account is irreversible. All your data will be permanently removed.
            </Text>

            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 24, marginTop: 10 },
  backButton: { marginBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#e0e0e0', marginTop: 4 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  profileHeader: { alignItems: 'center', marginBottom: 20 },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,123,255,0.1)', // Light blue bg
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#007bff',
  },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  userEmail: { fontSize: 14, color: '#666' },

  badgeContainer: { alignItems: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  badgeText: { color: '#155724', fontWeight: '600', fontSize: 13 },

  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },

  infoRow: { borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 12 },
  label: { fontSize: 13, color: '#666', marginBottom: 2 },
  value: { fontSize: 16, color: '#333', fontWeight: '500' },

  linkButton: { backgroundColor: '#007bff', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  linkButtonText: { color: '#fff', fontWeight: '600' },
  privacyNote: { fontSize: 12, color: '#666', lineHeight: 18 },

  // Danger Zone Professional Styles
  dangerZoneCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f5c6cb', // Light red border
    backgroundColor: '#fff5f5', // Very light red bg
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#dc3545',
    marginLeft: 10,
  },
  dangerDesc: {
    fontSize: 14,
    color: '#721c24',
    marginBottom: 16,
    lineHeight: 20,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButtonText: { color: '#fff', fontWeight: 'bold' },

  // Linked Accounts Styles
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 10,
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  linkedText: {
    color: '#155724',
    fontSize: 12,
    fontWeight: '600',
  },
  linkButtonSmall: {
    backgroundColor: '#007bff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  linkButtonSmallText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  // Subscription Status Styles
  proBadgeContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  proBadgeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  freeBadgeContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  freeBadge: {
    backgroundColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  freeBadgeText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  freeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  subscriptionDetails: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  subscriptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  subscriptionLabel: {
    fontSize: 14,
    color: '#666',
  },
  subscriptionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  upgradeButton: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  manageButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007bff',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageButtonText: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProfileScreen;
