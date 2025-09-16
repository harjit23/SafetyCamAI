import React, { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import {
  NavigationContainer,
  getStateFromPath,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';

import { ApolloProvider } from '@apollo/client';
import { client } from './src/apollo/client';

import { AuthProvider } from './src/context/AuthContext';
import { AlertProvider } from './src/context/AlertContext';
import { LoaderProvider } from './src/context/LoaderContext';

import HomeScreen from './src/screens/HomeScreen';
import AuthScreen from './src/screens/AuthScreen';
import Loader from './src/components/Loader';
import MugshotWebView from './src/screens/MugshotWebView';
import HistoryScreen from './src/screens/HistoryScreen';

const Stack = createNativeStackNavigator();

const linking = {
  prefixes: ['https://app.safetycamai.com', 'safetycamai://'],
  config: {
    screens: {
      Home: 'home',
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

  if (!initialURLChecked) {
    return null; // optional: splash/loading screen
  }

  return (
    <ApolloProvider client={client}>
      <AuthProvider>
        <AlertProvider>
          <LoaderProvider>
            <NavigationContainer ref={navigationRef} linking={linking}>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
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
                <Stack.Screen name="MugshotWebView" component={MugshotWebView} />
                <Stack.Screen name="History" component={HistoryScreen} />
              </Stack.Navigator>
            </NavigationContainer>
            <Loader />
            <Toast />
          </LoaderProvider>
        </AlertProvider>
      </AuthProvider>
    </ApolloProvider>
  );
}






