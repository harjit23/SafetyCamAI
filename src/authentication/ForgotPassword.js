import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useMutation } from '@apollo/client';
import { FORGOT_PASSWORD } from '../graphql/mutations';
import Toast from 'react-native-toast-message';
import { useLoader } from '../context/LoaderContext';

const ForgotPassword = ({ switchTo }) => {
  const { showLoader, hideLoader } = useLoader();
  const [email, setEmail] = useState('');
  const [forgotPassword] = useMutation(FORGOT_PASSWORD);

  const handleSubmit = async () => {
    if (!email || !email.includes('@')) {
      return Toast.show({
        type: 'error',
        text1: 'Invalid Email',
        text2: 'Please enter a valid email address.',
      });
    }

    try {
      showLoader('Sending reset link...');
      const { data } = await forgotPassword({
        variables: { email, type: 'product' },
      });
      hideLoader();

      const successMessage =
        data?.forgotPassword?.message ||
        'Password reset link sent to your email.';

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: successMessage,
      });

      switchTo('login');
    } catch (err) {
      hideLoader();
      const errorMessage =
        err?.graphQLErrors?.[0]?.message ||
        err?.networkError?.message ||
        err?.message ||
        'Failed to send reset link. Please try again.';

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
        <Text style={styles.title}>Forgot Password</Text>

        <Text style={styles.label}>Email*</Text>
        <TextInput
          placeholder="Enter your email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.button} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Send reset password link</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.normalText}>Back to </Text>
          <TouchableOpacity onPress={() => switchTo('login')}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

export default ForgotPassword;

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
    color: '#000', // Ensures input text is visible
  },
  button: {
    backgroundColor: '#0C66E4',
    padding: 14,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
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
  normalText: {
    color: '#000',
  },
  loginLink: {
    color: '#0C66E4',
    fontWeight: 'bold',
  },
});
