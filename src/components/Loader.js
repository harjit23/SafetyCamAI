import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLoader } from '../context/LoaderContext';

const Loader = () => {
  const { loading, message } = useLoader();

  if (!loading) return null;

  return (
    <View style={styles.overlay}>
      <ActivityIndicator size="large" color="#fff" />
      {message ? <Text style={styles.text}>{message}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 999,
  },
  text: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
});

export default Loader;
