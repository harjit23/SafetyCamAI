import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { useAlert } from '../context/AlertContext';
import { useNavigation } from '@react-navigation/native';

const AlertDialog = () => {
  const navigation = useNavigation();
  const { alertInfo, closeAlert } = useAlert();

  const upgradeNow = () => {
    // Close the alert and navigate to Subscription screen
    // All IAP handling is centralized in SubscriptionScreen
    closeAlert();
    navigation.navigate('Subscription');
  };

  return (
    <Modal visible={alertInfo.isOpen} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={closeAlert}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <Text style={styles.title}>Trial Feature Expired</Text>
              <Text style={styles.message}>
                {alertInfo.msg}. Upgrade to Premium for just $9.19/month to continue.
              </Text>

              <View style={styles.benefits}>
                <Text style={styles.benefitsHeader}>Premium Benefits:</Text>
                <Text style={styles.benefitItem}>• Unlimited Searches</Text>
                <Text style={styles.benefitItem}>• Advanced Facial Recognition</Text>
                <Text style={styles.benefitItem}>• Priority Support</Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={upgradeNow}
                >
                  <Text style={styles.upgradeText}>
                    Subscribe ($9.19/mo)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default AlertDialog;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0005',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderTopWidth: 4,
    borderTopColor: '#0C66E4',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#0C66E4',
  },
  message: {
    fontSize: 14,
    color: '#444',
    marginBottom: 16,
  },
  benefits: {
    backgroundColor: '#0C66E410',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  benefitsHeader: {
    color: '#0C66E4',
    fontWeight: '600',
    marginBottom: 6,
  },
  benefitItem: {
    fontSize: 13,
    color: '#555',
  },
  actions: {
    flexDirection: 'column',
    gap: 10,
  },
  upgradeButton: {
    backgroundColor: '#0C66E4',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  learnMoreButton: {
    borderColor: '#0C66E4',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  learnMoreText: {
    color: '#0C66E4',
    fontWeight: '500',
  },
});
