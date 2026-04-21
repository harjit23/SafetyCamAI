import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { AppState } from 'react-native';

import authEvents, { AUTH_EVENTS } from '../utils/authEvents';
import { parseDate } from '../utils/dateUtils';
import { client } from '../apollo/client';
import { GET_ME, REFRESH_TOKEN } from '../graphql/mutations';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  // Restore session from AsyncStorage on app start
  useEffect(() => {
    const checkTokenExpiry = async () => {
      try {
        const accessToken = await AsyncStorage.getItem('accessToken');
        if (accessToken) {
          const decoded = jwtDecode(accessToken);
          const currentTime = Date.now() / 1000;
          if (decoded.exp && decoded.exp < currentTime) {
            console.log('[AuthContext] Session expired (foreground check), logging out');
            await logout();
            return true; // Expired
          }
        }
      } catch (e) {
        console.log('[AuthContext] Token check failed:', e);
      }
      return false; // Not expired or no token
    };

    const restoreSession = async () => {
      try {
        const accessToken = await AsyncStorage.getItem('accessToken');
        const savedUserData = await AsyncStorage.getItem('userData');

        if (accessToken) {
          // Check if token is expired
          const isExpired = await checkTokenExpiry();
          if (isExpired) return;

          // Clear any stale redirect flags when session is restored
          // This prevents unwanted redirects from previous sessions
          await AsyncStorage.removeItem('redirectToSubscription');

          // If we have a saved user data, use it
          if (savedUserData) {
            try {
              const parsedUser = JSON.parse(savedUserData);
              setUser(parsedUser);
              console.log('[AuthContext] Session restored from storage');
            } catch (parseError) {
              console.log('[AuthContext] Failed to parse saved user data:', parseError);
              // Even if parsing fails, we have a token so user is logged in
              // Set a minimal user object
              setUser({ isLoggedIn: true });
            }
          } else {
            // We have token but no user data - user is still logged in
            setUser({ isLoggedIn: true });
            console.log('[AuthContext] Token found, user restored');
          }
        } else {
          console.log('[AuthContext] No saved session found');
        }
      } catch (error) {
        console.log('[AuthContext] Error restoring session:', error);
      } finally {
        setIsLoading(false);
        // Refresh from backend after session is restored to ensure latest subscription status
        refreshUser(true);
      }
    };

    restoreSession();

    // Listen for global logout events (e.g. from Apollo Client on 401)
    const logoutListener = () => {
      console.log('[AuthContext] Global logout event received');
      logout();
    };

    authEvents.on(AUTH_EVENTS.LOGOUT, logoutListener);

    // AppState listener to check token when coming to foreground
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[AuthContext] App came to foreground, checking token...');
        checkTokenExpiry();
      }
      appState.current = nextAppState;
    });

    return () => {
      authEvents.off(AUTH_EVENTS.LOGOUT, logoutListener);
      subscription.remove();
    };
  }, []);

  const login = async (userData) => {
    setUser(userData);
    // Save user data to AsyncStorage for persistence
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      console.log('[AuthContext] User data saved to storage');
    } catch (error) {
      console.log('[AuthContext] Error saving user data:', error);
    }
  };


  // ...

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'accessToken',
        'refreshToken',
        'mfaToken',
        'apiKey',
        'userData',
        'currentUserId',
        'redirectToSubscription'
      ]);


      setUser(null);
      console.log('[AuthContext] Logged out and cleared storage');
    } catch (error) {
      console.log('[AuthContext] Error during logout storage clearing:', error);
      // Still set user to null to update UI
      setUser(null);
    }
  };

  const performTokenRefresh = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (!refreshToken) return null;

      console.log('[AuthContext] 🔄 Attempting silent token refresh...');
      const { data } = await client.mutate({
        mutation: REFRESH_TOKEN,
        variables: { token: refreshToken },
      });

      if (data?.refreshToken?.token) {
        const newToken = data.refreshToken.token;
        await AsyncStorage.setItem('accessToken', newToken);
        if (data?.refreshToken?.refreshToken) {
          await AsyncStorage.setItem('refreshToken', data.refreshToken.refreshToken);
        }
        console.log('[AuthContext] ✅ Token refreshed successfully');
        // NOTE: Do NOT call refreshUser here to avoid circular calls
        return newToken;
      }
    } catch (e) {
      console.log('[AuthContext] ❌ Token refresh failed:', e.message);
    }
    return null;
  };

  const refreshUser = async (fromBackend = false) => {
    try {
      // Read token initially
      let accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) return;

      let updatedUser = null;

      if (fromBackend) {
        console.log('[AuthContext] 🔄 Refreshing user data from backend...');

        // 1) Refresh the JWT token first and use the NEW token for GET_ME
        const newToken = await performTokenRefresh();
        if (newToken) {
          accessToken = newToken; // Use fresh token for subsequent calls
          console.log('[AuthContext] ✅ Using fresh token for GET_ME');
        }

        // 2) Fetch fresh user data with the latest token
        try {
          const { data } = await client.query({
            query: GET_ME,
            fetchPolicy: 'network-only',
            context: { headers: { authorization: `Bearer ${accessToken}` } },
          });

          if (data?.me) {
            updatedUser = { ...data.me };
            console.log('[AuthContext] ✅ Fresh data from backend. Plan:', updatedUser.paymentPlan);
          }
        } catch (backendError) {
          console.log('[AuthContext] ❌ Backend refresh failed, falling back to token:', backendError.message);
        }
      }

      // Build final user state from token claims + backend data
      try {
        const savedUserData = await AsyncStorage.getItem('userData');
        const decoded = jwtDecode(accessToken);

        let baseUser = updatedUser || {};
        if (!updatedUser && savedUserData) {
          try { baseUser = JSON.parse(savedUserData); } catch (e) { }
        }

        const mergedUser = {
          ...baseUser,
          paymentPlan: updatedUser?.paymentPlan || decoded.paymentPlan,
          paymentExpiryDate: updatedUser?.paymentExpiryDate || decoded.paymentExpiryDate,
          pendingLookups: updatedUser?.pendingLookups !== undefined ? updatedUser.pendingLookups : decoded.pendingLookups,
        };

        console.log('[AuthContext] 🔄 Final user state set. Plan:', mergedUser.paymentPlan);

        setUser({ ...mergedUser });
        await AsyncStorage.setItem('userData', JSON.stringify(mergedUser));
      } catch (e) {
        console.log('[AuthContext] Failed to build user state:', e);
      }
    } catch (error) {
      console.log('[AuthContext] Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, performTokenRefresh, setUser: login, isLoading }}>

      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
