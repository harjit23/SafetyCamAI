// src/authentication/LoginForm.js
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';
import { jwtDecode } from 'jwt-decode';
import { useMutation } from '@apollo/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/FontAwesome';

import { useAuth } from '../context/AuthContext';
import { useLoader } from '../context/LoaderContext';
import { LOGIN_MUTATION } from '../graphql/mutations';
import { API_BASE_URL } from '../config';

export default function LoginForm({ switchTo }) {
  const { showLoader, hideLoader } = useLoader();
  const navigation = useNavigation();
  const { setUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [login, { loading: loginLoading }] = useMutation(LOGIN_MUTATION);

  // --- validation helpers ---
  const isEmailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email],
  );

  const isStrongPassword = useMemo(() => {
    const s = password || '';
    const longEnough = s.length >= 8;
    const hasUpper = /[A-Z]/.test(s);
    const hasLower = /[a-z]/.test(s);
    const hasNumber = /\d/.test(s);
    const hasSymbol = /[@$!%*?&#_\/\-]/.test(s);
    return longEnough && hasUpper && hasLower && hasNumber && hasSymbol;
  }, [password]);

  const canSubmit = isEmailValid && isStrongPassword;

  const handleLogin = async () => {
    setSubmitted(true);
    if (!canSubmit) {
      Toast.show({
        type: 'error',
        text1: 'Fix the highlighted fields',
        text2: !isEmailValid
          ? 'Enter a valid email address.'
          : 'Please use a stronger password.',
      });
      return;
    }

    try {
      showLoader('Logging in...');

      // Clear any stale tokens before new login attempt to prevent 500 errors
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'mfaToken']);

      const { data: loginData } = await login({ variables: { email, password } });
      const loginRes = loginData?.login;

      console.log('🔐 Full Login Response:', JSON.stringify(loginRes, null, 2));

      if (!loginRes?.token) {
        hideLoader();
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: 'Invalid credentials.',
        });
        return;
      }

      if (!loginRes.isEmailVerified) {
        Toast.show({
          type: 'error',
          text1: 'Email Not Verified',
          text2: 'Please verify your email before logging in.',
        });
        return;
      }

      const { token, refreshToken } = loginRes.token || {};

      console.log('🎫 RAW LOGIN ACCESS TOKEN:', token);
      try {
        const decoded = jwtDecode(token);
        console.log('🔑 FULL DECODED LOGIN TOKEN:', JSON.stringify(decoded, null, 2));
      } catch (e) {
        console.error('❌ Failed to decode login token:', e);
      }

      if (!token || !refreshToken) {
        hideLoader();
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: 'Invalid token payload.',
        });
        return;
      }

      await AsyncStorage.setItem('accessToken', token);
      await AsyncStorage.setItem('refreshToken', refreshToken);

      // decode user id
      try {
        const decoded = jwtDecode(token);
        const userId = decoded?.id || decoded?.userId || decoded?.sub || null;
        if (userId) {
          await AsyncStorage.setItem('currentUserId', String(userId));
        }
      } catch (_) { }

      Toast.show({
        type: 'success',
        text1: 'Login Successful',
        text2: 'Welcome back!',
      });

      console.log('🔐 Setting user in context:', loginRes);
      setUser(loginRes);

      // Check if we should redirect to subscription screen
      const redirectToSubscription = await AsyncStorage.getItem('redirectToSubscription');

      // Check for active plan using the fresh token
      let hasActivePlan = false;
      try {
        const decoded = jwtDecode(token);
        if (decoded.paymentPlan && decoded.paymentExpiryDate) {
          const expiry = new Date(decoded.paymentExpiryDate);
          const now = new Date();
          // Check if plan exists and is not expired
          if (!isNaN(expiry.getTime()) && expiry > now) {
            hasActivePlan = true;
            console.log('✅ User has active plan, overriding redirect to Subscription');
          }
        }
      } catch (e) {
        console.log('Failed to check plan status from token:', e);
      }

      if (redirectToSubscription === 'true' && !hasActivePlan) {
        await AsyncStorage.removeItem('redirectToSubscription');
        navigation.navigate('Subscription');
      } else {
        // If we were supposed to redirect but have a plan, clear the flag anyway
        if (redirectToSubscription === 'true') {
          await AsyncStorage.removeItem('redirectToSubscription');
        }
        navigation.navigate('Home');
      }
    } catch (err) {
      // 🔐 MFA handling (mirror Vue)
      console.log('[Login] Error caught:', err);
      console.log('[Login] GraphQL Errors:', err?.graphQLErrors);
      const msg = err?.graphQLErrors?.[0]?.message || err?.message || '';
      console.log('[Login] Error message:', msg);

      // Strict check for MFA_REQUIRED to avoid parsing random network errors as tokens
      if (msg && msg.includes('MFA_REQUIRED')) {
        console.log('[Login] MFA_REQUIRED detected in message');
        const graphErrs = msg.split(':') || [];
        const reason = (graphErrs[0] || '').trim();           // e.g. "MFA_REQUIRED"
        const tokenFromError = (graphErrs[1] || '').trim();   // the long JWT

        console.log('[Login] Reason:', reason);
        console.log('[Login] Token from error:', tokenFromError);

        if (reason === 'MFA_REQUIRED' && tokenFromError) {
          // Vue: auth.setItem(graphErrs[1], constants.mfaToken)
          // RN: key = 'mfaToken', value = token
          await AsyncStorage.setItem('mfaToken', tokenFromError);
          console.log('[Login] stored mfaToken:', tokenFromError);

          // show MFA component in AuthScreen
          switchTo && switchTo('mfa');
          hideLoader();
          return;
        } else {
          console.log('[Login] MFA_REQUIRED found but validation failed');
        }
      } else {
        console.log('[Login] MFA_REQUIRED not found in error message');
      }

      const backendMessage =
        err?.graphQLErrors?.[0]?.message ||
        err?.networkError?.result?.errors?.[0]?.message ||
        err?.message ||
        'Login failed.';
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: backendMessage,
      });
    } finally {
      hideLoader();
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      // Store the provider so we know who to exchange with when we return
      await AsyncStorage.setItem('pendingProvider', provider);

      const redirectUri = 'safetycamai://auth/login';
      const authUrl = `${API_BASE_URL}/auth/${provider}?client=mobile&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}`;

      if (await InAppBrowser.isAvailable()) {
        const result = await InAppBrowser.openAuth(authUrl, redirectUri, {
          // iOS Properties
          dismissButtonStyle: 'cancel',
          preferredBarTintColor: '#453AA4',
          preferredControlTintColor: 'white',
          readerMode: false,
          animated: true,
          modalPresentationStyle: 'fullScreen',
          modalTransitionStyle: 'coverVertical',
          modalEnabled: true,
          enableBarCollapsing: false,
          // Android Properties
          showTitle: true,
          toolbarColor: '#6200EE',
          secondaryToolbarColor: 'black',
          navigationBarColor: 'black',
          navigationBarDividerColor: 'white',
          enableUrlBarHiding: true,
          enableDefaultShare: false,
          forceCloseOnRedirection: false,
        });

        if (result.type === 'success' && result.url) {
          // Manually trigger the deep link handling since openAuth might swallow the system Linking event
          const deepLinkUrl = result.url;
          // Extract code to set params if needed, or allow AuthScreen to handle it via Listener if applicable
          // But since we are here, we can force the navigation params update which AuthScreen watches
          const codeMatch = deepLinkUrl.match(/[?&]code=([^&]+)/);
          const code = codeMatch ? codeMatch[1] : null;

          if (code) {
            console.log('[LoginForm] InAppBrowser Success, code found:', code);
            // Verify if we need to manually navigate or if AuthScreen picks it up.
            // Since AuthScreen listens to [route.params], let's update params.
            navigation.setParams({ code, provider });
          } else {
            console.log('[LoginForm] InAppBrowser Success, but no code found in url:', deepLinkUrl);
          }
        }
      } else {
        await Linking.openURL(authUrl);
      }
    } catch (error) {
      console.error('Error initiating social login:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to open social login',
      });
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.heading}>Login</Text>

      <Text style={styles.label}>Email *</Text>
      <TextInput
        style={[styles.input, submitted && !isEmailValid && styles.inputError]}
        placeholder="Enter your email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      {submitted && !isEmailValid && (
        <Text style={styles.errorText}>Please enter a valid email address.</Text>
      )}

      <Text style={styles.label}>Password *</Text>
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Enter your password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          autoComplete="password"
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Icon
            name={showPassword ? 'eye' : 'eye-slash'}
            size={20}
            color="#666"
            style={styles.icon}
          />
        </TouchableOpacity>
      </View>

      {(passwordFocused || submitted) && !isStrongPassword && (
        <Text style={styles.passwordError}>
          Enter a Strong Password (Min. 8 characters) which contains at least one
          uppercase & lowercase alphabet, numeric and symbols (@$!%*?&#)
        </Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => switchTo('forgot')}>
          <Text style={styles.link}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.loginButton,
            !canSubmit && styles.loginButtonDisabled,
          ]}
          onPress={handleLogin}
          disabled={!canSubmit}
        >
          <Text style={styles.loginText}>Login</Text>
          <Image
            source={require('../assets/Forward-Icon.png')}
            style={styles.iconImage}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.socialButtonsContainer}>
        <TouchableOpacity
          style={[styles.socialButton, styles.googleButton]}
          onPress={() => handleSocialLogin('google')}
        >
          <Icon name="google" size={20} color="#DB4437" style={styles.socialIcon} />
          <Text style={styles.socialButtonText}>Login with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.socialButton, styles.appleButton]}
          onPress={() => handleSocialLogin('apple')}
        >
          <Icon name="apple" size={20} color="#000000" style={styles.socialIcon} />
          <Text style={styles.socialButtonText}>Login with Apple</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.registerText}>
        <Text style={{ color: '#000' }}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => switchTo('register')}>
          <Text style={styles.link}>Register</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 20, paddingHorizontal: 10 }}>
        <Text style={{ color: '#444', fontSize: 12, textAlign: 'center' }}>
          Note: To enable Two-Factor Authentication (2FA), please sign in to the
          SafetyCam AI Web Panel at{' '}
          <Text
            style={{ color: '#0C66E4', textDecorationLine: 'underline' }}
            onPress={() => Linking.openURL('https://app.safetycamai.com/')}
          >
            app.safetycamai.com
          </Text>.
        </Text>
      </View>
    </View>

  );
}

const styles = StyleSheet.create({
  form: {
    borderRadius: 10,
    padding: 20,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 360,
  },
  heading: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000',
  },
  label: {
    fontWeight: '500',
    marginTop: 10,
    color: '#000',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginTop: 4,
    color: '#000',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    paddingRight: 8,
    marginTop: 4,
  },
  passwordInput: {
    flex: 1,
    padding: 10,
    color: '#000',
  },
  icon: {
    paddingHorizontal: 8,
  },
  iconImage: {
    width: 20,
    height: 20,
  },
  passwordError: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  loginButton: {
    backgroundColor: '#0C66E4',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginText: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 6,
  },
  registerText: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  link: {
    color: '#0C66E4',
    fontWeight: '500',
  },
  socialButtonsContainer: {
    marginTop: 20,
    gap: 10,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  googleButton: {
    borderColor: '#ddd',
  },
  appleButton: {
    borderColor: '#ddd',
  },
  socialIcon: {
    marginRight: 10,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
});




// import { useLoader } from '../context/LoaderContext';
// import React, { useMemo, useState } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   StyleSheet,
//   TouchableOpacity,
//   Image,
// } from 'react-native';
// import  jwtDecode  from 'jwt-decode';

// import { useMutation } from '@apollo/client';
// import { LOGIN_MUTATION } from '../graphql/mutations';
// import { useAuth } from '../context/AuthContext';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { useNavigation } from '@react-navigation/native';
// import Toast from 'react-native-toast-message';
// import Icon from 'react-native-vector-icons/FontAwesome';

// export default function LoginForm({ switchTo }) {
//   const { showLoader, hideLoader } = useLoader();
//   const navigation = useNavigation();
//   const { setUser } = useAuth();

//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [showPassword, setShowPassword] = useState(false);
//   const [passwordFocused, setPasswordFocused] = useState(false);
//   const [submitted, setSubmitted] = useState(false);

//   const [login] = useMutation(LOGIN_MUTATION);

//   // --- validation helpers ---
//   const isEmailValid = useMemo(
//     () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
//     [email]
//   );

//   // one combined rule (matches your screenshot copy)
//   const isStrongPassword = useMemo(() => {
//     const s = password || '';
//     const longEnough = s.length >= 8;
//     const hasUpper = /[A-Z]/.test(s);
//     const hasLower = /[a-z]/.test(s);
//     const hasNumber = /\d/.test(s);
//     const hasSymbol = /[@$!%*?&#_\/\-]/.test(s);
//     return longEnough && hasUpper && hasLower && hasNumber && hasSymbol;
//   }, [password]);

//   const canSubmit = isEmailValid && isStrongPassword;

//   // const handleLogin = async () => {
//   //   setSubmitted(true);
//   //   if (!canSubmit) {
//   //     Toast.show({
//   //       type: 'error',
//   //       text1: 'Fix the highlighted fields',
//   //       text2: !isEmailValid
//   //         ? 'Enter a valid email address.'
//   //         : 'Please use a stronger password.',
//   //     });
//   //     return;
//   //   }

//   //   try {
//   //     showLoader('Logging in...');
//   //     const { data } = await login({ variables: { email, password } });
//   //     const loginRes = data?.login;

//   //     if (!loginRes) {
//   //       Toast.show({
//   //         type: 'error',
//   //         text1: 'Login Failed',
//   //         text2: 'No user data returned from server.',
//   //       });
//   //       return;
//   //     }

//   //     if (!loginRes.isEmailVerified) {
//   //       Toast.show({
//   //         type: 'error',
//   //         text1: 'Email Not Verified',
//   //         text2: 'Please verify your email before logging in.',
//   //       });
//   //       return;
//   //     }

//   //     const { token, refreshToken } = loginRes.token || {};
//   //     if (!token || !refreshToken) {
//   //       Toast.show({
//   //         type: 'error',
//   //         text1: 'Login Failed',
//   //         text2: 'Invalid token payload.',
//   //       });
//   //       return;
//   //     }

//   //     await AsyncStorage.setItem('accessToken', token);
//   //     await AsyncStorage.setItem('refreshToken', refreshToken);

//   //     // decode user id (same as you used in HistoryScreen)
//   //     let userId = null;
//   //     try {
//   //       const decoded = jwtDecode(token);
//   //       userId = decoded?.id || decoded?.userId || decoded?.sub || null;
//   //     } catch (_) {}

//   //     if (!userId) {
//   //       Toast.show({
//   //         type: 'error',
//   //         text1: 'Login Failed',
//   //         text2: 'Could not determine user id from token.',
//   //       });
//   //       return;
//   //     }
//   //     await AsyncStorage.setItem('currentUserId', String(userId));

//   //     Toast.show({
//   //       type: 'success',
//   //       text1: 'Login Successful',
//   //       text2: 'Welcome back!',
//   //     });

//   //     setUser(loginRes);
//   //     navigation.navigate('Home');
//   //   } catch (err) {
//   //     const backendMessage =
//   //       err?.graphQLErrors?.[0]?.message ||
//   //       err?.networkError?.result?.errors?.[0]?.message ||
//   //       err?.message ||
//   //       'Login failed.';
//   //     Toast.show({ type: 'error', text1: 'Login Failed', text2: backendMessage });
//   //   } finally {
//   //     hideLoader();
//   //   }
//   // };
// // src/authentication/LoginForm.js  (only replace handleLogin)
// const handleLogin = async () => {
//   setSubmitted(true);
//   if (!canSubmit) {
//     Toast.show({
//       type: 'error',
//       text1: 'Fix the highlighted fields',
//       text2: !isEmailValid
//         ? 'Enter a valid email address.'
//         : 'Please use a stronger password.',
//     });
//     return;
//   }

//   try {
//     showLoader('Logging in...');
//     const { data } = await login({ variables: { email, password } });
//     const loginRes = data?.login;

//     // Normal login: server returned tokens
//     if (loginRes?.token?.token && loginRes?.token?.refreshToken) {
//       await AsyncStorage.setItem('accessToken', loginRes.token.token);
//       await AsyncStorage.setItem('refreshToken', loginRes.token.refreshToken);

//       // decode + store currentUserId if available in token
//       try {
//         const decoded = jwtDecode(loginRes.token.token);
//         const userId = decoded?.id || decoded?.userId || decoded?.sub || null;
//         if (userId) await AsyncStorage.setItem('currentUserId', String(userId));
//       } catch (_) {}

//       Toast.show({ type: 'success', text1: 'Login Successful', text2: 'Welcome back!' });
//       setUser(loginRes);
//       navigation.navigate('Home');
//       return;
//     }

//     // Fallback when loginRes returned but did not contain tokens
//     Toast.show({ type: 'error', text1: 'Login Failed', text2: 'Invalid server response.' });
//   } catch (err) {
//     // The backend signals MFA via an error message: "MFA_REQUIRED : <token>"
//     // in LoginForm catch block
//   const gqlMsg = err?.graphQLErrors?.[0]?.message || err?.message || '';

//   if (typeof gqlMsg === 'string' && gqlMsg.startsWith('MFA_REQUIRED')) {
//     // extract token after the colon
//     const parts = gqlMsg.split(':');
//     const mfaToken = parts.slice(1).join(':').trim();
//     if (mfaToken) {
//       await AsyncStorage.setItem('mfaToken', mfaToken);
//       // show the MFA UI inside AuthScreen (you use switchTo currently)
//       switchTo && switchTo('mfa');
//       hideLoader();
//       return;
//     }
//   }



//     const backendMessage =
//       err?.graphQLErrors?.[0]?.message ||
//       err?.networkError?.result?.errors?.[0]?.message ||
//       err?.message ||
//       'Login failed.';
//     Toast.show({ type: 'error', text1: 'Login Failed', text2: backendMessage });
//   } finally {
//     hideLoader();
//   }
// };

//   return (
//     <View style={styles.form}>
//       <Text style={styles.heading}>Login</Text>

//       <Text style={styles.label}>Email *</Text>
//       <TextInput
//         style={[styles.input, submitted && !isEmailValid && styles.inputError]}
//         placeholder="Enter your email"
//         placeholderTextColor="#888"
//         value={email}
//         onChangeText={setEmail}
//         keyboardType="email-address"
//         autoCapitalize="none"
//         autoComplete="email"
//       />
//       {submitted && !isEmailValid && (
//         <Text style={styles.errorText}>Please enter a valid email address.</Text>
//       )}

//       <Text style={styles.label}>Password *</Text>
//       <View style={styles.passwordContainer}>
//         <TextInput
//           style={styles.passwordInput}
//           placeholder="Enter your password"
//           placeholderTextColor="#888"
//           value={password}
//           onChangeText={setPassword}
//           secureTextEntry={!showPassword}
//           onFocus={() => setPasswordFocused(true)}
//           onBlur={() => setPasswordFocused(false)}
//           autoComplete="password"
//         />
//         <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
//           <Icon
//             name={showPassword ? 'eye' : 'eye-slash'}
//             size={20}
//             color="#666"
//             style={styles.icon}
//           />
//         </TouchableOpacity>
//       </View>

//       {/* Single red helper text like your screenshot */}
//       {(passwordFocused || submitted) && !isStrongPassword && (
//         <Text style={styles.passwordError}>
//           Enter a Strong Password (Min. 8 characters) which contains at least one
//           uppercase & lowercase alphabet, numeric and symbols (@$!%*?&#)
//         </Text>
//       )}

//       <View style={styles.actions}>
//         <TouchableOpacity onPress={() => switchTo('forgot')}>
//           <Text style={styles.link}>Forgot password?</Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={[styles.loginButton, !canSubmit && styles.loginButtonDisabled]}
//           onPress={handleLogin}
//           disabled={!canSubmit}
//         >
//           <Text style={styles.loginText}>Login</Text>
//           <Image
//             source={require('../assets/Forward-Icon.png')}
//             style={styles.iconImage}
//           />
//         </TouchableOpacity>
//       </View>

//       <View style={styles.registerText}>
//         <Text style={{ color: '#000' }}>Don't have an account? </Text>
//         <TouchableOpacity onPress={() => switchTo('register')}>
//           <Text style={styles.link}>Register</Text>
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   form: {
//     borderRadius: 10,
//     padding: 20,
//     alignSelf: 'center',
//     width: '100%',
//     maxWidth: 360,
//   },
//   heading: {
//     fontSize: 22,
//     fontWeight: '600',
//     marginBottom: 16,
//     color: '#000',
//   },
//   label: {
//     fontWeight: '500',
//     marginTop: 10,
//     color: '#000',
//   },
//   input: {
//     borderWidth: 1,
//     borderColor: '#ccc',
//     borderRadius: 6,
//     padding: 10,
//     marginTop: 4,
//     color: '#000',
//     backgroundColor: '#fff',
//   },
//   inputError: {
//     borderColor: '#dc2626',
//   },
//   errorText: {
//     marginTop: 6,
//     fontSize: 12,
//     color: '#dc2626',
//   },
//   passwordContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#fff',
//     borderColor: '#ccc',
//     borderWidth: 1,
//     borderRadius: 6,
//     paddingRight: 8,
//     marginTop: 4,
//   },
//   passwordInput: {
//     flex: 1,
//     padding: 10,
//     color: '#000',
//   },
//   icon: {
//     paddingHorizontal: 8,
//   },
//   iconImage: {
//     width: 20,
//     height: 20,
//   },
//   // single red helper line (screenshot style)
//   passwordError: {
//     marginTop: 6,
//     fontSize: 12,
//     color: '#dc2626',
//     lineHeight: 18,
//   },
//   actions: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginTop: 16,
//   },
//   loginButton: {
//     backgroundColor: '#0C66E4',
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     borderRadius: 6,
//   },
//   loginButtonDisabled: {
//     opacity: 0.6,
//   },
//   loginText: {
//     color: '#fff',
//     fontWeight: '600',
//     marginRight: 6,
//   },
//   registerText: {
//     marginTop: 24,
//     flexDirection: 'row',
//     justifyContent: 'center',
//   },
//   link: {
//     color: '#0C66E4',
//     fontWeight: '500',
//   },
// });








