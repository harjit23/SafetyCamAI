import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import QRModal from '../authentication/QRModal';
import apolloClient from '../apollo/client';
import { configureMFA, refreshToken } from '../graphql';

const ProfileScreen = () => {
  const { user, logout, setUser } = useAuth();
  const [qrVisible, setQrVisible] = useState(false);
  const [qrCode, setQrCode] = useState(null);

  const enableMFA = async () => {
    try {
      const { data } = await apolloClient.mutate(configureMFA());
      setQrCode(data.configureTwoFactor);
      setQrVisible(true);
    } catch (err) {
      console.error('MFA Error', err);
      Alert.alert('Error', 'Failed to enable MFA');
    }
  };

  const handleQrClose = async () => {
    setQrVisible(false);
    try {
      const token = user.token;
      const { data } = await apolloClient.mutate(
        refreshToken({ refreshToken: token.refreshToken, token: token.token })
      );
      const updatedToken = { ...token, ...data.refreshToken };
      setUser({ ...user, token: updatedToken });
    } catch (err) {
      console.error('Refresh Token Error', err);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar} />
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Two-Factor Authentication</Text>
        {!user?.isMFAEnabled && (
          <TouchableOpacity style={styles.enableButton} onPress={enableMFA}>
            <Text style={styles.enableButtonText}>Enable Authenticator App</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>

      {qrVisible && <QRModal qr={qrCode} onClose={handleQrClose} />}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EAF4FF', padding: 16 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#007bff', marginBottom: 16 },
  profileCard: { backgroundColor: '#fff', borderRadius: 10, padding: 16, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#007bff', marginBottom: 8 },
  name: { fontSize: 20, fontWeight: 'bold' },
  email: { fontSize: 14, color: '#555' },
  infoCard: { backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  enableButton: { backgroundColor: '#007bff', padding: 12, borderRadius: 8, alignItems: 'center' },
  enableButtonText: { color: '#fff', fontWeight: 'bold' },
  logoutButton: { backgroundColor: '#ff4d4f', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  logoutButtonText: { color: '#fff', fontWeight: 'bold' },
});

export default ProfileScreen;
