import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useMutation, gql } from '@apollo/client';
import Icon from 'react-native-vector-icons/FontAwesome';
import Toast from 'react-native-toast-message';
import { useLoader } from '../context/LoaderContext';

const REGISTER_MUTATION = gql`
  mutation ($email: String!, $password: String!, $name: String!, $type: String!) {
    register(
      input: { name: $name, email: $email, password: $password }
      type: $type
    )
  }
`;

const RegisterForm = ({ switchTo }) => {
  const { showLoader, hideLoader } = useLoader();
  const [register] = useMutation(REGISTER_MUTATION);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- validation ---
  const isEmailValid = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
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

  const passwordsMatch = confirmPassword === password;

  const canSubmit =
    name.trim().length > 0 &&
    isEmailValid &&
    isStrongPassword &&
    passwordsMatch;

  const handleRegister = async () => {
    setSubmitted(true);
    if (!canSubmit) {
      let msg = 'Please fix the highlighted fields.';
      if (!name.trim()) msg = 'Please enter your name.';
      else if (!isEmailValid) msg = 'Please enter a valid email.';
      else if (!isStrongPassword) msg = 'Please use a stronger password.';
      else if (!passwordsMatch) msg = 'Passwords do not match.';

      Toast.show({ type: 'error', text1: 'Cannot continue', text2: msg });
      return;
    }

    try {
      showLoader('Registering...');
      const { data } = await register({
        variables: {
          name,
          email,
          password,
          type: 'dashboard',
        },
      });
      hideLoader();

      const message =
        data?.register?.message ||
        'Registration successful. Check your email for verification.';

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: message,
      });

      switchTo('login');
    } catch (err) {
      hideLoader();
      const message =
        err?.graphQLErrors?.[0]?.message ||
        err?.message ||
        'Registration failed. Please try again.';
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: message,
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <Text style={styles.title}>Sign up</Text>

        <Text style={styles.label}>Name*</Text>
        <TextInput
          placeholder="Enter your name"
          placeholderTextColor="#888"
          value={name}
          onChangeText={setName}
          style={[
            styles.input,
            submitted && !name.trim() && styles.inputError,
          ]}
          autoCapitalize="words"
        />
        {submitted && !name.trim() && (
          <Text style={styles.errorText}>Please enter your name.</Text>
        )}

        <Text style={styles.label}>Email*</Text>
        <TextInput
          placeholder="Enter your email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          style={[
            styles.input,
            submitted && !isEmailValid && styles.inputError,
          ]}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        {submitted && !isEmailValid && (
          <Text style={styles.errorText}>Please enter a valid email address.</Text>
        )}

        <Text style={styles.label}>Password*</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Enter your password"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            style={styles.passwordInput}
            secureTextEntry={!showPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            autoComplete="new-password"
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

        {/* single red helper like your screenshot */}
        {(passwordFocused || submitted) && !isStrongPassword && (
          <Text style={styles.passwordError}>
            Enter a Strong Password (Min. 8 characters) which contains at least
            one uppercase & lowercase alphabet, numeric and symbols (@$!%*?&#)
          </Text>
        )}

        <Text style={styles.label}>Confirm Password*</Text>
        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Confirm your password"
            placeholderTextColor="#888"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.passwordInput}
            secureTextEntry={!showConfirmPassword}
            autoComplete="new-password"
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Icon
              name={showConfirmPassword ? 'eye' : 'eye-slash'}
              size={20}
              color="#666"
              style={styles.icon}
            />
          </TouchableOpacity>
        </View>
        {submitted && !passwordsMatch && (
          <Text style={styles.passwordError}>Passwords do not match.</Text>
        )}

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={!canSubmit}
        >
          <Text style={styles.buttonText}>Create account →</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={{ color: '#000' }}>Already Have an Account? </Text>
          <TouchableOpacity onPress={() => switchTo('login')}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default RegisterForm;

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
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'left',
    color: '#000',
  },
  label: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '500',
    color: '#000',
  },
  input: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 6,
    borderColor: '#ccc',
    borderWidth: 1,
    color: '#000',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 18,
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
  // single red helper line
  passwordError: {
    marginTop: 6,
    fontSize: 12,
    color: '#dc2626',
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#0d6efd',
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
    color: '#0d6efd',
    fontWeight: 'bold',
  },
});








// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   StyleSheet,
//   ScrollView,
// } from 'react-native';
// import { useMutation, gql } from '@apollo/client';
// import Icon from 'react-native-vector-icons/FontAwesome';
// import Toast from 'react-native-toast-message';
// import { useLoader } from '../context/LoaderContext';

// const REGISTER_MUTATION = gql`
//   mutation ($email: String!, $password: String!, $name: String!, $type: String!) {
//     register(
//       input: { name: $name, email: $email, password: $password }
//       type: $type
//     )
//   }
// `;

// const RegisterForm = ({ switchTo }) => {
//   const { showLoader, hideLoader } = useLoader();
//   const [register] = useMutation(REGISTER_MUTATION);

//   const [name, setName] = useState('');
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [confirmPassword, setConfirmPassword] = useState('');

//   const [showPassword, setShowPassword] = useState(false);
//   const [showConfirmPassword, setShowConfirmPassword] = useState(false);

//   const handleRegister = async () => {
//     if (!name || !email || !password || !confirmPassword) {
//       Toast.show({
//         type: 'error',
//         text1: 'Missing Fields',
//         text2: 'All fields are required',
//       });
//       return;
//     }

//     if (password !== confirmPassword) {
//       Toast.show({
//         type: 'error',
//         text1: 'Password Mismatch',
//         text2: 'Passwords do not match',
//       });
//       return;
//     }

//     try {
//       showLoader('Registering...');
//       const { data } = await register({
//         variables: {
//           name,
//           email,
//           password,
//           type: 'dashboard',
//         },
//       });
//       hideLoader();

//       const message =
//         data?.register?.message ||
//         'Registration successful. Check your email for verification.';

//       Toast.show({
//         type: 'success',
//         text1: 'Success',
//         text2: message,
//       });

//       switchTo('login');
//     } catch (err) {
//       hideLoader();
//       const message =
//         err?.graphQLErrors?.[0]?.message ||
//         err?.message ||
//         'Registration failed. Please try again.';
//       Toast.show({
//         type: 'error',
//         text1: 'Error',
//         text2: message,
//       });
//     }
//   };

//   return (
//     <ScrollView contentContainerStyle={styles.scrollContent}>
//       <View style={styles.container}>
//         <Text style={styles.title}>Sign up</Text>

//         <Text style={styles.label}>Name*</Text>
//         <TextInput
//           placeholder="Enter your name"
//           placeholderTextColor="#888"
//           value={name}
//           onChangeText={setName}
//           style={styles.input}
//           autoCapitalize="words"
//         />

//         <Text style={styles.label}>Email*</Text>
//         <TextInput
//           placeholder="Enter your email"
//           placeholderTextColor="#888"
//           value={email}
//           onChangeText={setEmail}
//           style={styles.input}
//           keyboardType="email-address"
//           autoCapitalize="none"
//         />

//         <Text style={styles.label}>Password*</Text>
//         <View style={styles.passwordContainer}>
//           <TextInput
//             placeholder="Enter your password"
//             placeholderTextColor="#888"
//             value={password}
//             onChangeText={setPassword}
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
//             value={confirmPassword}
//             onChangeText={setConfirmPassword}
//             style={styles.passwordInput}
//             secureTextEntry={!showConfirmPassword}
//           />
//           <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
//             <Icon
//               name={showConfirmPassword ? 'eye' : 'eye-slash'}
//               size={20}
//               color="#666"
//               style={styles.icon}
//             />
//           </TouchableOpacity>
//         </View>

//         <TouchableOpacity style={styles.button} onPress={handleRegister}>
//           <Text style={styles.buttonText}>Create account →</Text>
//         </TouchableOpacity>

//         <View style={styles.footer}>
//           <Text style={{ color: '#000' }}>Already Have an Account? </Text>
//           <TouchableOpacity onPress={() => switchTo('login')}>
//             <Text style={styles.loginLink}>Login</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </ScrollView>
//   );
// };

// export default RegisterForm;

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
//     backgroundColor: '#fff',
//     borderRadius: 10,
//   },
//   title: {
//     fontSize: 22,
//     fontWeight: '600',
//     marginBottom: 16,
//     textAlign: 'left',
//     color: '#000',
//   },
//   label: {
//     fontSize: 14,
//     marginTop: 8,
//     marginBottom: 4,
//     fontWeight: '500',
//     color: '#000',
//   },
//   input: {
//     backgroundColor: '#fff',
//     padding: 12,
//     borderRadius: 6,
//     borderColor: '#ccc',
//     borderWidth: 1,
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
//     backgroundColor: '#0d6efd',
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
//     color: '#0d6efd',
//     fontWeight: 'bold',
//   },
// });
