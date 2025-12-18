import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from AsyncStorage on app start
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const accessToken = await AsyncStorage.getItem('accessToken');
        const savedUserData = await AsyncStorage.getItem('userData');
        
        if (accessToken) {
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
      }
    };

    restoreSession();
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

  const logout = async () => {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('apiKey');
    await AsyncStorage.removeItem('userData');
    await AsyncStorage.removeItem('currentUserId');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, setUser: login, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
