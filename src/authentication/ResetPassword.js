import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useMutation } from '@apollo/client';
import { RESET_PASSWORD, VERIFY_TOKEN } from '../graphql/mutations';
import Toast from 'react-native-toast-message';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useLoader } from '../context/LoaderContext';
import { useNavigation } from '@react-navigation/native';

const ResetPassword = ({ route }) => {
  const { showLoader, hideLoader } = useLoader();
  const navigation = useNavigation();

  const { email, code } = route.params || {};
  const [resetPassword] = useMutation(RESET_PASSWORD);
  const [verifyToken] = useMutation(VERIFY_TOKEN);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [resetForm, setResetForm] = useState({
    newPassword: '',
    confirmNewPassword: '',
  });

  // ---- Password validation (memoized) ----
  // Strong: min 8, has upper, lower, number, at least one symbol, no spaces
  const isStrongPassword = useMemo(() => {
    const s = resetForm.newPassword || '';
    const longEnough = s.length >= 8;
    const hasUpper = /[A-Z]/.test(s);
    const hasLower = /[a-z]/.test(s);
    const hasNumber = /\d/.test(s);
    const hasNoSpaces = !/\s/.test(s);
    // symbols allow-list: @ $ ! % * ? & # _ / \ - = + . , : ; ' " ( ) { } [ ] ^ ~ | < >
    const hasSymbol = /[@$!%*?&#_\/\\\-=\+\.,:;'"()\{\}\[\]\^~|<>]/.test(s);
    return longEnough && hasUpper && hasLower && hasNumber && hasSymbol && hasNoSpaces;
  }, [resetForm.newPassword]);

  const passwordsMatch = useMemo(
    () => resetForm.newPassword === resetForm.confirmNewPassword,
    [resetForm.newPassword, resetForm.confirmNewPassword]
  );

  const canSubmit = isStrongPassword && passwordsMatch;

  useEffect(() => {
    if (!email || !code) {
      navigation.navigate('AuthLogin');
    } else {
      showLoader('Verifying reset link...');
      verifyToken({
        variables: { email, code, provider: 'ForgetPassword' },
      })
        .catch((err) => {
          const message =
            err?.graphQLErrors?.[0]?.message ||
            err?.message ||
            'Invalid or expired link.';

          Toast.show({
            type: 'error',
            text1: 'Error',
            text2: message,
          });

          navigation.navigate('AuthLogin');
        })
        .finally(hideLoader);
    }
  }, []);

  const handleSubmit = async () => {
    if (!isStrongPassword) {
      return Toast.show({
        type: 'error',
        text1: 'Weak Password',
        text2: 'Use 8+ chars with upper, lower, number & a symbol. No spaces.',
      });
    }

    if (!passwordsMatch) {
      return Toast.show({
        type: 'error',
        text1: 'Mismatch',
        text2: 'Passwords do not match.',
      });
    }

    try {
      showLoader('Resetting password...');
      const { data } = await resetPassword({
        variables: {
          email,
          code,
          password: resetForm.newPassword,
        },
      });
      hideLoader();

      const message =
        data?.resetPassword?.message || 'Password reset successfully.';

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: message,
      });

      navigation.navigate('AuthLogin');
    } catch (err) {
      hideLoader();
      const errorMessage =
        err?.graphQLErrors?.[0]?.message ||
        err?.message ||
        'Failed to reset password. Please try again.';

      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: errorMessage,
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Please create a new password</Text>

        <Text style={styles.label}>New Password*</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Enter new password"
            placeholderTextColor="#888"
            value={resetForm.newPassword}
            onChangeText={(text) =>
              setResetForm({ ...resetForm, newPassword: text })
            }
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
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

        {/* Helper: show when user typed but requirements not met */}
        {!isStrongPassword && resetForm.newPassword.length > 0 && (
          <Text style={styles.passwordError}>
            Use at least 8 characters, including uppercase, lowercase, a number,
            and a symbol (e.g. @ * / = + - _ # !). Spaces are not allowed.
          </Text>
        )}

        <Text style={styles.label}>Confirm Password*</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Confirm your password"
            placeholderTextColor="#888"
            value={resetForm.confirmNewPassword}
            onChangeText={(text) =>
              setResetForm({ ...resetForm, confirmNewPassword: text })
            }
            style={styles.passwordInput}
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Icon
              name={showConfirmPassword ? 'eye' : 'eye-slash'}
              size={20}
              color="#666"
              style={styles.icon}
            />
          </TouchableOpacity>
        </View>

        {/* Helper: mismatch */}
        {resetForm.confirmNewPassword.length > 0 && !passwordsMatch && (
          <Text style={styles.passwordError}>Passwords do not match.</Text>
        )}

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.buttonText}>Reset Password</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={{ color: '#000' }}>Back to </Text>
          <TouchableOpacity onPress={() => navigation.navigate('AuthLogin')}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default ResetPassword;

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'left',
    color: '#000',
  },
  subtitle: {
    fontSize: 14,
    color: '#333',
    marginBottom: 20,
    textAlign: 'left',
  },
  label: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '500',
    color: '#000',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    paddingRight: 8,
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    color: '#000',
  },
  icon: {
    paddingHorizontal: 8,
  },
  passwordError: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#0C66E4',
    padding: 14,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  loginLink: {
    color: '#0C66E4',
    fontWeight: 'bold',
  },
});


// import React, { useState, useEffect } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   StyleSheet,
//   ScrollView,
// } from 'react-native';
// import { useMutation } from '@apollo/client';
// import { RESET_PASSWORD, VERIFY_TOKEN } from '../graphql/mutations';
// import Toast from 'react-native-toast-message';
// import Icon from 'react-native-vector-icons/FontAwesome';
// import { useLoader } from '../context/LoaderContext';
// import { useNavigation } from '@react-navigation/native';

// const ResetPassword = ({ route }) => {
//   const { showLoader, hideLoader } = useLoader();
//   const navigation = useNavigation();

//   const { email, code } = route.params || {};
//   const [resetPassword] = useMutation(RESET_PASSWORD);
//   const [verifyToken] = useMutation(VERIFY_TOKEN);

//   const [showPassword, setShowPassword] = useState(false);
//   const [showConfirmPassword, setShowConfirmPassword] = useState(false);

//   const [resetForm, setResetForm] = useState({
//     newPassword: '',
//     confirmNewPassword: '',
//   });

//   useEffect(() => {
//     if (!email || !code) {
//       navigation.navigate('AuthLogin');
//     } else {
//       showLoader('Verifying reset link...');
//       verifyToken({
//         variables: { email, code, provider: 'ForgetPassword' },
//       })
//         .catch((err) => {
//           const message =
//             err?.graphQLErrors?.[0]?.message ||
//             err?.message ||
//             'Invalid or expired link.';

//           Toast.show({
//             type: 'error',
//             text1: 'Error',
//             text2: message,
//           });

//           navigation.navigate('AuthLogin');
//         })
//         .finally(hideLoader);
//     }
//   }, []);

//   const handleSubmit = async () => {
//     if (resetForm.newPassword.length < 6) {
//       return Toast.show({
//         type: 'error',
//         text1: 'Weak Password',
//         text2: 'Password must be at least 6 characters.',
//       });
//     }

//     if (resetForm.newPassword !== resetForm.confirmNewPassword) {
//       return Toast.show({
//         type: 'error',
//         text1: 'Mismatch',
//         text2: 'Passwords do not match.',
//       });
//     }

//     try {
//       showLoader('Resetting password...');
//       const { data } = await resetPassword({
//         variables: {
//           email,
//           code,
//           password: resetForm.newPassword,
//         },
//       });
//       hideLoader();

//       const message =
//         data?.resetPassword?.message || 'Password reset successfully.';

//       Toast.show({
//         type: 'success',
//         text1: 'Success',
//         text2: message,
//       });

//       navigation.navigate('AuthLogin');
//     } catch (err) {
//       hideLoader();
//       const errorMessage =
//         err?.graphQLErrors?.[0]?.message ||
//         err?.message ||
//         'Failed to reset password. Please try again.';

//       Toast.show({
//         type: 'error',
//         text1: 'Error',
//         text2: errorMessage,
//       });
//     }
//   };

//   return (
//     <ScrollView contentContainerStyle={styles.scrollContent}>
//       <View style={styles.container}>
//         <Text style={styles.title}>Reset Password</Text>
//         <Text style={styles.subtitle}>Please create a new password</Text>

//         <Text style={styles.label}>New Password*</Text>
//         <View style={styles.passwordContainer}>
//           <TextInput
//             placeholder="Enter new password"
//             placeholderTextColor="#888"
//             value={resetForm.newPassword}
//             onChangeText={(text) =>
//               setResetForm({ ...resetForm, newPassword: text })
//             }
//             style={styles.passwordInput}
//             secureTextEntry={!showPassword}
//           />
//           <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
//             <Icon
//               name={showPassword ? 'eye' : 'eye-slash'}
//               size={20}
//               color="#666"
//               style={styles.icon}
//             />
//           </TouchableOpacity>
//         </View>

//         <Text style={styles.label}>Confirm Password*</Text>
//         <View style={styles.passwordContainer}>
//           <TextInput
//             placeholder="Confirm your password"
//             placeholderTextColor="#888"
//             value={resetForm.confirmNewPassword}
//             onChangeText={(text) =>
//               setResetForm({ ...resetForm, confirmNewPassword: text })
//             }
//             style={styles.passwordInput}
//             secureTextEntry={!showConfirmPassword}
//           />
//           <TouchableOpacity
//             onPress={() => setShowConfirmPassword(!showConfirmPassword)}
//           >
//             <Icon
//               name={showConfirmPassword ? 'eye' : 'eye-slash'}
//               size={20}
//               color="#666"
//               style={styles.icon}
//             />
//           </TouchableOpacity>
//         </View>

//         <TouchableOpacity style={styles.button} onPress={handleSubmit}>
//           <Text style={styles.buttonText}>Reset Password</Text>
//         </TouchableOpacity>

//         <View style={styles.footer}>
//           <Text style={{ color: '#000' }}>Back to </Text>
//           <TouchableOpacity onPress={() => navigation.navigate('AuthLogin')}>
//             <Text style={styles.loginLink}>Login</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </ScrollView>
//   );
// };

// export default ResetPassword;

// const styles = StyleSheet.create({
//   scrollContent: {
//     flexGrow: 1,
//     justifyContent: 'center',
//   },
//   container: {
//     width: '100%',
//     maxWidth: 360,
//     alignSelf: 'center',
//     padding: 20,
//     borderRadius: 10,
//   },
//   title: {
//     fontSize: 22,
//     fontWeight: '600',
//     marginBottom: 8,
//     textAlign: 'left',
//     color: '#000',
//   },
//   subtitle: {
//     fontSize: 14,
//     color: '#333',
//     marginBottom: 20,
//     textAlign: 'left',
//   },
//   label: {
//     fontSize: 14,
//     marginTop: 8,
//     marginBottom: 4,
//     fontWeight: '500',
//     color: '#000',
//   },
//   passwordContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#fff',
//     borderColor: '#ccc',
//     borderWidth: 1,
//     borderRadius: 6,
//     paddingRight: 8,
//     marginBottom: 8,
//   },
//   passwordInput: {
//     flex: 1,
//     padding: 12,
//     color: '#000',
//   },
//   icon: {
//     paddingHorizontal: 8,
//   },
//   button: {
//     backgroundColor: '#0C66E4',
//     padding: 14,
//     borderRadius: 8,
//     marginTop: 20,
//     alignItems: 'center',
//   },
//   buttonText: {
//     color: '#ffffff',
//     fontWeight: 'bold',
//   },
//   footer: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     marginTop: 16,
//   },
//   loginLink: {
//     color: '#0C66E4',
//     fontWeight: 'bold',
//   },
// });
