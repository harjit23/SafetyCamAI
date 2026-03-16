// HomeScreen.js
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  BackHandler,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { jwtDecode } from 'jwt-decode';
import { gql, useMutation } from '@apollo/client';
import { client } from '../apollo/client';

import * as RNIap from 'react-native-iap';
import { GET_PENDING_LOOKUPS, GET_USER_API_KEY, VERIFY_RECEIPT_MUTATION } from '../graphql/mutations';
import { API_BASE_URL } from '../config';

import Navbar from '../components/Navbar';
import UploadBox from '../components/UploadBox';
import DetectionSteps from '../components/DetectionSteps';
import MatchList from '../components/MatchList';
import AlertDialog from '../components/AlertDialog';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';

// ------------------ GQL ------------------
const STATUS_SUBSCRIPTION = gql`
  subscription onMessage($id: String!) {
    onMessage(id: $id) {
      body
    }
  }
`;

// ------------------ Helpers ------------------
const normalizeFsPath = (uri) => uri || uri; // keep as-is for RN fetch FormData

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

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { showAlert } = useAlert();

  // 'upload' | 'verifying' | 'results'
  const [state, setState] = useState('upload');
  const [trackingMessage, setTrackingMessage] = useState('');
  const [results, setResults] = useState([]);
  const [image, setImage] = useState(null);

  // attempts UI state
  const [remainingAttempts, setRemainingAttempts] = useState(null);
  const [attemptsResetAt, setAttemptsResetAt] = useState(null);
  const [paymentPlan, setPaymentPlan] = useState(null);

  const subObserverRef = useRef(null);
  const subIdRef = useRef(null);
  const flagsRef = useRef({ subDone: false, haveResults: false });

  const generateSubscriptionId = () => `${Date.now()}`;
  const resetFlags = () => {
    flagsRef.current = { subDone: false, haveResults: false };
  };

  const unsubscribeStatus = useCallback(() => {
    try {
      subObserverRef.current?.unsubscribe?.();
    } catch {}
    subObserverRef.current = null;
    subIdRef.current = null;
  }, []);

  const resetToUpload = useCallback(() => {
    setState('upload');
    setImage(null);
    setResults([]);
    setTrackingMessage('');
    resetFlags();
  }, []);

  // Auto-correct screen if no image
  useEffect(() => {
    if (!image && state !== 'upload') setState('upload');
  }, [image, state]);

  // Back: exit or reset flow
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (state !== 'upload') {
          unsubscribeStatus();
          resetToUpload();
          return true;
        }
        // If on Home screen (upload state), exit app instead of going back
        BackHandler.exitApp();
        return true;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [state, unsubscribeStatus, resetToUpload]),
  );

  // Logout reset
  useEffect(() => {
    if (!user) {
      unsubscribeStatus();
      resetToUpload();
    }
  }, [user, unsubscribeStatus, resetToUpload]);

  // --- STATUS SUBSCRIPTION ---
  const startStatusSubscription = useCallback(
    (subscriptionId) => {
      unsubscribeStatus();
      subIdRef.current = subscriptionId;

      const observable = client.subscribe({
        query: STATUS_SUBSCRIPTION,
        variables: { id: subscriptionId },
      });

      subObserverRef.current = observable.subscribe({
        next: ({ data }) => {
          const msg = data?.onMessage?.body;
          if (__DEV__) console.log('[SUB status]', msg);
          if (msg) setTrackingMessage(msg);

          if (msg === 'Detection Completed.') {
            flagsRef.current.subDone = true;
            if (flagsRef.current.haveResults) {
              setState('results');
              unsubscribeStatus();
            }
          }
        },
        error: (err) => {
          console.log('[subscription error]', err?.message || err);
        },
      });
    },
    [unsubscribeStatus],
  );

  // --- GraphQL error helper ---
  const handleGraphQLErrors = useCallback(
    (errorsArray) => {
      if (__DEV__) console.log('[GQL errors]', JSON.stringify(errorsArray, null, 2));
      const message = errorsArray?.[0]?.message || 'Upload failed';
      
      const isLimitError = 
        message.toLowerCase().includes('weekly free trial') ||
        message.toLowerCase().includes('weekly api hit limit exceeded') ||
        message.toLowerCase().includes('free trial limit exceeded') ||
        message.toLowerCase().includes('free trial expired') ||
        message.toLowerCase().includes('api key is expired');

      if (isLimitError) {
        const isGuest = !user;
        
        const isApiKeyExpired = message.toLowerCase().includes('api key is expired');

        Toast.show({
          type: 'error',
          text1: isApiKeyExpired ? 'Plan Expired' : 'Limit Reached',
          text2: isGuest ? 'Please log in to subscribe.' : 'Redirecting to plans...',
          visibilityTime: 3000,
        });
        
        // Redirect after a delay
        setTimeout(async () => {
          if (isGuest) {
            await AsyncStorage.setItem('redirectToSubscription', 'true');
            navigation.navigate('AuthLogin');
          } else {
            navigation.navigate('Subscription');
          }
        }, 2500);
      } else {
        Toast.show({ type: 'error', text1: 'Error', text2: message });
      }
      unsubscribeStatus();
      resetToUpload();
      fetchPending();
    },
    [resetToUpload, unsubscribeStatus, navigation, fetchPending, user],
  );

  const getUserId = useCallback(async () => {
    const saved = await AsyncStorage.getItem('currentUserId');
    if (saved) return saved;

    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return null;

    try {
      const decoded = jwtDecode(token);
      const uid = decoded?.id || decoded?.userId || decoded?.sub || null;
      if (uid) {
        await AsyncStorage.setItem('currentUserId', String(uid));
        return String(uid);
      }
    } catch (_) {}
    return null;
  }, []);

  // fetch remaining attempts
  const fetchPending = useCallback(async () => {
    let token = null;
    let userId = null;

    // Only fetch token/userId if user is actually logged in
    if (user) {
      token = await AsyncStorage.getItem('accessToken');
      userId = await getUserId();
    }
    
    // Always fetch from backend (Logged in: by userId, Guest: by IP)
    try {
      const { data } = await client.query({
        query: GET_PENDING_LOOKUPS,
        variables: { userId: userId || null },
        fetchPolicy: 'no-cache',
        context: { 
          headers: token ? { authorization: `Bearer ${token}` } : {},
          skipAuth: !user, // Skip auth if user is not logged in (Guest mode)
        },
      });

      if (__DEV__) {
        console.log('pendingLookups response:', JSON.stringify(data, null, 2));
      }

      const pending = data?.pendingLookups;
      const attempts = pending?.pendingLookups ?? null;
      console.log('✅ [HomeScreen] Fetched attempts:', attempts);
      setRemainingAttempts(attempts);
      setAttemptsResetAt(pending?.lastDate ?? null);

      // Extract plan from token if available
      if (token) {
        try {
          const decoded = jwtDecode(token);
          setPaymentPlan(decoded.paymentPlan || null);
        } catch (e) {
          console.warn('Failed to decode token for plan:', e);
        }
      } else {
        setPaymentPlan(null);
      }

      // 🔍 Log remaining attempts and plan type (Safe logging)
      try {
        const token = await AsyncStorage.getItem('accessToken');
        if (token) {
          const decoded = jwtDecode(token);
          const expiry = parseDate(decoded.paymentExpiryDate);
          const now = new Date();
          const isExpired = isNaN(expiry.getTime()) || now > expiry;
          
          console.log('--- 📊 Plan Status Calculation [HomeScreen] ---');
          console.log('Plan:', decoded.paymentPlan);
          console.log('Raw Expiry Date:', decoded.paymentExpiryDate);
          console.log('Parsed Expiry Date:', isNaN(expiry.getTime()) ? 'Invalid Date' : expiry.toLocaleString());
          console.log('Current Date:', now.toLocaleString());
          console.log('Is Expired:', isExpired);
          console.log('Remaining Attempts (from backend):', attempts);
          console.log('-----------------------------------------------');
        } else {
          console.log(`📊 [HomeScreen] Plan: Guest | Remaining Attempts: ${attempts}`);
        }
      } catch (logError) {
        console.log('📊 [HomeScreen] Remaining Attempts:', attempts);
      }
    } catch (e) {
      console.error('❌ [HomeScreen] fetchPending Error:', e);
      setRemainingAttempts(null);
      setAttemptsResetAt(null);
    }
  }, [getUserId, user]);

  useFocusEffect(useCallback(() => { fetchPending(); }, [fetchPending]));
  useEffect(() => { if (state === 'upload') fetchPending(); }, [state, fetchPending]);

  // Clear redirection flag when Home screen is focused
  // This prevents unwanted redirects if the user backed out of the auth flow
  useFocusEffect(
    useCallback(() => {
      const clearRedirectFlag = async () => {
        await AsyncStorage.removeItem('redirectToSubscription');
      };
      clearRedirectFlag();
    }, [])
  );

  // ---- Foreground GraphQL multipart upload (ordered & with preflight header) ----
  const uploadViaFetchGraphql = useCallback(async ({ file, subscriptionId, apiKeyToSend }) => {
    const token = await AsyncStorage.getItem('accessToken');

    const query = `
      mutation uploadService($apiKey: String, $file: Upload!, $subscriptionId: String!) {
        uploadService(apiKey: $apiKey, file: $file, subscriptionId: $subscriptionId) {
          name
          url
          confidence
          imageUrl
        }
      }
    `;

    const form = new FormData();
    form.append('operations', JSON.stringify({
      query,
      variables: { apiKey: apiKeyToSend, file: null, subscriptionId }
    }));
    form.append('map', JSON.stringify({ "0": ["variables.file"] }));
    form.append('0', {
      uri: normalizeFsPath(file.uri),
      name: file.fileName || 'photo.jpg',
      type: file.type || 'image/jpeg',
    });

    const res = await fetch(`${API_BASE_URL}/graphql/`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // 👇 Your server requires this header for multipart uploads
        'graphql-preflight': 'true',
        // Do NOT set Content-Type; RN sets the multipart boundary for FormData
        Accept: 'application/json',
      },
      body: form,
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, text, json };
  }, []);

  const startGraphqlUpload = useCallback(
    async (file, subscriptionId, apiKeyToSend) => {
      setTrackingMessage('Uploading image…');

      const { status, json, text } = await uploadViaFetchGraphql({
        file, subscriptionId, apiKeyToSend
      });

      if (__DEV__) {
        console.log('[GQL upload status]', status);
        console.log('[GQL upload body]', text);
      }

      // GraphQL errors?
      if (json?.errors?.length) {
        handleGraphQLErrors(json.errors);
        return;
      }

      if (status >= 200 && status < 300) {
        const items = json?.data?.uploadService;
        if (Array.isArray(items)) setResults(items);

        flagsRef.current.haveResults = true;

        // Mark guest trial as used
        const userId = await getUserId();
        if (!userId) {
          await AsyncStorage.setItem('guestUsedTrial', 'true');
        }

        if (flagsRef.current.subDone) {
          setState('results');
          unsubscribeStatus();
        } else {
          setTrackingMessage('Processing image…');
        }
        fetchPending(); // refresh attempts after success
      } else {
        const msg =
          json?.errors?.[0]?.message ||
          (status === 401 || status === 403
            ? 'Please sign in to continue.'
            : 'Upload failed.');
            
        const isLimitError = 
          msg.toLowerCase().includes('weekly free trial') ||
          msg.toLowerCase().includes('weekly api hit limit exceeded') ||
          msg.toLowerCase().includes('free trial limit exceeded') ||
          msg.toLowerCase().includes('free trial expired') ||
          msg.toLowerCase().includes('api key is expired');

        if (isLimitError) {
          if (!user) {
             await AsyncStorage.setItem('guestUsedTrial', 'true');
             setRemainingAttempts(0);
          }
          
          const isApiKeyExpired = msg.toLowerCase().includes('api key is expired');
          
          if (isApiKeyExpired) {
             Toast.show({
              type: 'error',
              text1: 'Plan Expired',
              text2: 'Redirecting to plans...',
              visibilityTime: 3000,
            });
            setTimeout(() => navigation.navigate('Subscription'), 2500);
          } else {
             handleGraphQLErrors([{ message: msg }]);
          }
        } else {
          Toast.show({ type: 'error', text1: `Server ${status}`, text2: msg });
          unsubscribeStatus();
          resetToUpload();
          fetchPending();
        }
      }
    },
    [unsubscribeStatus, resetToUpload, handleGraphQLErrors, fetchPending, uploadViaFetchGraphql, user]
  );

  const ensureApiKey = useCallback(async () => {
    const token = await AsyncStorage.getItem('accessToken');
    const userId = await getUserId();
    if (!token || !userId) return null;

    const cacheKey = `apiKey:${userId}`;

    let apiKey = await AsyncStorage.getItem(cacheKey);
    if (apiKey) {
      await AsyncStorage.setItem('apiKey', apiKey); // legacy mirror
      return apiKey;
    }

    try {
      const { data } = await client.query({
        query: GET_USER_API_KEY,
        variables: { userId },
        fetchPolicy: 'no-cache',
        context: { headers: { authorization: `Bearer ${token}` } },
      });

      apiKey = data?.apiKeys?.items?.[0]?.secret || null;
      if (apiKey) {
        await AsyncStorage.setItem(cacheKey, apiKey);
        await AsyncStorage.setItem('apiKey', apiKey);
      }
      return apiKey;
    } catch (e) {
      console.log('[ensureApiKey] error', e?.message || e);
      return null;
    }
  }, [getUserId]);

  const handleImageSelect = useCallback(
    async (selectedImage) => {
      if (!selectedImage) return;

      const token = await AsyncStorage.getItem('accessToken');
      const apiKey = await ensureApiKey();

      let apiKeyToSend = apiKey;
      if (!user || !token || !apiKey) {
        console.warn('No token or API key found — proceeding with apiKey:null');
        apiKeyToSend = null;
      }

      setImage(selectedImage);
      setResults([]);
      setTrackingMessage('Preparing upload…');
      resetFlags();
      setState('verifying');

      const subId = generateSubscriptionId();
      startStatusSubscription(subId);

      try {
        await startGraphqlUpload(selectedImage, subId, apiKeyToSend);
      } catch (e) {
        console.log('[startGraphqlUpload threw]', e?.message || e);
        Toast.show({ type: 'error', text1: 'Upload', text2: 'Could not start upload.' });
        unsubscribeStatus();
        resetToUpload();
        fetchPending();
      }
    },
    [
      startGraphqlUpload,
      startStatusSubscription,
      unsubscribeStatus,
      resetToUpload,
      user,
      ensureApiKey,
      fetchPending,
    ],
  );

  // Note: IAP logic is handled in SubscriptionScreen only to avoid duplicate listeners
  // which cause receipt verification errors when the app loads

  const openStripeCheckout = async () => {
    // Check if user is logged in
    const token = await AsyncStorage.getItem('accessToken');
    
    if (!user || !token) {
      // User is not logged in, set flag and navigate to login screen
      console.log('User not logged in, navigating to AuthLogin...');
      await AsyncStorage.setItem('redirectToSubscription', 'true');
      navigation.navigate('AuthLogin');
    } else {
      // User is logged in, navigate to subscription screen
      console.log('User logged in, navigating to Subscription...');
      navigation.navigate('Subscription');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
      <Navbar />
      <AlertDialog />

      <LinearGradient colors={['#007bff', '#69bfff']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <StatusBar barStyle="light-content" backgroundColor="#007bff" />
          <Text style={styles.heading}>Explore Publicly Available Look-Alike Images.</Text>
          <Text style={styles.subHeading}>
            Upload a photo to discover visually similar images found on publicly accessible websites
          </Text>

          {(!image || state === 'upload') && <UploadBox onUpload={handleImageSelect} />}

          {remainingAttempts !== null && !paymentPlan?.toLowerCase().includes('enterprise') && (
            <Text style={styles.attemptsText}>Remaining Attempts: {remainingAttempts}</Text>
          )}

          {state === 'verifying' && (
            <DetectionSteps 
              image={image} 
              currentStatus={trackingMessage || 'Uploading image…'} 
              onChangeImage={handleImageSelect}
            />
          )}

          {state === 'results' && (
            <MatchList
              image={image}
              results={results}
              onSelectImage={handleImageSelect}
              onReset={resetToUpload}
            />
          )}
        </ScrollView>

        {!user && state === 'upload' && (
          <FloatingUpgradeButton onPress={openStripeCheckout} />
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

// ------------------ UI bits ------------------
function FloatingUpgradeButton({ onPress }) {
  return (
    <View style={styles.upgradeWrap}>
      <TouchableOpacity onPress={onPress} style={styles.upgradeBtn} activeOpacity={0.9}>
        <Text style={styles.upgradeText}>Manage Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 10, paddingBottom: 60, flexGrow: 1 },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 20,
  },
  subHeading: {
    fontSize: 14,
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  attemptsText: {
    textAlign: 'center',
    color: '#ffffff',
    opacity: 0.95,
    marginTop: 8,
    fontWeight: '600',
  },
  upgradeWrap: {
    position: 'absolute',
    bottom: 14,
    right: 12,
    elevation: 6,
    borderRadius: 8,
  },
  upgradeBtn: {
    backgroundColor: '#1d6ee7',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  upgradeText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});





// import React, { useRef, useState, useCallback } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   ScrollView,
//   StatusBar,
//   TouchableOpacity,
//   BackHandler,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import LinearGradient from 'react-native-linear-gradient';
// import { useNavigation, useFocusEffect } from '@react-navigation/native';
// import Upload from 'react-native-background-upload';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import Toast from 'react-native-toast-message';
// import jwtDecode from 'jwt-decode';
// import { gql } from '@apollo/client';
// import { client } from '../apollo/client';
// import { Platform } from 'react-native';

// import { GET_PENDING_LOOKUPS, GET_USER_API_KEY } from '../graphql/mutations';

// import Navbar from '../components/Navbar';
// import UploadBox from '../components/UploadBox';
// import DetectionSteps from '../components/DetectionSteps';
// import MatchList from '../components/MatchList';
// import AlertDialog from '../components/AlertDialog';
// import { useAuth } from '../context/AuthContext';
// import { useAlert } from '../context/AlertContext';

// const STATUS_SUBSCRIPTION = gql`
//   subscription onMessage($id: String!) {
//     onMessage(id: $id) {
//       body
//     }
//   }
// `;

// function FloatingUpgradeButton({ onPress }) {
//   return (
//     <View style={styles.upgradeWrap}>
//       <TouchableOpacity
//         onPress={onPress}
//         style={styles.upgradeBtn}
//         activeOpacity={0.9}
//       >
//         <Text style={styles.upgradeText}>Manage Account</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

// export default function HomeScreen() {
//   const navigation = useNavigation();
//   const { user } = useAuth();
//   const { showAlert } = useAlert();

//   // 'upload' | 'verifying' | 'results'
//   const [state, setState] = useState('upload');
//   const [trackingMessage, setTrackingMessage] = useState('');
//   const [results, setResults] = useState([]);
//   const [image, setImage] = useState(null);

//   // attempts UI state
//   const [remainingAttempts, setRemainingAttempts] = useState(null);
//   const [attemptsResetAt, setAttemptsResetAt] = useState(null);

//   const currentUploadIdRef = useRef(null);
//   const subObserverRef = useRef(null);
//   const subIdRef = useRef(null);
//   const flagsRef = useRef({ subDone: false, haveResults: false });

//   // const normalizeFsPath = uri =>
//   //   uri?.startsWith('file://') ? uri.replace('file://', '') : uri;
//   const normalizeFsPath = (uri) => {
//   if (!uri) return uri;
//   if (Platform.OS === 'ios') {
//     // iOS wants file:// prefix
//     return uri.startsWith('file://') ? uri : `file://${uri}`;
//   }
//   // Android needs a raw absolute path (no scheme)
//   return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
// };
//   const generateSubscriptionId = () => `${Date.now()}`;
//   const resetFlags = () => {
//     flagsRef.current = { subDone: false, haveResults: false };
//   };

//   const clearUploadTracking = async () => {
//     currentUploadIdRef.current = null;
//     await AsyncStorage.multiRemove(['currentUploadId', 'currentSubId']).catch(
//       () => {},
//     );
//   };

//   const unsubscribeStatus = useCallback(() => {
//     try {
//       subObserverRef.current?.unsubscribe?.();
//     } catch {}
//     subObserverRef.current = null;
//     subIdRef.current = null;
//   }, []);

//   const cancelCurrentUploadIfAny = useCallback(async () => {
//     const uploadId =
//       currentUploadIdRef.current ||
//       (await AsyncStorage.getItem('currentUploadId'));
//     if (uploadId) {
//       try {
//         await Upload.cancelUpload(uploadId);
//       } catch {}
//     }
//     await clearUploadTracking();
//   }, []);

//   const resetToUpload = useCallback(() => {
//     setState('upload');
//     setImage(null);
//     setResults([]);
//     setTrackingMessage('');
//     resetFlags();
//   }, []);

//   // Back button: clean up flow or exit
//   useFocusEffect(
//     React.useCallback(() => {
//       const onBackPress = () => {
//         if (state !== 'upload') {
//           cancelCurrentUploadIfAny().finally(() => {
//             unsubscribeStatus();
//             resetToUpload();
//           });
//           return true;
//         }
//         BackHandler.exitApp();
//         return true;
//       };
//       const sub = BackHandler.addEventListener(
//         'hardwareBackPress',
//         onBackPress,
//       );
//       return () => sub.remove();
//     }, [state, cancelCurrentUploadIfAny, unsubscribeStatus, resetToUpload]),
//   );

//   // Logout reset
//   React.useEffect(() => {
//     if (!user) {
//       cancelCurrentUploadIfAny().finally(() => {
//         unsubscribeStatus();
//         resetToUpload();
//       });
//     }
//   }, [user, cancelCurrentUploadIfAny, unsubscribeStatus, resetToUpload]);

//   // --- STATUS SUBSCRIPTION ---
//   const startStatusSubscription = useCallback(
//     subscriptionId => {
//       unsubscribeStatus();
//       subIdRef.current = subscriptionId;

//       const observable = client.subscribe({
//         query: STATUS_SUBSCRIPTION,
//         variables: { id: subscriptionId },
//       });

//       subObserverRef.current = observable.subscribe({
//         next: ({ data }) => {
//           const msg = data?.onMessage?.body;

//           // added log for debugging pipeline
//           if (__DEV__) console.log('[SUB status]', msg);

//           if (msg) setTrackingMessage(msg);

//           if (msg === 'Detection Completed.') {
//             flagsRef.current.subDone = true;
//             if (flagsRef.current.haveResults) {
//               setState('results');
//               unsubscribeStatus();
//             }
//           }
//         },
//         error: err => {
//           console.log('[subscription error]', err?.message || err);
//         },
//       });
//     },
//     [unsubscribeStatus],
//   );

//   // --- GraphQL error helper ---
//   const handleGraphQLErrors = useCallback(
    
//     errorsArray => {
//       if (__DEV__) console.log('[GQL errors]', JSON.stringify(errorsArray, null, 2));
//       const message = errorsArray?.[0]?.message || 'Upload failed';
//       if (
//         message.toLowerCase().includes('weekly free trial') ||
//         message.toLowerCase().includes('weekly api hit limit exceeded')
//       ) {
//         // show upgrade dialog for both messages
//         showAlert(message);
//       } else {
//         Toast.show({ type: 'error', text1: 'Error', text2: message });
//       }
//       unsubscribeStatus();
//       resetToUpload();
//       // refresh attempts if failed due to limits
//       fetchPending();
//     },
//     [resetToUpload, unsubscribeStatus, showAlert],
//   );

//   // helpers
//   const getUserId = useCallback(async () => {
//     const saved = await AsyncStorage.getItem('currentUserId');
//     if (saved) return saved;

//     const token = await AsyncStorage.getItem('accessToken');
//     if (!token) return null;

//     try {
//       const decoded = jwtDecode(token);
//       const uid = decoded?.id || decoded?.userId || decoded?.sub || null;
//       if (uid) {
//         await AsyncStorage.setItem('currentUserId', String(uid));
//         return String(uid);
//       }
//     } catch (_) {}
//     return null;
//   }, []);

//   // fetch remaining attempts
//   const fetchPending = useCallback(async () => {
//     const token = await AsyncStorage.getItem('accessToken');
//     const userId = await getUserId();
//     if (!token || !userId) {
//       setRemainingAttempts(null);
//       setAttemptsResetAt(null);
//       return;
//     }
//     try {
//       const { data } = await client.query({
//         query: GET_PENDING_LOOKUPS,
//         variables: { userId },
//         fetchPolicy: 'no-cache',
//         context: { headers: { authorization: `Bearer ${token}` } },
//       });
//       console.log('pendingLookups response:', JSON.stringify(data, null, 2));

//       const pending = data?.pendingLookups;
//       setRemainingAttempts(pending?.pendingLookups ?? null);
//       setAttemptsResetAt(pending?.lastDate ?? null);
//     } catch (e) {
//       console.log('[GET_PENDING_LOOKUPS error]', e?.message || e);
//       setRemainingAttempts(null);
//       setAttemptsResetAt(null);
//     }
//   }, [getUserId]);

//   // Fetch attempts on focus and whenever we go back to "upload"
//   useFocusEffect(
//     useCallback(() => {
//       fetchPending();
//     }, [fetchPending]),
//   );
//   React.useEffect(() => {
//     if (state === 'upload') fetchPending();
//   }, [state, fetchPending]);

//   // ---- Background GraphQL multipart upload ----
//   const startBackgroundGraphqlUpload = useCallback(
//     async (file, subscriptionId, apiKeyToSend) => {
//       const token = await AsyncStorage.getItem('accessToken');

//       const operations = {
//         query: `
//           mutation uploadService($apiKey: String, $file: Upload!, $subscriptionId: String!) {
//             uploadService(apiKey: $apiKey, file: $file, subscriptionId: $subscriptionId) {
//               name
//               url
//               confidence
//               imageUrl
//             }
//           }
//         `,
//         variables: { apiKey: apiKeyToSend, file: null, subscriptionId },
//       };
//       const map = { 0: ['variables.file'] };
//       const path = normalizeFsPath(file.uri);

//       const options = {
//         url: 'https://api.safetycamai.com/graphql/',
//         type: 'multipart',
//         method: 'POST',
//         field: '0',
//         path,
//         headers: {
//           Accept: 'application/json',
//           'graphql-preflight': 'true',
//           ...(token ? { Authorization: `Bearer ${token}` } : {}),
//         },
//         parameters: {
//           operations: JSON.stringify(operations),
//           map: JSON.stringify(map),

//           // pass explicit filename & mime so iOS uses them on the multipart part
//           fileNameOverride: file.fileName || 'upload',
//           fileContentType: file.type || 'application/octet-stream',
//         },
//         notification: {
//           enabled: true,
//           autoClear: true,
//           enableRingTone: false,
//           android: {
//             enableForegroundService: true,
//             notificationChannel: 'uploads',
//             notificationTitle: 'Uploading image…',
//             progressTitle: 'Uploading',
//           },
//         },
//         readTimeout: 120,
//         writeTimeout: 120,
//         connectTimeout: 30,
//       };

//       if (__DEV__) console.log('[startUpload options]\n', options);

//       const uploadId = await Upload.startUpload(options);
//       currentUploadIdRef.current = uploadId;
//       await AsyncStorage.multiSet([
//         ['currentUploadId', uploadId],
//         ['currentSubId', subscriptionId],
//       ]);

//       setTrackingMessage('Uploading image…');

//       Upload.addListener('progress', uploadId, () => {
//         setTrackingMessage('Uploading image…');
//       });

//       Upload.addListener('error', uploadId, data => {
//         console.log('[UPLOAD error]', data);
//         clearUploadTracking();
//         Toast.show({
//           type: 'error',
//           text1: 'Upload failed',
//           text2: data?.error || 'Please try again.',
//         });
//         unsubscribeStatus();
//         resetToUpload();
//         fetchPending(); // refresh attempts after failure
//       });

//       Upload.addListener('cancelled', uploadId, () => {
//         clearUploadTracking();
//         unsubscribeStatus();
//         resetToUpload();
//       });

//       Upload.addListener('completed', uploadId, async data => {
//         await clearUploadTracking();
//         try {
//           const { responseCode, responseBody } = data || {};

//           // added logs to inspect backend response
//           if (__DEV__) {
//             console.log('[UPLOAD completed] code=', responseCode);
//             console.log('[UPLOAD body] ', responseBody);
//           }

//           let json = {};
//           try {
//             json = JSON.parse(responseBody || '{}');
//           } catch {}

//           // Errors first
//           if (Array.isArray(json?.errors) && json.errors.length) {
//             handleGraphQLErrors(json.errors);
//             return;
//           }

//           if (responseCode >= 200 && responseCode < 300) {
//             const items = json?.data?.uploadService;
//             if (Array.isArray(items)) setResults(items);

//             flagsRef.current.haveResults = true;

//             if (flagsRef.current.subDone) {
//               setState('results');
//               unsubscribeStatus();
//             } else {
//               setTrackingMessage('Processing image…');
//             }
//             fetchPending(); // refresh attempts after success
//           } else {
//             const msg =
//               json?.errors?.[0]?.message ||
//               (responseCode === 401 || responseCode === 403
//                 ? 'Please sign in to continue.'
//                 : 'Upload failed.');
//             if (
//               msg.toLowerCase().includes('weekly free trial') ||
//               msg.toLowerCase().includes('weekly api hit limit exceeded')
//             ) {
//               handleGraphQLErrors([{ message: msg }]);
//             } else {
//               Toast.show({
//                 type: 'error',
//                 text1: `Server ${responseCode || ''}`,
//                 text2: msg,
//               });
//               unsubscribeStatus();
//               resetToUpload();
//               fetchPending();
//             }
//           }
//         } catch (e) {
//           unsubscribeStatus();
//           resetToUpload();
//           fetchPending();
//         }
//       });
//     },
//     [unsubscribeStatus, resetToUpload, handleGraphQLErrors, fetchPending],
//   );

//   const ensureApiKey = useCallback(async () => {
//     const token = await AsyncStorage.getItem('accessToken');
//     const userId = await getUserId();
//     if (!token || !userId) return null;

//     // Namespace by user so you don’t reuse another account’s key.
//     const cacheKey = `apiKey:${userId}`;

//     // 1) Try cache
//     let apiKey = await AsyncStorage.getItem(cacheKey);
//     if (apiKey) {
//       // also mirror to legacy key for any old code still reading it
//       await AsyncStorage.setItem('apiKey', apiKey);
//       return apiKey;
//     }

//     // 2) Fetch fresh from GraphQL
//     try {
//       const { data } = await client.query({
//         query: GET_USER_API_KEY,
//         variables: { userId },
//         fetchPolicy: 'no-cache',
//         context: { headers: { authorization: `Bearer ${token}` } },
//       });

//       apiKey = data?.apiKeys?.items?.[0]?.secret || null;
//       if (apiKey) {
//         await AsyncStorage.setItem(cacheKey, apiKey);
//         await AsyncStorage.setItem('apiKey', apiKey); // keep legacy key in sync
//       }
//       return apiKey;
//     } catch (e) {
//       console.log('[ensureApiKey] error', e?.message || e);
//       return null;
//     }
//   }, [getUserId]);

//   const handleImageSelect = useCallback(
//     async selectedImage => {
//       if (!selectedImage) return;

//       const token = await AsyncStorage.getItem('accessToken');
//       const apiKey = await ensureApiKey();

//       let apiKeyToSend = apiKey;
//       if (!user || !token || !apiKey) {
//         console.warn('No token or API key found — proceeding with apiKey:null');
//         apiKeyToSend = null;
//       }

//       setImage(selectedImage);
//       setResults([]);
//       resetFlags();
//       setTrackingMessage('Preparing upload…');
//       setState('verifying');

//       const subId = generateSubscriptionId();
//       startStatusSubscription(subId);

//       try {
//         await startBackgroundGraphqlUpload(selectedImage, subId, apiKeyToSend);
//       } catch (e) {
//         console.log('[startUpload threw]', e?.message || e);
//         Toast.show({
//           type: 'error',
//           text1: 'Upload',
//           text2: 'Could not start upload.',
//         });
//         unsubscribeStatus();
//         resetToUpload();
//         fetchPending();
//       }
//     },
//     [
//       startBackgroundGraphqlUpload,
//       startStatusSubscription,
//       unsubscribeStatus,
//       resetToUpload,
//       user,
//       ensureApiKey,
//       fetchPending,
//     ],
//   );

//   const openStripeCheckout = () => {
//     const url =
//       'https://buy.stripe.com/14k5mlbRx1VGfBe003?locale=en&__embed_source=buy_btn_1RNajwKLsA7J6NNllOqM5WFB';
//     navigation.navigate('MugshotWebView', { url, title: 'Upgrade' });
//   };

//   return (
//     <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
//       <Navbar />
//       <AlertDialog />

//       <LinearGradient colors={['#007bff', '#69bfff']} style={styles.container}>
//         <ScrollView
//           contentContainerStyle={styles.scrollContent}
//           keyboardShouldPersistTaps="handled"
//         >
//           <StatusBar barStyle="light-content" backgroundColor="#007bff" />
//           <Text style={styles.heading}>
//             Find Criminals. Stay Aware. Stay Safe.
//           </Text>
//           <Text style={styles.subHeading}>
//             Easily search billions of records — from most-wanted fugitives to
//             petty thieves.
//           </Text>

//           {state === 'upload' && <UploadBox onUpload={handleImageSelect} />}

//           {/* attempts line */}
//           {remainingAttempts !== null && (
//             <Text style={styles.attemptsText}>
//               Remaining Attempts: {remainingAttempts}
//             </Text>
//           )}
//           {/* optionally show reset info:
//           {attemptsResetAt && (
//             <Text style={styles.attemptsResetText}>
//               Resets on: {new Date(attemptsResetAt).toLocaleString()}
//             </Text>
//           )} */}

//           {state === 'verifying' && (
//             <DetectionSteps
//               image={image}
//               currentStatus={trackingMessage || 'Uploading image…'}
//             />
//           )}

//           {state === 'results' && (
//             <MatchList
//               image={image}
//               results={results}
//               onSelectImage={handleImageSelect}
//             />
//           )}
//         </ScrollView>

//         {!user && state === 'upload' && (
//           <FloatingUpgradeButton onPress={openStripeCheckout} />
//         )}
//       </LinearGradient>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1 },
//   scrollContent: { padding: 10, paddingBottom: 60, flexGrow: 1 },
//   heading: {
//     fontSize: 22,
//     fontWeight: 'bold',
//     color: '#fff',
//     textAlign: 'center',
//     marginBottom: 8,
//     marginTop: 20,
//   },
//   subHeading: {
//     fontSize: 14,
//     color: '#e0e0e0',
//     textAlign: 'center',
//     marginBottom: 12,
//     paddingHorizontal: 10,
//   },
//   attemptsText: {
//     textAlign: 'center',
//     color: '#ffffff',
//     opacity: 0.95,
//     marginTop: 8,
//     fontWeight: '600',
//   },
//   attemptsResetText: {
//     textAlign: 'center',
//     color: '#eef2ff',
//     marginBottom: 8,
//   },
//   upgradeWrap: {
//     position: 'absolute',
//     bottom: 14,
//     right: 12,
//     elevation: 6,
//     borderRadius: 8,
//   },
//   upgradeBtn: {
//     backgroundColor: '#1d6ee7',
//     borderRadius: 8,
//     paddingVertical: 10,
//     paddingHorizontal: 18,
//     borderWidth: 1,
//     borderColor: 'rgba(255,255,255,0.7)',
//   },
//   upgradeText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
// });


// import React, { useRef, useState, useCallback } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   ScrollView,
//   StatusBar,
//   TouchableOpacity,
//   BackHandler,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import LinearGradient from 'react-native-linear-gradient';
// import { useNavigation, useFocusEffect } from '@react-navigation/native';
// import Upload from 'react-native-background-upload';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import Toast from 'react-native-toast-message';
// import jwtDecode from 'jwt-decode';

// import { gql } from '@apollo/client';
// import { client } from '../apollo/client';
// import { GET_USER_API_KEY } from '../graphql/mutations';

// import Navbar from '../components/Navbar';
// import UploadBox from '../components/UploadBox';
// import DetectionSteps from '../components/DetectionSteps';
// import MatchList from '../components/MatchList';
// import AlertDialog from '../components/AlertDialog';
// import { useAuth } from '../context/AuthContext';
// import { useAlert } from '../context/AlertContext';
// import { GET_PENDING_LOOKUPS } from '../graphql/mutations';

// const STATUS_SUBSCRIPTION = gql`
//   subscription onMessage($id: String!) {
//     onMessage(id: $id) {
//       body
//     }
//   }
// `;

// function FloatingUpgradeButton({ onPress }) {
//   return (
//     <View style={styles.upgradeWrap}>
//       <TouchableOpacity onPress={onPress} style={styles.upgradeBtn} activeOpacity={0.9}>
//         <Text style={styles.upgradeText}>Upgrade</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

// export default function HomeScreen() {
//   const navigation = useNavigation();
//   const { user } = useAuth();
//   const { showAlert } = useAlert();

//   // 'upload' | 'verifying' | 'results'
//   const [state, setState] = useState('upload');
//   const [trackingMessage, setTrackingMessage] = useState('');
//   const [results, setResults] = useState([]);
//   const [image, setImage] = useState(null);

//   const [remainingAttempts, setRemainingAttempts] = useState(null);
//   const [attemptsResetAt, setAttemptsResetAt] = useState(null);

//   const currentUploadIdRef = useRef(null);
//   const subObserverRef = useRef(null);
//   const subIdRef = useRef(null);
//   const flagsRef = useRef({ subDone: false, haveResults: false });

//   const normalizeFsPath = (uri) => (uri?.startsWith('file://') ? uri.replace('file://', '') : uri);
//   const generateSubscriptionId = () => `${Date.now()}`;
//   const resetFlags = () => { flagsRef.current = { subDone: false, haveResults: false }; };

//   const clearUploadTracking = async () => {
//     currentUploadIdRef.current = null;
//     await AsyncStorage.multiRemove(['currentUploadId', 'currentSubId']).catch(() => {});
//   };

//   const unsubscribeStatus = useCallback(() => {
//     try { subObserverRef.current?.unsubscribe?.(); } catch {}
//     subObserverRef.current = null;
//     subIdRef.current = null;
//   }, []);

//   const cancelCurrentUploadIfAny = useCallback(async () => {
//     const uploadId = currentUploadIdRef.current || (await AsyncStorage.getItem('currentUploadId'));
//     if (uploadId) {
//       try { await Upload.cancelUpload(uploadId); } catch {}
//     }
//     await clearUploadTracking();
//   }, []);

//   const resetToUpload = useCallback(() => {
//     setState('upload');
//     setImage(null);
//     setResults([]);
//     setTrackingMessage('');
//     resetFlags();
//   }, []);

//   // Back button behavior
//   useFocusEffect(
//     React.useCallback(() => {
//       const onBackPress = () => {
//         if (state !== 'upload') {
//           cancelCurrentUploadIfAny().finally(() => {
//             unsubscribeStatus();
//             resetToUpload();
//           });
//           return true;
//         }
//         BackHandler.exitApp();
//         return true;
//       };

//       const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
//       return () => sub.remove();
//     }, [state, cancelCurrentUploadIfAny, unsubscribeStatus, resetToUpload])
//   );

//   // Logout reset
//   React.useEffect(() => {
//     if (!user) {
//       cancelCurrentUploadIfAny().finally(() => {
//         unsubscribeStatus();
//         resetToUpload();
//       });
//     }
//   }, [user, cancelCurrentUploadIfAny, unsubscribeStatus, resetToUpload]);

//   // --- STATUS SUBSCRIPTION (for DetectionSteps) ---
//   const startStatusSubscription = useCallback((subscriptionId) => {
//     unsubscribeStatus();
//     subIdRef.current = subscriptionId;

//     const observable = client.subscribe({
//       query: STATUS_SUBSCRIPTION,
//       variables: { id: subscriptionId },
//     });

//     subObserverRef.current = observable.subscribe({
//       next: ({ data }) => {
//         const msg = data?.onMessage?.body;
//         if (msg) setTrackingMessage(msg);

//         if (msg === 'Detection Completed.') {
//           flagsRef.current.subDone = true;
//           if (flagsRef.current.haveResults) {
//             setState('results');
//             unsubscribeStatus();
//           }
//         }
//       },
//       error: (err) => {
//         console.log('[subscription error]', err?.message || err);
//       },
//     });
//   }, [unsubscribeStatus]);

//   // Small helper to surface GraphQL errors (esp. weekly trial)
//   const handleGraphQLErrors = useCallback((errorsArray) => {
//     const message = errorsArray?.[0]?.message || 'Upload failed';
//     if (message.toLowerCase().includes('weekly')) {
//       showAlert(message);
//     }

//      else {
//       console.log(message)
//       Toast.show({ type: 'error', text1: 'Error', text2: message });
//     }
//     unsubscribeStatus();
//     resetToUpload();
//   }, [resetToUpload, unsubscribeStatus, showAlert]);

//   // 🔑 Helper: get userId (prefer saved; else decode token)
//   const getUserId = useCallback(async () => {
//     const saved = await AsyncStorage.getItem('currentUserId');
//     if (saved) return saved;

//     const token = await AsyncStorage.getItem('accessToken');
//     if (!token) return null;

//     try {
//       const decoded = jwtDecode(token);
//       const uid = decoded?.id || decoded?.userId || decoded?.sub || null;
//       if (uid) {
//         await AsyncStorage.setItem('currentUserId', String(uid));
//         return String(uid);
//       }
//     } catch (_) {}
//     return null;
//   }, []);

//   // 🔑 Helper: ensure we have the user API key (fetch & cache if missing)
//   const ensureApiKey = useCallback(async () => {
//     let apiKey = await AsyncStorage.getItem('apiKey');
//     if (apiKey) return apiKey;

//     const token = await AsyncStorage.getItem('accessToken');
//     const userId = await getUserId();
//     if (!token || !userId) return null;

//     try {
//       const { data } = await client.query({
//         query: GET_USER_API_KEY,
//         variables: { userId },
//         fetchPolicy: 'no-cache',
//         context: { headers: { authorization: `Bearer ${token}` } },
//       });
//       apiKey = data?.apiKeys?.items?.[0]?.secret || null;
//       if (apiKey) await AsyncStorage.setItem('apiKey', apiKey);
//       console.log(apiKey);
//       return apiKey;
//     } catch (e) {
//       console.log('[GET_USER_API_KEY error]', e?.message || e);
//       return null;
//     }
//   }, [getUserId]);

//   // ---- Background GraphQL multipart upload ----
//   const startBackgroundGraphqlUpload = useCallback(
//     async (file, subscriptionId, apiKeyToSend) => {
//       const token = await AsyncStorage.getItem('accessToken');

//       const operations = {
//         query: `
//           mutation uploadService($apiKey: String, $file: Upload!, $subscriptionId: String!) {
//             uploadService(apiKey: $apiKey, file: $file, subscriptionId: $subscriptionId) {
//               name
//               url
//               confidence
//               imageUrl
//             }
//           }
//         `,
//         variables: { apiKey: apiKeyToSend, file: null, subscriptionId },
//       };
//       const map = { 0: ['variables.file'] };

//       const path = normalizeFsPath(file.uri);

//       const options = {
//         url: 'https://api.safetycamai.com/graphql/',
//         type: 'multipart',
//         method: 'POST',
//         field: '0',
//         path,
//         headers: {
//           Accept: 'application/json',
//           'graphql-preflight': 'true',
//           ...(token ? { Authorization: `Bearer ${token}` } : {}),
//         },
//         parameters: {
//           operations: JSON.stringify(operations),
//           map: JSON.stringify(map),
//         },
//         notification: {
//           enabled: true,
//           autoClear: true,
//           enableRingTone: false,
//           android: {
//             enableForegroundService: true,
//             notificationChannel: 'uploads',
//             notificationTitle: 'Uploading image…',
//             progressTitle: 'Uploading',
//           },
//         },
//         readTimeout: 120,
//         writeTimeout: 120,
//         connectTimeout: 30,
//       };

//       if (__DEV__) console.log('[startUpload options]\n', options);

//       const uploadId = await Upload.startUpload(options);
//       currentUploadIdRef.current = uploadId;
//       await AsyncStorage.multiSet([
//         ['currentUploadId', uploadId],
//         ['currentSubId', subscriptionId],
//       ]);

//       setTrackingMessage('Uploading image…');

//       Upload.addListener('progress', uploadId, () => {
//         setTrackingMessage('Uploading image…');
//       });

//       Upload.addListener('error', uploadId, (data) => {
//         console.log('[UPLOAD error]', data);
//         clearUploadTracking();
//         Toast.show({
//           type: 'error',
//           text1: 'Upload failed',
//           text2: data?.error || 'Please try again.',
//         });
//         unsubscribeStatus();
//         resetToUpload();
//       });

//       Upload.addListener('cancelled', uploadId, () => {
//         clearUploadTracking();
//         unsubscribeStatus();
//         resetToUpload();
//       });

//       Upload.addListener('completed', uploadId, async (data) => {
//         await clearUploadTracking();
//         try {
//           const { responseCode, responseBody } = data || {};
//           let json = {};
//           try { json = JSON.parse(responseBody || '{}'); } catch {}

//           // GraphQL Errors first
//           if (Array.isArray(json?.errors) && json.errors.length) {
//             handleGraphQLErrors(json.errors);
//             return;
//           }

//           if (responseCode >= 200 && responseCode < 300) {
//             const items = json?.data?.uploadService;
//             if (Array.isArray(items)) setResults(items);

//             flagsRef.current.haveResults = true;

//             if (flagsRef.current.subDone) {
//               setState('results');
//               unsubscribeStatus();
//             } else {
//               setTrackingMessage('Processing image…');
//             }
//           } else {
//             const msg =
//               json?.errors?.[0]?.message ||
//               (responseCode === 401 || responseCode === 403
//                 ? 'Please sign in to continue.'
//                 : 'Upload failed.');
//             if (msg.toLowerCase().includes('weekly free trial')) {
//               handleGraphQLErrors([{ message: msg }]);
//             } else {
//               Toast.show({ type: 'error', text1: `Server ${responseCode || ''}`, text2: msg });
//               unsubscribeStatus();
//               resetToUpload();
//             }
//           }
//         } catch (e) {
//           unsubscribeStatus();
//           resetToUpload();
//         }
//       });
//     },
//     [unsubscribeStatus, resetToUpload, handleGraphQLErrors]
//   );

//   const handleImageSelect = useCallback(
//     async (selectedImage) => {
//       if (!selectedImage) return;

//       // 🔑 Ensure user API key exists at the moment of upload
//       const token = await AsyncStorage.getItem('accessToken');
//       const apiKey = await ensureApiKey();

//       let apiKeyToSend = apiKey;
//       if (!user || !token || !apiKey) {
//         console.warn('No token or API key found — proceeding with apiKey:null');
//         apiKeyToSend = null;
//       }

//       setImage(selectedImage);
//       setResults([]);
//       resetFlags();
//       setTrackingMessage('Preparing upload…');
//       setState('verifying');

//       const subId = generateSubscriptionId();
//       startStatusSubscription(subId);

//       try {
//         await startBackgroundGraphqlUpload(selectedImage, subId, apiKeyToSend);
//       } catch (e) {
//         console.log('[startUpload threw]', e?.message || e);
//         Toast.show({ type: 'error', text1: 'Upload', text2: 'Could not start upload.' });
//         unsubscribeStatus();
//         resetToUpload();
//       }
//     },
//     [startBackgroundGraphqlUpload, startStatusSubscription, unsubscribeStatus, resetToUpload, user, ensureApiKey]
//   );

//   const openStripeCheckout = () => {
//     const url =
//       'https://buy.stripe.com/14k5mlbRx1VGfBe003?locale=en&__embed_source=buy_btn_1RNajwKLsA7J6NNllOqM5WFB';
//     navigation.navigate('MugshotWebView', { url, title: 'Upgrade' });
//   };

//   return (
//     <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
//       <Navbar />
//       <AlertDialog />

//       <LinearGradient colors={['#007bff', '#69bfff']} style={styles.container}>
//         <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
//           <StatusBar barStyle="light-content" backgroundColor="#007bff" />
//           <Text style={styles.heading}>Find Criminals. Stay Aware. Stay Safe.</Text>
//           <Text style={styles.subHeading}>
//             Easily search billions of records — from most-wanted fugitives to petty thieves.
//           </Text>

//           {state === 'upload' && <UploadBox onUpload={handleImageSelect} />}

//           {state === 'verifying' && (
//             <DetectionSteps image={image} currentStatus={trackingMessage || 'Uploading image…'} />
//           )}

//           {state === 'results' && (
//             <MatchList image={image} results={results} onSelectImage={handleImageSelect} />
//           )}
//         </ScrollView>

//         {!user && state === 'upload' && <FloatingUpgradeButton onPress={openStripeCheckout} />}
//       </LinearGradient>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1 },
//   scrollContent: { padding: 10, paddingBottom: 60, flexGrow: 1 },
//   heading: {
//     fontSize: 22,
//     fontWeight: 'bold',
//     color: '#fff',
//     textAlign: 'center',
//     marginBottom: 8,
//     marginTop: 20,
//   },
//   subHeading: {
//     fontSize: 14,
//     color: '#e0e0e0',
//     textAlign: 'center',
//     marginBottom: 24,
//     paddingHorizontal: 10,
//   },
//   upgradeWrap: { position: 'absolute', bottom: 14, right: 12, elevation: 6, borderRadius: 8 },
//   upgradeBtn: {
//     backgroundColor: '#1d6ee7',
//     borderRadius: 8,
//     paddingVertical: 10,
//     paddingHorizontal: 18,
//     borderWidth: 1,
//     borderColor: 'rgba(255,255,255,0.7)',
//   },
//   upgradeText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
// });
