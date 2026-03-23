import React, { useRef, useState, useCallback } from 'react';

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { useMutation } from '@apollo/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { useLoader } from '../context/LoaderContext';
import { VALIDATE_OTP } from '../graphql/mutations';

export default function MfaVerify({ switchTo }) {
  const navigation = useNavigation();
  const { setUser } = useAuth();
  const { showLoader, hideLoader } = useLoader();

  const [values, setValues] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);
  const [validateOtp] = useMutation(VALIDATE_OTP);

  const [activeIndex, setActiveIndex] = useState(null);

  const [showPaste, setShowPaste] = useState(false);
  const [pastePosition, setPastePosition] = useState({ x: 0, y: 0 });




  // ---------------------------
  // OTP INPUT HANDLER
  // ---------------------------
  const handleOtpInput = (text, idx) => {
    const cleaned = text.replace(/[^0-9]/g, '');

    // Full OTP pasted
    if (cleaned.length === 6) {
      const digits = cleaned.split('');
      setValues(digits);
      inputRefs.current[5]?.focus();
      return;
    }

    // Normal typing (single digit)
    if (cleaned.length === 1) {
      const newArr = [...values];
      newArr[idx] = cleaned;
      setValues(newArr);

      if (idx < 5) inputRefs.current[idx + 1]?.focus();
    }
  };

  // ---------------------------
  // BACKSPACE HANDLER
  // ---------------------------
  const onKeyPress = (e, idx) => {
    if (e.nativeEvent.key !== 'Backspace') return;

    const newArr = [...values];

    // Delete current digit if it exists
    if (newArr[idx]) {
      newArr[idx] = '';
      setValues(newArr);
      return;
    }

    // If current empty, go back and delete previous
    if (idx > 0) {
      newArr[idx - 1] = '';
      setValues(newArr);
      inputRefs.current[idx - 1]?.focus();
    }
  };

  // ---------------------------
  // SUBMIT OTP
  // ---------------------------
  const handleSubmit = useCallback(async () => {
    const otp = values.join('');

    if (otp.length !== 6) {
      Toast.show({
        type: 'error',
        text1: 'Invalid OTP',
        text2: 'Enter all 6 digits.',
      });
      return;
    }

    const debugToken = await AsyncStorage.getItem('mfaToken');
    console.log('[MFA] mfaToken before validateOtp:', debugToken);

    showLoader('Verifying code...');
    try {
      console.log('[MFA] Validating OTP:', otp);
      const { data } = await validateOtp({ variables: { otp } });
      const user = data?.validateOtp;

      console.log('[MFA] validateOtp response data:', JSON.stringify(data, null, 2));

      if (!user) {
        Toast.show({ type: 'error', text1: 'Verification failed' });
        return;
      }

      const tokenObj = user.token || {};
      if (tokenObj.token && tokenObj.refreshToken) {
        await AsyncStorage.setItem('accessToken', tokenObj.token);
        await AsyncStorage.setItem('refreshToken', tokenObj.refreshToken);
      }

      await AsyncStorage.removeItem('mfaToken');

      setUser(user);
      Toast.show({
        type: 'success',
        text1: 'Verified',
        text2: 'Welcome back.',
      });

      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (err) {
      console.log('[MFA] validateOtp error', err?.graphQLErrors, err?.networkError);

      const msg =
        err?.graphQLErrors?.[0]?.message ||
        err?.message ||
        'Verification failed';

      Toast.show({ type: 'error', text1: 'Error', text2: msg });
    } finally {
      hideLoader();
    }
  }, [values]);

  // ---------------------------
  // UI
  // ---------------------------
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Two-Factor Authentication</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code from your authenticator app
      </Text>

      <View style={styles.otpRow}>
        {values.map((val, i) => (
          <TextInput
            key={i}
            ref={el => (inputRefs.current[i] = el)}
            value={val}
            onFocus={() => setActiveIndex(i)}
            onChangeText={t => handleOtpInput(t, i)}

            keyboardType="numeric"
            maxLength={6}

            onKeyPress={e => onKeyPress(e, i)}
            style={[
              styles.otpInput,
              activeIndex === i && styles.activeOtpInput,
            ]}

            textAlign="center"
            returnKeyType={i === 5 ? 'done' : 'next'}
            onSubmitEditing={() => {
              if (i === 5) {
                Keyboard.dismiss();
                handleSubmit();
              } else {
                inputRefs.current[i + 1]?.focus();
              }
            }}
            onPressIn={(e) => {
              setShowPaste(true);
              setPastePosition({
                x: e.nativeEvent.pageX,
                y: e.nativeEvent.pageY - 40, // show above
              });
            }}

          />
        ))}
      </View>

      <TouchableOpacity style={styles.verifyBtn} onPress={handleSubmit}>
        <Text style={styles.verifyText}>Verify OTP</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={async () => {
          await AsyncStorage.removeItem('mfaToken');
          switchTo && switchTo('login');
        }}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------
// STYLES
// ---------------------------
const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    color: '#333',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  otpInput: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    borderColor: '#ccc',
    fontSize: 20,
    color: '#000',
  },
  activeOtpInput: {
    borderColor: '#0C66E4',
    borderWidth: 2,
    backgroundColor: '#E8F0FE',
  },
  verifyBtn: {
    backgroundColor: '#0C66E4',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifyText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelBtn: {
    marginTop: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#0C66E4',
    fontWeight: 'bold',
  },
});










// // src/authentication/MfaVerify.js
// import React, { useRef, useState, useCallback } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   Keyboard,
//   StyleSheet,
// } from 'react-native';
// import { useMutation } from '@apollo/client';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import Toast from 'react-native-toast-message';
// import { useNavigation } from '@react-navigation/native';

// import { useAuth } from '../context/AuthContext';
// import { useLoader } from '../context/LoaderContext';
// import { VALIDATE_OTP } from '../graphql/mutations';

// export default function MfaVerify({ switchTo }) {
//   const navigation = useNavigation();
//   const { setUser } = useAuth();
//   const { showLoader, hideLoader } = useLoader();
//   const [values, setValues] = useState(['', '', '', '', '', '']);
//   const inputRefs = useRef([]);
//   const [validateOtp] = useMutation(VALIDATE_OTP);

//   const onChangeText = (text, idx) => {
//     const cleaned = text.replace(/[^0-9]/g, '').slice(0, 1);
//     const copy = [...values];
//     copy[idx] = cleaned;
//     setValues(copy);
//     if (cleaned && idx < 5) {
//       inputRefs.current[idx + 1]?.focus();
//     }
//   };

//   const onKeyPress = (e, idx) => {
//     if (e.nativeEvent.key === 'Backspace' && !values[idx] && idx > 0) {
//       inputRefs.current[idx - 1]?.focus();
//     }
//   };

//   const handleSubmit = useCallback(async () => {
//     const otp = values.join('');
//     if (otp.length !== 6) {
//       Toast.show({
//         type: 'error',
//         text1: 'Invalid OTP',
//         text2: 'Enter 6 digits.',
//       });
//       return;
//     }

//     const debugToken = await AsyncStorage.getItem('mfaToken');
//     console.log('[MFA] mfaToken before validateOtp:', debugToken);

//     showLoader('Verifying code...');
//     try {
//       const { data } = await validateOtp({ variables: { otp } }); // just like Vue: validateOtp({ otp })
//       const user = data?.validateOtp;

//       if (!user) {
//         Toast.show({ type: 'error', text1: 'Verification failed' });
//         return;
//       }

//       const tokenObj = user.token || {};
//       if (tokenObj.token && tokenObj.refreshToken) {
//         await AsyncStorage.setItem('accessToken', tokenObj.token);
//         await AsyncStorage.setItem('refreshToken', tokenObj.refreshToken);
//       }

//       await AsyncStorage.removeItem('mfaToken');

//       setUser(user);
//       Toast.show({
//         type: 'success',
//         text1: 'Verified',
//         text2: 'Welcome back.',
//       });

//       navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
//     } catch (err) {
//       console.log(
//         '[MFA] validateOtp error',
//         err?.graphQLErrors,
//         err?.networkError,
//       );
//       const msg =
//         err?.graphQLErrors?.[0]?.message ||
//         err?.message ||
//         'Verification failed';
//       Toast.show({ type: 'error', text1: 'Error', text2: msg });
//     } finally {
//       hideLoader();
//     }
//   }, [values, validateOtp, setUser, navigation, showLoader, hideLoader]);

//   const handleOtpInput = (text, idx) => {
//     const cleaned = text.replace(/[^0-9]/g, '');

//     // If user pasted a full 6-digit OTP
//     if (cleaned.length === 6) {
//       const digits = cleaned.split('');
//       setValues(digits);

//       // Focus the last box
//       inputRefs.current[5]?.focus();
//       return;
//     }

//     // Normal single digit typing
//     if (cleaned.length === 1) {
//       const copy = [...values];
//       copy[idx] = cleaned;
//       setValues(copy);

//       if (idx < 5) {
//         inputRefs.current[idx + 1]?.focus();
//       }
//     }
//   };

//   return (
//     <View style={styles.container}>
//       <Text style={styles.title}>Two-Factor Authentication</Text>
//       <Text style={styles.subtitle}>
//         Enter the 6-digit code from your authenticator app
//       </Text>

//       <View style={styles.otpRow}>
//         {values.map((val, i) => (
//           <TextInput
//             key={i}
//             ref={el => (inputRefs.current[i] = el)}
//             value={val}
//             onChangeText={t => handleOtpInput(t, i)}
//             keyboardType="numeric"
//             maxLength={6} // <--- important for paste (temp)
//             onKeyPress={e => onKeyPress(e, i)}
//             style={styles.otpInput}
//             textAlign="center"
//             returnKeyType={i === 5 ? 'done' : 'next'}
//             onSubmitEditing={() => {
//               if (i === 5) {
//                 Keyboard.dismiss();
//                 handleSubmit();
//               } else {
//                 inputRefs.current[i + 1]?.focus();
//               }
//             }}
//           />
//         ))}
//       </View>

//       <TouchableOpacity style={styles.verifyBtn} onPress={handleSubmit}>
//         <Text style={styles.verifyText}>Verify OTP</Text>
//       </TouchableOpacity>

//       <TouchableOpacity
//         style={styles.cancelBtn}
//         onPress={async () => {
//           await AsyncStorage.removeItem('mfaToken');
//           switchTo && switchTo('login');
//         }}
//       >
//         <Text style={styles.cancelText}>Cancel</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     width: '100%',
//     maxWidth: 360,
//     alignSelf: 'center',
//     padding: 20,
//     backgroundColor: '#fff',
//     borderRadius: 10,
//   },
//   title: {
//     fontSize: 22,
//     fontWeight: '600',
//     marginBottom: 8,
//     color: '#000',
//   },
//   subtitle: {
//     fontSize: 14,
//     marginBottom: 20,
//     color: '#333',
//   },
//   otpRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginBottom: 20,
//   },
//   otpInput: {
//     width: 48,
//     height: 48,
//     borderWidth: 1,
//     borderRadius: 8,
//     borderColor: '#ccc',
//     fontSize: 20,
//     color: '#000',
//   },
//   verifyBtn: {
//     backgroundColor: '#0C66E4',
//     padding: 14,
//     borderRadius: 8,
//     alignItems: 'center',
//   },
//   verifyText: {
//     color: '#fff',
//     fontWeight: 'bold',
//   },
//   cancelBtn: {
//     marginTop: 12,
//     alignItems: 'center',
//   },
//   cancelText: {
//     color: '#0C66E4',
//     fontWeight: 'bold',
//   },
// });
