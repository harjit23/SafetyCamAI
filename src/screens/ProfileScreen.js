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
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useMutation, useQuery, gql } from '@apollo/client';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';

import { useAuth } from '../context/AuthContext';
import { jwtDecode } from 'jwt-decode';
import { DELETE_USER, GET_ME, VERIFY_RECEIPT_MUTATION, REFRESH_TOKEN } from '../graphql/mutations'; // Imported GET_ME, VERIFY_RECEIPT_MUTATION, and REFRESH_TOKEN
import { client } from '../apollo/client';
import Navbar from '../components/Navbar';
import { Platform } from 'react-native';
import { ReportMisuseCard } from '../components/ReportMisuse';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, logout, refreshUser } = useAuth();
  const [deleteUser] = useMutation(DELETE_USER);
  const [verifyReceipt] = useMutation(VERIFY_RECEIPT_MUTATION);
  const [refreshTokenMutation] = useMutation(REFRESH_TOKEN);
  const itemSkus = ['com.safetycamai.monthly'];

  // Sync local state with Context User when it changes (e.g. after refreshUser)
  useEffect(() => {
    if (user) {
      console.log('👤 Syncing Profile with Context User:', user);
      setUserProfile(prev => ({
        ...prev,
        ...user,
        // FORCE overwrite payment info from context (token) as it's the source of truth for access
        paymentPlan: user.paymentPlan,
        paymentExpiryDate: user.paymentExpiryDate,
        // Only use pendingLookups if it exists in token, otherwise keep existing (or from GET_ME)
        pendingLookups: user.pendingLookups !== undefined ? user.pendingLookups : prev.pendingLookups
      }));
    }
  }, [user]);

  // Auth check
  // Auth check & Local Data Refresh
  useFocusEffect(
    React.useCallback(() => {
      const checkAuthAndRefresh = async () => {
        const token = await AsyncStorage.getItem('accessToken');
        if (!user || !token) {
          navigation.navigate('AuthLogin');
          return;
        }

        // Locally refresh user data from token to ensure immediate UI update after purchase
        try {
          const decoded = jwtDecode(token);
          console.log('👀 Profile focused, locally updating from token:', decoded.paymentPlan);
          setUserProfile(prev => ({
            ...prev,
            paymentPlan: decoded.paymentPlan,
            paymentExpiryDate: decoded.paymentExpiryDate,
            pendingLookups: decoded.pendingLookups !== undefined ? decoded.pendingLookups : prev.pendingLookups
          }));
        } catch (e) {
          console.log('Failed to locally refresh profile from token:', e);
        }
      };
      checkAuthAndRefresh();
    }, [user, navigation])
  );

  // Handle Return from Social Linking
  useEffect(() => {
    const { code, provider } = route.params || {};
    if (code && provider) {
      const exchangeLinkingCode = async () => {
        try {
          const { showLoader, hideLoader } = client.cache.readQuery({ query: gql`query { loader @client { show hide } }` }) || {};
          // Since we don't have easy access to loader context here without wrapping or passing, 
          // let's just use a simple toast for now or reliance on the fact that linking is a background-ish final step.

          Toast.show({ type: 'info', text1: 'Linking Account...', text2: `Completing ${provider} link` });

          const response = await axios.post(
            `${API_BASE_URL}/auth/${provider}/exchange`,
            JSON.stringify(code),
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          );

          console.log('[ProfileScreen] Linking exchange response:', response.data);

          if (response.data?.token) {
            Toast.show({ type: 'success', text1: 'Success', text2: 'Account linked successfully!' });
            // Refresh user data to show the new link
            await refreshUser();
            // Refetch data to update the Linked Accounts list
            await refetch();
          } else if (response.data?.error) {
            Toast.show({ type: 'error', text1: 'Linking Failed', text2: response.data.error });
          } else {
            Toast.show({ type: 'error', text1: 'Linking Failed', text2: 'Invalid response from server' });
          }
        } catch (error) {
          console.error('[ProfileScreen] Social linking exchange error:', error);
          const msg = error.response?.data?.error || error.message || 'Failed to complete linking';
          Toast.show({ type: 'error', text1: 'Linking Failed', text2: msg });
        } finally {
          // Clear params so it doesn't re-run
          navigation.setParams({ code: undefined, provider: undefined });
        }
      };

      exchangeLinkingCode();
    }
  }, [route.params, navigation, refreshUser]);



  // Handle Restore Purchase
  const handleRestorePurchase = async () => {
    try {
      Toast.show({ type: 'info', text1: 'Restoring...', text2: 'Checking for previous purchases' });
      const RNIap = require('react-native-iap');
      await RNIap.initConnection();

      const availablePurchases = await RNIap.getAvailablePurchases();
      console.log('📦 Available purchases for restore:', availablePurchases?.length || 0);

      if (!availablePurchases || availablePurchases.length === 0) {
        Toast.show({
          type: 'info',
          text1: 'No Purchases Found',
          text2: 'We couldn\'t find any active subscriptions to restore.',
        });
        await RNIap.endConnection();
        return;
      }

      // Find the most recent valid purchase for our SKU
      const validPurchase = availablePurchases
        .filter(p => itemSkus.includes(p.productId))
        .sort((a, b) => b.transactionDate - a.transactionDate)[0];

      if (!validPurchase) {
        Toast.show({
          type: 'info',
          text1: 'No Valid Subscription',
          text2: 'No active SafetyCam AI subscription found.',
        });
        await RNIap.endConnection();
        return;
      }

      console.log('🧾 Found valid purchase to restore:', validPurchase.transactionId);

      let receipt = validPurchase.transactionReceipt;
      if (Platform.OS === 'ios' && !receipt) {
        try {
          receipt = await RNIap.getReceiptIOS();
        } catch (err) {
          console.warn('Failed to get receipt from iOS during restore:', err);
        }
      }

      if (!receipt) {
        throw new Error('Could not retrieve purchase receipt');
      }

      console.log('📤 Sending restored receipt to backend...');
      const { data } = await verifyReceipt({
        variables: { receipt },
      });

      if (data?.verifyApplePayment === true) {
        console.log('✅ Restore successful!');

        // Refresh token to get updated claims
        try {
          const token = await AsyncStorage.getItem('accessToken');
          const refreshToken = await AsyncStorage.getItem('refreshToken');
          if (token && refreshToken) {
            console.log('🔄 Refreshing token after restore...');
            const { data: refreshData } = await refreshTokenMutation({ variables: { token, refreshToken } });
            if (refreshData?.refreshToken) {
              await AsyncStorage.setItem('accessToken', refreshData.refreshToken.token);
              await AsyncStorage.setItem('refreshToken', refreshData.refreshToken.refreshToken);
              console.log('✅ Token refreshed after restore');
            }
          }
        } catch (refreshErr) {
          console.warn('Failed to refresh token after restore:', refreshErr);
        }

        // Update global user state
        await refreshUser();

        Toast.show({
          type: 'success',
          text1: 'Restore Successful',
          text2: 'Your premium access has been restored.',
        });
        // Refetch user data to update UI
        refetch();
      } else {
        console.warn('❌ Backend rejected the restored receipt');
        Toast.show({
          type: 'error',
          text1: 'Restore Failed',
          text2: 'We found a purchase, but verification failed.',
        });
      }
      await RNIap.endConnection();
    } catch (err) {
      console.warn('❌ Restore error:', err);
      Toast.show({
        type: 'error',
        text1: 'Restore Error',
        text2: err.message || 'An error occurred while restoring.',
      });
    }
  };

  // Initialize with empty state, but we'll fill it from token immediately
  const [userProfile, setUserProfile] = useState({
    name: 'User',
    email: 'Loading...',
    id: null,
    linked_accounts: [],
    paymentPlan: null
  });

  const [refreshing, setRefreshing] = useState(false);

  // Robust date parsing helper
  const parseDate = (dateStr) => {
    if (!dateStr) return new Date(NaN);

    // Try standard parsing first
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;

    try {
      // Handle "MM/DD/YYYY HH:MM:SS AM/PM [Offset]"
      // Example: "12/27/2025 5:50:04 AM +00:00"
      const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})\s+(AM|PM)\s+([+-]\d{2}:\d{2}|Z)?/i);

      if (match) {
        let [_, m, d, y, h, min, s, ampm, offset] = match;
        m = parseInt(m, 10);
        d = parseInt(d, 10);
        y = parseInt(y, 10);
        h = parseInt(h, 10);
        min = parseInt(min, 10);
        s = parseInt(s, 10);

        if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
        if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;

        // Construct ISO string: YYYY-MM-DDTHH:MM:SS
        const isoBase = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

        if (offset) {
          if (offset.toUpperCase() === 'Z') offset = '+00:00';
          date = new Date(isoBase + offset);
        } else {
          // Fallback to local time
          date = new Date(y, m - 1, d, h, min, s);
        }
        return date;
      }
    } catch (e) {
      console.warn('parseDate regex failed:', e);
    }
    return new Date(NaN);
  };

  // Load from token on mount to avoid waiting for GET_ME
  useEffect(() => {
    const loadFromToken = async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          const decoded = jwtDecode(token);
          console.log('🎫 RAW ACCESS TOKEN:', token);
          console.log('🔑 FULL DECODED TOKEN (Initial Load):', JSON.stringify(decoded, null, 2));

          if (decoded.linked_accounts) {
            try {
              const parsed = typeof decoded.linked_accounts === 'string' ? JSON.parse(decoded.linked_accounts) : decoded.linked_accounts;
              console.log('🔗 DECODED LINKED ACCOUNTS:', JSON.stringify(parsed, null, 2));
            } catch (e) {
              console.log('🔗 LINKED ACCOUNTS (Raw):', decoded.linked_accounts);
            }
          }

          const refreshToken = await AsyncStorage.getItem('refreshToken');
          if (refreshToken) {
            console.log('🎫 RAW REFRESH TOKEN:', refreshToken);
            try {
              const decodedRefresh = jwtDecode(refreshToken);
              console.log('🔑 DECODED REFRESH TOKEN:', JSON.stringify(decodedRefresh, null, 2));
            } catch (e) {
              console.log('❌ Failed to decode refresh token');
            }
          }

          console.log('👤 Initial load from token:', decoded);
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
        console.error('Initial token decode failed', e);
      }
    };
    loadFromToken();
  }, []);

  // Fetch user details: Try GET_ME first, fallback to Token Decode
  const { data: userData, loading, error, refetch } = useQuery(GET_ME, {
    fetchPolicy: 'network-only',
    onCompleted: async (data) => {
      console.log('👤 GET_ME Query Response:', JSON.stringify(data, null, 2));
      if (data?.me) {
        console.log('👤 User Profile Data:', data.me);
        console.log('👤 Linked Accounts:', data.me.linked_accounts);

        // 🔍 Log remaining attempts and plan type (Safe logging)
        try {
          const token = await AsyncStorage.getItem('accessToken');
          if (token) {
            const decoded = jwtDecode(token);
            const expiry = parseDate(decoded.paymentExpiryDate);
            const now = new Date();
            const isExpired = isNaN(expiry.getTime()) || now > expiry;

            console.log('--- 📊 Plan Status Calculation [ProfileScreen] ---');
            console.log('Plan:', decoded.paymentPlan);
            console.log('Raw Expiry Date:', decoded.paymentExpiryDate);
            console.log('Parsed Expiry Date:', isNaN(expiry.getTime()) ? 'Invalid Date' : expiry.toLocaleString());
            console.log('Current Date:', now.toLocaleString());
            console.log('Is Expired:', isExpired);
            console.log('Remaining Attempts (from backend):', data.me.pendingLookups);
            console.log('-----------------------------------------------');
          } else {
            console.log(`📊 [ProfileScreen] Plan: Guest | Remaining Attempts: ${data.me.pendingLookups}`);
          }
        } catch (logError) {
          console.warn('Failed to log payment status from token:', logError);
        }

        // Get payment info from token (GET_ME doesn't return payment info)
        let paymentInfo = {};
        try {
          const token = await AsyncStorage.getItem('accessToken');
          if (token) {
            const decoded = jwtDecode(token);
            console.log('🔑 FULL DECODED TOKEN (Payment Info):', JSON.stringify(decoded, null, 2));
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
        // Priority: paymentInfo (from token) > data.me (from DB) for payment fields
        // We trust the token more for immediate access rights
        setUserProfile(prev => {
          const updated = {
            ...prev,
            ...data.me, // Base data from DB
            ...paymentInfo, // Overwrite with token payment info (if valid)
          };
          // 🔍 Log remaining attempts and plan type
          console.log(`📊 [ProfileScreen] Plan: ${updated.paymentPlan || 'Free'} | Remaining Attempts: ${updated.pendingLookups ?? 'N/A'}`);
          return updated;
        });
      }
    },
    onError: async (err) => {
      console.log('GET_ME failed, trying token decode', err);
      // Fallback: Decode token
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          const decoded = jwtDecode(token);
          console.log('🔑 FULL DECODED TOKEN (Fallback):', JSON.stringify(decoded, null, 2));
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


  // Refetch data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const refreshProfile = async () => {
        // 1. Refresh from local token/storage (fast)
        await refreshUser();
        // 2. Refresh from network (slower, might fail)
        try {
          await refetch();
        } catch (e) {
          console.log('Profile focus refetch failed (non-fatal):', e);
        }
      };
      refreshProfile();
    }, [refetch, refreshUser])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // 1. Refresh from local token first
      await refreshUser();

      // 2. Refresh from network
      await refetch();

      Toast.show({ type: 'success', text1: 'Refreshed', text2: 'Profile updated successfully' });
    } catch (e) {
      console.error('Refresh failed:', e);
      // If network failed but we have user data, show a warning instead of error
      if (user) {
        Toast.show({ type: 'info', text1: 'Network Issue', text2: 'Showing cached profile data' });
      } else {
        Toast.show({ type: 'error', text1: 'Refresh Failed', text2: 'Could not update profile' });
      }
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refreshUser, user]);

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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >

          {/* Profile Card */}
          <View style={styles.card}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Icon name="user" size={40} color="#fff" />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.userName}>{userProfile?.name || 'User'}</Text>
                <Text style={styles.userEmail}>{userProfile?.email || 'Loading email...'}</Text>
                {loading && !userProfile.id && (
                  <ActivityIndicator size="small" color="#007bff" style={{ marginTop: 8 }} />
                )}
              </View>
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
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Email Address</Text>
                <Text style={styles.value}>{userProfile?.email || '...'}</Text>
              </View>
              {userProfile?.pendingLookups !== undefined && (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.label}>Remaining Tasks</Text>
                  <Text style={[styles.value, { color: '#007bff', fontWeight: 'bold' }]}>
                    {userProfile.pendingLookups}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Plan & Subscription */}
          <View style={styles.card}>
            <View style={styles.subscriptionHeader}>
              <View>
                <Text style={styles.planTitle}>Plan & Subscription</Text>
                <Text style={styles.planSubtitle}>Manage your subscription and billing</Text>
              </View>
            </View>

            {/* Debug info - remove in production */}
            {/* {__DEV__ && (
              <Text style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>
                Debug: paymentPlan = {userProfile?.paymentPlan || 'null'}
              </Text>
            )} */}

            {userProfile?.paymentPlan && !userProfile.paymentPlan.toLowerCase().includes('free') ? (
              // User has a subscription
              <>
                {(() => {
                  try {
                    const dateStr = userProfile.paymentExpiryDate;
                    const expiryDate = parseDate(dateStr);
                    const today = new Date();
                    const diffTime = expiryDate.getTime() - today.getTime();
                    const diffDays = isNaN(diffTime) ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isActive = !isNaN(diffTime) && diffTime > 0;

                    console.log('--- 📊 Plan Status Rendering [ProfileScreen] ---');
                    console.log('Plan:', userProfile.paymentPlan);
                    console.log('Raw Expiry Date:', dateStr);
                    console.log('Parsed Expiry Date:', isNaN(expiryDate.getTime()) ? 'Invalid Date' : expiryDate.toLocaleString());
                    console.log('Current Date:', today.toLocaleString());
                    console.log('Is Active:', isActive);
                    console.log('Remaining Tasks (from backend):', userProfile.pendingLookups);
                    console.log('--------------------------------------------------');

                    return (
                      <>
                        <View style={styles.planNameRow}>
                          <View>
                            <Text style={styles.currentPlanLabel}>Current Plan</Text>
                            <Text style={styles.planNameValue}>
                              {userProfile.paymentPlan.toLowerCase().includes('enterprise') ? 'Enterprise' :
                                userProfile.paymentPlan.toLowerCase().includes('monthly') ? 'Monthly' :
                                  userProfile.paymentPlan.toLowerCase().includes('premium') ? 'Premium' : 'Active Plan'}
                            </Text>
                          </View>
                          {!isActive && (
                            <View style={styles.inactiveBadge}>
                              <Text style={styles.inactiveBadgeText}>Inactive</Text>
                            </View>
                          )}
                          {isActive && (
                            <View style={styles.activeBadge}>
                              <Text style={styles.activeBadgeText}>Active</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.expiryInfoContainer}>
                          <Text style={[styles.remainingDaysText, !isActive && { color: '#dc3545' }]}>
                            {isActive ? `${diffDays} days Remaining` : 'Inactive'}
                          </Text>
                          <Text style={styles.expiryDateText}>
                            Plan {isActive ? 'expires' : 'expired'} on {(() => {
                              try {
                                const date = parseDate(userProfile.paymentExpiryDate);
                                if (isNaN(date.getTime())) return userProfile.paymentExpiryDate || 'N/A';

                                const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                const month = monthNames[date.getMonth()];
                                const day = date.getDate();
                                const year = date.getFullYear();
                                let hours = date.getHours();
                                const minutes = date.getMinutes().toString().padStart(2, '0');
                                const ampm = hours >= 12 ? 'PM' : 'AM';
                                hours = hours % 12;
                                hours = hours ? hours : 12;
                                const strTime = hours.toString().padStart(2, '0') + ':' + minutes + ' ' + ampm;

                                return `${month} ${day}, ${year}, ${strTime}`;
                              } catch (e) {
                                console.error('Date formatting error:', e);
                                return userProfile.paymentExpiryDate;
                              }
                            })()}
                          </Text>
                        </View>

                        <View style={styles.buttonRow}>
                          {!isActive && (
                            <TouchableOpacity
                              style={[styles.reactivateButton, { flex: 1, marginRight: 8 }]}
                              onPress={() => navigation.navigate('Subscription')}
                            >
                              <Icon name="refresh" size={16} color="#fff" style={{ marginRight: 8 }} />
                              <Text style={styles.upgradeButtonText}>Reactivate Plan</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.upgradeButton, { flex: 1 }]}
                            onPress={() => navigation.navigate('Subscription')}
                          >
                            <Icon name="rocket" size={16} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.upgradeButtonText}>Upgrade Plan</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    );
                  } catch (e) {
                    return <Text>Error loading subscription info</Text>;
                  }
                })()}
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

                <TouchableOpacity
                  style={styles.restoreButtonSmall}
                  onPress={handleRestorePurchase}
                >
                  <Text style={styles.restoreButtonSmallText}>Restore Purchase</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Linked Accounts */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Linked Accounts</Text>
            {/* <Text style={styles.cardSubtitle}>Manage your linked social accounts</Text> */}

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
              console.log(`👤 Full userProfile state:`, JSON.stringify(userProfile, null, 2));

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
              <Text style={styles.linkButtonText}>Privacy Policy & Image Data Usage</Text>
            </TouchableOpacity>
            <Text style={styles.privacyNote}>
              We use image analysis to find visually similar images from publicly accessible websites.
              Image data is processed securely on our servers and is not permanently stored on your device.
            </Text>
          </View>

          {/* Report Misuse */}
          <ReportMisuseCard />

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
  restoreButtonSmall: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  restoreButtonSmallText: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  // New Subscription Styles
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  planSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  planNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentPlanLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  planNameValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
  },
  activeBadge: {
    backgroundColor: '#e6f7ed',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  activeBadgeText: {
    color: '#28a745',
    fontSize: 13,
    fontWeight: '700',
  },
  expiryInfoContainer: {
    backgroundColor: '#f0fff4',
    borderWidth: 1,
    borderColor: '#b7eb8f',
    borderRadius: 10,
    padding: 16,
  },
  remainingDaysText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#28a745',
    marginBottom: 8,
  },
  expiryDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  inactiveBadge: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  inactiveBadgeText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  reactivateButton: {
    flexDirection: 'row',
    backgroundColor: '#007bff',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ProfileScreen;
