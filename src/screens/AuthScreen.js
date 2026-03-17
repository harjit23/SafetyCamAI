import React, { useState, useEffect } from 'react';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useMutation } from '@apollo/client';
import { jwtDecode } from 'jwt-decode';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../config';

import RegisterForm from '../authentication/RegisterForm';
import ForgotPassword from '../authentication/ForgotPassword';
import ResetPassword from '../authentication/ResetPassword';
import LoginForm from '../authentication/LoginForm';
import MfaVerify from '../authentication/MfaVerify';

import { VERIFY_EMAIL_ADDRESS_MUTATION } from '../graphql/mutations';
import { useAlert } from '../context/AlertContext';
import { useLoader } from '../context/LoaderContext';

export default function AuthScreen() {
  const [activeScreen, setActiveScreen] = useState('login');
  const route = useRoute();
  const navigation = useNavigation();
  const { user, setUser } = useAuth();
  const { showAlert } = useAlert();
  const { showLoader, hideLoader } = useLoader();
  const [verifyEmailAddress] = useMutation(VERIFY_EMAIL_ADDRESS_MUTATION);

  // Keep a ref to the latest user without making it a useEffect dependency
  const userRef = React.useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Guard so the code exchange runs at most once per unique code
  const handledCodeRef = React.useRef(null);

  useEffect(() => {
    const params = route.params || {};
    const { code, email, provider, purpose } = params;

    // Redirect if already logged in and not exchanging a code
    if (userRef.current && !code) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
      return;
    }

    // Handle Social Login Code Exchange
    const handleSocialExchange = async () => {
      let targetProvider = provider;

      if (code && !targetProvider) {
        try {
          targetProvider = await AsyncStorage.getItem('pendingProvider');
          console.log('[AuthScreen] Retrieved pending provider:', targetProvider);
          await AsyncStorage.removeItem('pendingProvider');
        } catch (e) {
          console.warn('Failed to get pending provider', e);
        }
      }

      if (!code || !targetProvider || email) return;

      // Guard: only handle each unique code once
      if (handledCodeRef.current === code) {
        console.log('[AuthScreen] Code already handled, skipping:', code);
        return;
      }
      handledCodeRef.current = code;

      // If this is a linking code (not a login), redirect to Profile
      const isLinkPurpose = purpose === 'link';
      const storedPurpose = await AsyncStorage.getItem('linkingPurpose');
      const isStoredLink = storedPurpose === 'link';

      if ((isLinkPurpose || isStoredLink) && userRef.current) {
        if (isStoredLink) await AsyncStorage.removeItem('linkingPurpose');
        console.log('[AuthScreen] Detected linking code, redirecting to Profile...');
        navigation.navigate('Profile', { code, provider: targetProvider, purpose: 'link' });
        return;
      }
      if (storedPurpose) await AsyncStorage.removeItem('linkingPurpose');

      // Normal social login exchange
      console.log('[AuthScreen] Received social login params:', { code, provider: targetProvider });
      try {
        showLoader('Exchanging code...');
        console.log(`[AuthScreen] Exchanging code with ${API_BASE_URL}/auth/${targetProvider}/exchange`);
        const response = await axios.post(
          `${API_BASE_URL}/auth/${targetProvider}/exchange`,
          JSON.stringify(code),
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        console.log('[AuthScreen] Exchange response:', response.data);

        const { token, refreshToken } = response.data?.token || {};

        if (token && refreshToken) {
          console.log('[AuthScreen] Tokens received, saving...');
          await AsyncStorage.setItem('accessToken', token);
          await AsyncStorage.setItem('refreshToken', refreshToken);

          try {
            const decoded = jwtDecode(token);
            const userId = decoded?.id || decoded?.userId || decoded?.sub || null;
            if (userId) {
              await AsyncStorage.setItem('currentUserId', String(userId));
            }
          } catch (_) {}

          console.log('[AuthScreen] Setting user and checking redirection...');
          setUser(response.data);

          const redirectToSubscription = await AsyncStorage.getItem('redirectToSubscription');
          if (redirectToSubscription === 'true') {
            await AsyncStorage.removeItem('redirectToSubscription');
            navigation.reset({
              index: 0,
              routes: [{ name: 'Subscription' }],
            });
          } else {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          }
        } else {
          console.error('[AuthScreen] Invalid response structure:', response.data);
          throw new Error('Invalid token response');
        }
      } catch (error) {
        console.error('Error exchanging social code:', error);
        
        let errorMsg = 'Login failed. Please try again.';
        if (error.response?.data?.error) {
          errorMsg = error.response.data.error;
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        showAlert(errorMsg);
      } finally {
        hideLoader();
      }
    };

    handleSocialExchange();

    switch (route.name) {
      case 'AuthLogin':
        setActiveScreen('login');
        break;
      case 'AuthRegister':
        setActiveScreen('register');
        break;
      case 'AuthReset':
        setActiveScreen('reset');
        break;
      case 'AuthVerify':
        if (code && email) {
          verifyEmailAddress({ variables: { code, email } })
            .then(() => {
              showAlert('Email verified successfully. You can now log in.');
              setActiveScreen('login');
            })
            .catch(err => {
              const msg = err.message || 'Verification failed';
              showAlert(msg);
            });
        }
        break;
      default:
        setActiveScreen('login');
    }
  }, [route.name, route.params, verifyEmailAddress, showAlert, setUser, navigation]); // ✅ 'user' removed — using userRef instead

  const renderScreen = () => {
    switch (activeScreen) {
      case 'login':
        return <LoginForm switchTo={setActiveScreen} />;
      case 'register':
        return <RegisterForm switchTo={setActiveScreen} />;
      case 'forgot':
        return <ForgotPassword switchTo={setActiveScreen} />;
      case 'reset':
        return <ResetPassword switchTo={setActiveScreen} route={route} />;
      case 'mfa': // 🔐 MFA screen
        return <MfaVerify switchTo={setActiveScreen} />;
      default:
        return <LoginForm switchTo={setActiveScreen} />;
    }
  };

  return (
    <>
      <SafeAreaView edges={['top']} style={styles.topInset}>
        <StatusBar barStyle="light-content" backgroundColor="black" />
      </SafeAreaView>

      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
        <Image
          source={require('../assets/Authorization-Background.png')}
          style={styles.bg}
        />
        
        {/* Back Button */}
        <TouchableOpacity 
          onPress={async () => {
            await AsyncStorage.removeItem('redirectToSubscription');
            navigation.navigate('Home');
          }} 
          style={styles.backButton}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Safety Cam AI</Text>
            <View style={styles.formWrapper}>{renderScreen()}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  topInset: { flex: 0, backgroundColor: 'black' },
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    color: '#007bff',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  formWrapper: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  bg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
});









// import React, { useEffect, useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   Image,
//   KeyboardAvoidingView,
//   ScrollView,
//   Platform,
//   StatusBar,
// } from 'react-native';
// import { useMutation } from '@apollo/client';
// import { useRoute } from '@react-navigation/native';
// import { SafeAreaView } from 'react-native-safe-area-context';

// import RegisterForm from '../authentication/RegisterForm';
// import ForgotPassword from '../authentication/ForgotPassword';
// import ResetPassword from '../authentication/ResetPassword';
// import LoginForm from '../authentication/LoginForm';
// import { VERIFY_EMAIL_ADDRESS_MUTATION } from '../graphql/mutations';
// import { useAlert } from '../context/AlertContext';
// import MfaVerify from '../authentication/MfaVerify';

// export default function AuthScreen() {
//   const [activeScreen, setActiveScreen] = useState('login');
//   const route = useRoute();
//   const { showAlert } = useAlert?.() || {};
//   const [verifyEmailAddress] = useMutation(VERIFY_EMAIL_ADDRESS_MUTATION);

//   useEffect(() => {
//     const params = route.params || {};
//     const { code, email } = params;

//     switch (route.name) {
//       case 'AuthLogin':
//         setActiveScreen('login');
//         break;
//       case 'AuthRegister':
//         setActiveScreen('register');
//         break;
//       case 'AuthReset':
//         setActiveScreen('reset');
//         break;
//       case 'AuthVerify':
//         if (code && email) {
//           verifyEmailAddress({ variables: { code, email } })
//             .then(() => {
//               showAlert?.('Email verified successfully. You can now log in.');
//               setActiveScreen('login');
//             })
//             .catch(err => {
//               const msg = err.message || 'Verification failed';
//               showAlert?.(msg);
//             });
//         }
//         break;
        
//       default:
//         setActiveScreen('login');
//     }
//   }, [route.name, route.params]);

//   const renderScreen = () => {
//     switch (activeScreen) {
//       case 'login':
//         return <LoginForm switchTo={setActiveScreen} />;
//       case 'register':
//         return <RegisterForm switchTo={setActiveScreen} />;
//       case 'forgot':
//         return <ForgotPassword switchTo={setActiveScreen} />;
//       case 'reset':
//         return <ResetPassword switchTo={setActiveScreen} route={route} />;
//         case 'mfa':
//       return <MfaVerify switchTo={setActiveScreen} />;
//       default:
//         return <LoginForm switchTo={setActiveScreen} />;
//     }
//   };

//   return (
//     <>
//       {/* Top inset only: black */}
//       <SafeAreaView edges={['top']} style={styles.topInset}>
//         <StatusBar barStyle="light-content" backgroundColor="black" />
//       </SafeAreaView>

//       {/* Rest of the screen: no black background */}
//       <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
//         <Image
//           source={require('../assets/Authorization-Background.png')}
//           style={styles.bg}
//         />
//         <KeyboardAvoidingView
//           style={styles.flex}
//           behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//           keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
//         >
//           <ScrollView
//             contentContainerStyle={styles.scrollContainer}
//             keyboardShouldPersistTaps="handled"
//           >
//             <Text style={styles.title}>Safety Cam AI</Text>
//             <View style={styles.formWrapper}>{renderScreen()}</View>
//           </ScrollView>
//         </KeyboardAvoidingView>
//       </SafeAreaView>
//     </>
//   );
// }

// const styles = StyleSheet.create({
//   topInset: { flex: 0, backgroundColor: 'black' }, // only the notch/status area
//   container: { flex: 1 },                          // no background color here
//   flex: { flex: 1 },
//   scrollContainer: {
//     flexGrow: 1,
//     justifyContent: 'center',
//     padding: 20,
//     paddingBottom: 40,
//   },
//   title: {
//     fontSize: 26,
//     color: '#007bff',
//     fontWeight: '600',
//     textAlign: 'center',
//     marginBottom: 24,
//   },
//   formWrapper: { width: '100%', maxWidth: 400, alignSelf: 'center' },
//   bg: {
//     position: 'absolute',
//     width: '100%',
//     height: '100%',
//     resizeMode: 'cover',
//   },
// });








// import React, { useEffect, useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   Image,
//   KeyboardAvoidingView,
//   ScrollView,
//   Platform,
  
// } from 'react-native';
// import { useMutation } from '@apollo/client';
// import { useRoute } from '@react-navigation/native';
// import { SafeAreaView } from 'react-native-safe-area-context';


// import RegisterForm from '../authentication/RegisterForm';
// import ForgotPassword from '../authentication/ForgotPassword';
// import ResetPassword from '../authentication/ResetPassword';
// import LoginForm from '../authentication/LoginForm';
// import { VERIFY_EMAIL_ADDRESS_MUTATION } from '../graphql/mutations';
// import { useAlert } from '../context/AlertContext';

// export default function AuthScreen() {
//   const [activeScreen, setActiveScreen] = useState('login');
//   const route = useRoute();
//   const { showAlert } = useAlert?.() || {};
//   const [verifyEmailAddress] = useMutation(VERIFY_EMAIL_ADDRESS_MUTATION);

//   useEffect(() => {
//     const params = route.params || {};
//     const { code, email } = params;

//     switch (route.name) {
//       case 'AuthLogin':
//         setActiveScreen('login');
//         break;
//       case 'AuthRegister':
//         setActiveScreen('register');
//         break;
//       case 'AuthReset':
//         setActiveScreen('reset');
//         break;
//       case 'AuthVerify':
//         if (code && email) {
//           verifyEmailAddress({ variables: { code, email } })
//             .then(() => {
//               showAlert?.('Email verified successfully. You can now log in.');
//               setActiveScreen('login');
//             })
//             .catch(err => {
//               const msg = err.message || 'Verification failed';
//               showAlert?.(msg);
//             });
//         }
//         break;
//       default:
//         setActiveScreen('login');
//     }
//   }, [route.name, route.params]);

//   const renderScreen = () => {
//     switch (activeScreen) {
//       case 'login':
//         return <LoginForm switchTo={setActiveScreen} />;
//       case 'register':
//         return <RegisterForm switchTo={setActiveScreen} />;
//       case 'forgot':
//         return <ForgotPassword switchTo={setActiveScreen} />;
//       case 'reset':
//         return <ResetPassword switchTo={setActiveScreen} route={route} />;
//       default:
//         return <LoginForm switchTo={setActiveScreen} />;
//     }
//   };

//   return (
//     <SafeAreaView style={styles.container}>
//       <Image
//         source={require('../assets/Authorization-Background.png')}
//         style={styles.bg}
//       />
//       <KeyboardAvoidingView
//         style={styles.flex}
//         behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
//         keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
//       >
//         <ScrollView
//           contentContainerStyle={styles.scrollContainer}
//           keyboardShouldPersistTaps="handled"
//         >
//           <Text style={styles.title}>Safety Cam AI</Text>
//           <View style={styles.formWrapper}>{renderScreen()}</View>
//         </ScrollView>
//       </KeyboardAvoidingView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1,backgroundColor:"black" },
//   flex: {
//     flex: 1,
//   },
//   scrollContainer: {
//     flexGrow: 1,
//     justifyContent: 'center',
//     padding: 20,
//     paddingBottom: 40,
//   },
//   title: {
//     fontSize: 26,
//     color: '#007bff',
//     fontWeight: '600',
//     textAlign: 'center',
//     marginBottom: 24,
//   },
//   formWrapper: {
//     width: '100%',
//     maxWidth: 400,
//     alignSelf: 'center',
//   },
//   bg: {
//     position: 'absolute',
//     width: '100%',
//     height: '100%',
//     resizeMode: 'cover',
//   },
// });




