import { useLoader } from '../context/LoaderContext';
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { jwtDecode } from 'jwt-decode';

import { useMutation } from '@apollo/client';
import { LOGIN_MUTATION } from '../graphql/mutations';
import { useAuth } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/FontAwesome';

export default function LoginForm({ switchTo }) {
  const { showLoader, hideLoader } = useLoader();
  const navigation = useNavigation();
  const { setUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [login] = useMutation(LOGIN_MUTATION);

  // --- validation helpers ---
  const isEmailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );

  // one combined rule (matches your screenshot copy)
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
      const { data } = await login({ variables: { email, password } });
      const loginRes = data?.login;

      if (!loginRes) {
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: 'No user data returned from server.',
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
      if (!token || !refreshToken) {
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: 'Invalid token payload.',
        });
        return;
      }

      await AsyncStorage.setItem('accessToken', token);
      await AsyncStorage.setItem('refreshToken', refreshToken);

      // decode user id (same as you used in HistoryScreen)
      let userId = null;
      try {
        const decoded = jwtDecode(token);
        userId = decoded?.id || decoded?.userId || decoded?.sub || null;
      } catch (_) {}

      if (!userId) {
        Toast.show({
          type: 'error',
          text1: 'Login Failed',
          text2: 'Could not determine user id from token.',
        });
        return;
      }
      await AsyncStorage.setItem('currentUserId', String(userId));

      Toast.show({
        type: 'success',
        text1: 'Login Successful',
        text2: 'Welcome back!',
      });

      setUser(loginRes);
      navigation.navigate('Home');
    } catch (err) {
      const backendMessage =
        err?.graphQLErrors?.[0]?.message ||
        err?.networkError?.result?.errors?.[0]?.message ||
        err?.message ||
        'Login failed.';
      Toast.show({ type: 'error', text1: 'Login Failed', text2: backendMessage });
    } finally {
      hideLoader();
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

      {/* Single red helper text like your screenshot */}
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
          style={[styles.loginButton, !canSubmit && styles.loginButtonDisabled]}
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

      <View style={styles.registerText}>
        <Text style={{ color: '#000' }}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => switchTo('register')}>
          <Text style={styles.link}>Register</Text>
        </TouchableOpacity>
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
  // single red helper line (screenshot style)
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
});









// import { useLoader } from '../context/LoaderContext';
// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   StyleSheet,
//   TouchableOpacity,
//   Image,
// } from 'react-native';
// import { jwtDecode } from 'jwt-decode';

// import { useMutation } from '@apollo/client';
// import { LOGIN_MUTATION } from '../graphql/mutations'; // keep your mutation where you already have it
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

//   const [login] = useMutation(LOGIN_MUTATION);

//   const handleLogin = async () => {
//     try {
//       showLoader('Logging in...');

//       // 1) Login
//       const { data } = await login({ variables: { email, password } });
//       const loginRes = data?.login;

//       if (!loginRes) {
//         Toast.show({ type: 'error', text1: 'Login Failed', text2: 'No user data returned from server.' });
//         return;
//       }

//       if (!loginRes.isEmailVerified) {
//         Toast.show({
//           type: 'error',
//           text1: 'Email Not Verified',
//           text2: 'Please verify your email before logging in.',
//         });
//         return;
//       }

//       // 2) Store tokens
//       const { token, refreshToken } = loginRes.token || {};
//       if (!token || !refreshToken) {
//         Toast.show({ type: 'error', text1: 'Login Failed', text2: 'Invalid token payload.' });
//         return;
//       }
//       await AsyncStorage.setItem('accessToken', token);
//       await AsyncStorage.setItem('refreshToken', refreshToken);

//       // 3) Decode JWT to get userId (use SAME claim as in HistoryScreen)
//       let userId = null;
//       try {
//         const decoded = jwtDecode(token);
//         userId = decoded?.id || decoded?.userId || decoded?.sub || null;
//       } catch (_) {}

//       if (!userId) {
//         Toast.show({ type: 'error', text1: 'Login Failed', text2: 'Could not determine user id from token.' });
//         return;
//       }

//       // 4) Persist userId for later (HomeScreen will fetch the API key when needed)
//       await AsyncStorage.setItem('currentUserId', String(userId));

//       Toast.show({ type: 'success', text1: 'Login Successful', text2: 'Welcome back!' });

//       // 5) Update auth context and navigate
//       setUser(loginRes);
//       navigation.navigate('Home');
//     } catch (err) {
//       const backendMessage =
//         err?.graphQLErrors?.[0]?.message ||
//         err?.networkError?.result?.errors?.[0]?.message ||
//         err?.message ||
//         'Login failed.';
//       Toast.show({ type: 'error', text1: 'Login Failed', text2: backendMessage });
//     } finally {
//       hideLoader();
//     }
//   };

//   return (
//     <View style={styles.form}>
//       <Text style={styles.heading}>Login</Text>

//       <Text style={styles.label}>Email *</Text>
//       <TextInput
//         style={styles.input}
//         placeholder="Enter your email"
//         placeholderTextColor="#888"
//         value={email}
//         onChangeText={setEmail}
//         keyboardType="email-address"
//         autoCapitalize="none"
//       />

//       <Text style={styles.label}>Password *</Text>
//       <View style={styles.passwordContainer}>
//         <TextInput
//           style={styles.passwordInput}
//           placeholder="Enter your password"
//           placeholderTextColor="#888"
//           value={password}
//           onChangeText={setPassword}
//           secureTextEntry={!showPassword}
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

//       <View style={styles.actions}>
//         <TouchableOpacity onPress={() => switchTo('forgot')}>
//           <Text style={styles.link}>Forgot password?</Text>
//         </TouchableOpacity>

//         <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
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








// import { useLoader } from '../context/LoaderContext';
// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   StyleSheet,
//   TouchableOpacity,
//   Image,
// } from 'react-native';
// import { useMutation, useLazyQuery } from '@apollo/client';
// import { LOGIN_MUTATION, GET_API_KEY } from '../graphql/mutations';
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

//   const [login] = useMutation(LOGIN_MUTATION);
//   const [getApiKey] = useLazyQuery(GET_API_KEY);

//   const handleLogin = async () => {
//     try {
//       showLoader('Logging in...');
//       const { data } = await login({ variables: { email, password } });
//       const user = data?.login;
//       hideLoader();

//       if (!user) {
//         Toast.show({
//           type: 'error',
//           text1: 'Login Failed',
//           text2: 'No user data returned from server.',
//         });
//         return;
//       }

//       if (!user.isEmailVerified) {
//         Toast.show({
//           type: 'error',
//           text1: 'Email Not Verified',
//           text2: 'Please verify your email before logging in.',
//         });
//         return;
//       }

//       const { token, refreshToken } = user.token;
//       await AsyncStorage.setItem('accessToken', token);
//       await AsyncStorage.setItem('refreshToken', refreshToken);

//       const apiKeyRes = await getApiKey();
//       const apiKey = apiKeyRes?.data?.apiKeys?.items?.[0]?.secret || null;

//       if (!apiKey) {
//         Toast.show({
//           type: 'error',
//           text1: 'API Key Error',
//           text2: 'Unable to fetch API key.',
//         });
//         return;
//       }

//       await AsyncStorage.setItem('apiKey', apiKey);

//       Toast.show({
//         type: 'success',
//         text1: 'Login Successful',
//         text2: 'Welcome back!',
//       });

//       setUser(user);
//       navigation.navigate('Home');
//     } catch (err) {
//       hideLoader();
//       const backendMessage =
//         err?.graphQLErrors?.[0]?.message ||
//         err?.networkError?.result?.errors?.[0]?.message ||
//         err?.message ||
//         'Login failed.';

//       Toast.show({
//         type: 'error',
//         text1: 'Login Failed',
//         text2: backendMessage,
//       });
//     }
//   };

//   return (
//     <View style={styles.form}>
//       <Text style={styles.heading}>Login</Text>

//       <Text style={styles.label}>Email *</Text>
//       <TextInput
//         style={styles.input}
//         placeholder="Enter your email"
//         placeholderTextColor="#888"
//         value={email}
//         onChangeText={setEmail}
//         keyboardType="email-address"
//         autoCapitalize="none"
//       />

//       <Text style={styles.label}>Password *</Text>
//       <View style={styles.passwordContainer}>
//         <TextInput
//           style={styles.passwordInput}
//           placeholder="Enter your password"
//           placeholderTextColor="#888"
//           value={password}
//           onChangeText={setPassword}
//           secureTextEntry={!showPassword}
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

//       <View style={styles.actions}>
//         <TouchableOpacity onPress={() => switchTo('forgot')}>
//           <Text style={styles.link}>Forgot password?</Text>
//         </TouchableOpacity>

//         <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
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
