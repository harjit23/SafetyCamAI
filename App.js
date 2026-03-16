import React, { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import {
  NavigationContainer,
  getStateFromPath,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApolloProvider } from '@apollo/client';
import { client } from './src/apollo/client';

import { AuthProvider } from './src/context/AuthContext';
import { AlertProvider } from './src/context/AlertContext';
import { LoaderProvider } from './src/context/LoaderContext';

import HomeScreen from './src/screens/HomeScreen';
import AuthScreen from './src/screens/AuthScreen';
import Loader from './src/components/Loader';
import SourceWebView from './src/screens/SourceWebView';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SubscriptionScreen from './src/screens/SubscriptionScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SafetyDisclaimer from './src/components/SafetyDisclaimer';

const Stack = createNativeStackNavigator();
const ONBOARDING_KEY = 'onboarding_completed';

const linking = {
  prefixes: ['https://app.safetycamai.com', 'safetycamai://'],
  config: {
    screens: {
      Home: 'home',
      Profile: 'profile',
      AuthLogin: 'auth/login',
      AuthRegister: 'auth/register',
      AuthReset: {
        path: 'auth/reset-password',
        parse: {
          code: String,
          email: String,
        },
      },
      AuthVerify: {
        path: 'auth/verify-user',
        parse: {
          code: String,
          email: String,
        },
      },
    },
  },
};

export default function App() {
  const navigationRef = useRef();
  const [initialURLChecked, setInitialURLChecked] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(null);

  // Check if onboarding has been completed
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
        setOnboardingComplete(completed === 'true');
      } catch (e) {
        console.warn('Failed to check onboarding status:', e);
        setOnboardingComplete(true); // Default to skipping onboarding on error
      }
    };
    checkOnboarding();
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then(url => {
      if (url && navigationRef.current) {
        const state = getStateFromPath(url, linking.config);
        if (state?.routes?.length > 0) {
          navigationRef.current.resetRoot(state);
        } else {
          console.warn('Deep link did not match any route:', url);
        }
      }
      setInitialURLChecked(true);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (navigationRef.current) {
        const state = getStateFromPath(url, linking.config);
        if (state?.routes?.length > 0) {
          navigationRef.current.resetRoot(state);
        } else {
          console.warn('Deep link did not match any route:', url);
        }
      }
    });

    return () => subscription.remove();
  }, []);

  if (!initialURLChecked || onboardingComplete === null) {
    return null; // Loading state
  }

  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <AlertProvider>
          <LoaderProvider>
            <SafetyDisclaimer>
              <NavigationContainer ref={navigationRef} linking={linking}>
                <Stack.Navigator
                  screenOptions={{ headerShown: false }}
                  initialRouteName={onboardingComplete ? 'Home' : 'Onboarding'}
                >
                  <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                  <Stack.Screen name="Home">
                    {props => (
                      <AlertProvider>
                        <HomeScreen {...props} />
                      </AlertProvider>
                    )}
                  </Stack.Screen>
                  <Stack.Screen name="AuthLogin" component={AuthScreen} />
                  <Stack.Screen name="AuthRegister" component={AuthScreen} />
                  <Stack.Screen name="AuthReset" component={AuthScreen} />
                  <Stack.Screen name="AuthVerify" component={AuthScreen} />
                  <Stack.Screen name="SourceWebView" component={SourceWebView} />
                  <Stack.Screen name="History" component={HistoryScreen} />
                  <Stack.Screen name="Profile" component={ProfileScreen} />
                  <Stack.Screen name="Subscription" component={SubscriptionScreen} />
                </Stack.Navigator>
              </NavigationContainer>
            </SafetyDisclaimer>
            <Loader />
            <Toast />
          </LoaderProvider>
        </AlertProvider>
      </AuthProvider>
    </ApolloProvider>
  );
}


