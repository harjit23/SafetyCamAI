import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { useMutation } from '@apollo/client';
import { useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import RegisterForm from '../authentication/RegisterForm';
import ForgotPassword from '../authentication/ForgotPassword';
import ResetPassword from '../authentication/ResetPassword';
import LoginForm from '../authentication/LoginForm';
import { VERIFY_EMAIL_ADDRESS_MUTATION } from '../graphql/mutations';
import { useAlert } from '../context/AlertContext';

export default function AuthScreen() {
  const [activeScreen, setActiveScreen] = useState('login');
  const route = useRoute();
  const { showAlert } = useAlert?.() || {};
  const [verifyEmailAddress] = useMutation(VERIFY_EMAIL_ADDRESS_MUTATION);

  useEffect(() => {
    const params = route.params || {};
    const { code, email } = params;

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
              showAlert?.('Email verified successfully. You can now log in.');
              setActiveScreen('login');
            })
            .catch(err => {
              const msg = err.message || 'Verification failed';
              showAlert?.(msg);
            });
        }
        break;
      default:
        setActiveScreen('login');
    }
  }, [route.name, route.params]);

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
      default:
        return <LoginForm switchTo={setActiveScreen} />;
    }
  };

  return (
    <>
      {/* Top inset only: black */}
      <SafeAreaView edges={['top']} style={styles.topInset}>
        <StatusBar barStyle="light-content" backgroundColor="black" />
      </SafeAreaView>

      {/* Rest of the screen: no black background */}
      <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.container}>
        <Image
          source={require('../assets/Authorization-Background.png')}
          style={styles.bg}
        />
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
  topInset: { flex: 0, backgroundColor: 'black' }, // only the notch/status area
  container: { flex: 1 },                          // no background color here
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




