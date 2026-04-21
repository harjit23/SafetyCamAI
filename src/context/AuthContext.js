import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import { AppState } from 'react-native';

import authEvents, { AUTH_EVENTS } from '../utils/authEvents';
import { client } from '../apollo/client';
import { GET_ME, REFRESH_TOKEN } from '../graphql/mutations';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  // ────────────────────────────────────────────────
  // SESSION RESTORE on app cold start
  // ────────────────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const accessToken = await AsyncStorage.getItem('accessToken');

        if (!accessToken) {
          console.log('[AuthContext] No saved session found');
          return;
        }

        // Check if token is expired
        try {
          const decoded = jwtDecode(accessToken);
          const currentTime = Date.now() / 1000;
          if (decoded.exp && decoded.exp < currentTime) {
            console.log('[AuthContext] Session expired, logging out');
            await logout();
            return;
          }
        } catch (e) {
          console.log('[AuthContext] Token decode failed during restore:', e);
        }

        // Load cached user immediately so UI is not blank while fetching
        const savedUserData = await AsyncStorage.getItem('userData');
        if (savedUserData) {
          try {
            setUser(JSON.parse(savedUserData));
            console.log('[AuthContext] Session restored from cache');
          } catch (e) {
            setUser({ isLoggedIn: true });
          }
        } else {
          setUser({ isLoggedIn: true });
        }

        // Clear stale redirect flags
        await AsyncStorage.removeItem('redirectToSubscription');

        // Immediately sync with backend in the background
        // This ensures the latest subscription status is always displayed
        refreshUser(true);
      } catch (error) {
        console.log('[AuthContext] Error restoring session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();

    // Global logout listener (on 401 from Apollo)
    const logoutListener = () => {
      console.log('[AuthContext] Global logout event received');
      logout();
    };
    authEvents.on(AUTH_EVENTS.LOGOUT, logoutListener);

    // Check token when app comes back to foreground
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[AuthContext] App foregrounded, syncing with backend...');
        refreshUser(true);
      }
      appState.current = nextAppState;
    });

    return () => {
      authEvents.off(AUTH_EVENTS.LOGOUT, logoutListener);
      subscription.remove();
    };
  }, []);

  // ────────────────────────────────────────────────
  // LOGIN – called after successful auth
  // ────────────────────────────────────────────────
  const login = async (userData) => {
    setUser(userData);
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      console.log('[AuthContext] User data saved to storage');
    } catch (error) {
      console.log('[AuthContext] Error saving user data:', error);
    }
  };

  // ────────────────────────────────────────────────
  // LOGOUT
  // ────────────────────────────────────────────────
  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'accessToken',
        'refreshToken',
        'mfaToken',
        'apiKey',
        'userData',
        'currentUserId',
        'redirectToSubscription',
      ]);
      setUser(null);
      console.log('[AuthContext] Logged out and cleared storage');
    } catch (error) {
      console.log('[AuthContext] Error during logout:', error);
      setUser(null);
    }
  };

  // ────────────────────────────────────────────────
  // SILENT TOKEN REFRESH
  // Refreshes the JWT using the stored refresh token.
  // Returns the new access token on success, or null on failure.
  // ────────────────────────────────────────────────
  const performTokenRefresh = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const refreshTokenValue = await AsyncStorage.getItem('refreshToken');
      if (!accessToken || !refreshTokenValue) {
        console.log('[AuthContext] ⚠️ Cannot refresh token: missing tokens');
        return null;
      }

      console.log('[AuthContext] 🔄 Refreshing JWT token...');
      const { data } = await client.mutate({
        mutation: REFRESH_TOKEN,
        variables: { token: accessToken, refreshToken: refreshTokenValue },
      });

      if (data?.refreshToken?.token) {
        const newToken = data.refreshToken.token;
        await AsyncStorage.setItem('accessToken', newToken);
        if (data?.refreshToken?.refreshToken) {
          await AsyncStorage.setItem('refreshToken', data.refreshToken.refreshToken);
        }
        console.log('[AuthContext] ✅ JWT token refreshed');
        return newToken;
      }
    } catch (e) {
      console.log('[AuthContext] ❌ Token refresh failed:', e.message);
    }
    return null;
  };

  // ────────────────────────────────────────────────
  // REFRESH USER STATE
  //
  // fromBackend = true  → BACKEND IS THE SOURCE OF TRUTH
  //   1. Call GET_ME with current token to get latest subscription state
  //   2. Update user state with backend response (paymentPlan, paymentExpiryDate, etc.)
  //   3. THEN refresh the token (non-blocking, best effort)
  //
  // fromBackend = false → local only (token/cache), used for quick restores
  // ────────────────────────────────────────────────
  const refreshUser = async (fromBackend = false) => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) return;

      if (fromBackend) {
        // ── STEP 1: Fetch fresh data from backend ────────────────────────
        // The backend has the most accurate subscription state.
        // We do NOT defer this behind a token refresh — we want fresh data NOW.
        console.log('[AuthContext] 🔄 Syncing user state from backend (GET_ME)...');
        let backendUser = null;
        try {
          const { data } = await client.query({
            query: GET_ME,
            fetchPolicy: 'network-only',
            context: { headers: { authorization: `Bearer ${accessToken}` } },
          });

          if (data?.me) {
            backendUser = { ...data.me };
            console.log('[AuthContext] ✅ Backend sync success. Plan:', backendUser.paymentPlan);
            console.log('[AuthContext] 📋 Backend paymentExpiryDate:', backendUser.paymentExpiryDate);
          }
        } catch (backendError) {
          console.log('[AuthContext] ❌ GET_ME failed:', backendError.message);
        }

        if (backendUser) {
          // Backend responded — use it as the SOLE source of truth for subscription data.
          // Do NOT merge with stale token claims for payment fields.
          const updatedUser = {
            ...backendUser,
            // Ensure these key subscription fields come exclusively from the backend:
            paymentPlan: backendUser.paymentPlan,
            paymentExpiryDate: backendUser.paymentExpiryDate,
            pendingLookups: backendUser.pendingLookups,
          };

          console.log('[AuthContext] 🔄 Setting user state from backend. Final plan:', updatedUser.paymentPlan);
          setUser(prev => ({ ...prev, ...updatedUser }));
          await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));

          // ── STEP 2: THEN refresh the JWT token (non-blocking, best effort) ─
          // We do this AFTER updating UI so the user doesn't wait for token refresh.
          performTokenRefresh().catch(e => {
            console.log('[AuthContext] Background token refresh failed:', e.message);
          });

          return; // Done — backend was our source of truth
        }
        // If backend failed, fall through to token-based refresh as fallback
        console.log('[AuthContext] ⚠️ Backend unavailable, falling back to cached token data');
      }

      // ── FALLBACK: Build user state from cached token + saved data ─────────
      try {
        const savedUserData = await AsyncStorage.getItem('userData');
        const decoded = jwtDecode(accessToken);

        let baseUser = {};
        if (savedUserData) {
          try { baseUser = JSON.parse(savedUserData); } catch (e) { }
        }

        const fallbackUser = {
          ...baseUser,
          paymentPlan: baseUser.paymentPlan || decoded.paymentPlan,
          paymentExpiryDate: baseUser.paymentExpiryDate || decoded.paymentExpiryDate,
          pendingLookups: baseUser.pendingLookups !== undefined ? baseUser.pendingLookups : decoded.pendingLookups,
        };

        console.log('[AuthContext] 🔄 User state set from cache/token. Plan:', fallbackUser.paymentPlan);
        setUser({ ...fallbackUser });
        await AsyncStorage.setItem('userData', JSON.stringify(fallbackUser));
      } catch (e) {
        console.log('[AuthContext] Failed to build fallback user state:', e);
      }
    } catch (error) {
      console.log('[AuthContext] Error in refreshUser:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, performTokenRefresh, setUser: login, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
