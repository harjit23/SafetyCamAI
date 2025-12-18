import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useAlert } from '../context/AlertContext';
import { useNavigation } from '@react-navigation/native';

import * as RNIap from 'react-native-iap';
import { useMutation } from '@apollo/client';
import { VERIFY_RECEIPT_MUTATION } from '../graphql/mutations';

const itemSkus = ['com.safetycamai.monthly']; // Product ID from App Store Connect

const AlertDialog = () => {
  const navigation = useNavigation();
  const { alertInfo, closeAlert } = useAlert();
  const [verifyReceipt] = useMutation(VERIFY_RECEIPT_MUTATION);
  const [processing, setProcessing] = React.useState(false);

  React.useEffect(() => {
    let purchaseUpdateSubscription = null;
    let purchaseErrorSubscription = null;

    const initIAP = async () => {
      try {
        await RNIap.initConnection();
        await RNIap.getSubscriptions({ skus: itemSkus });
      } catch (err) {
        console.warn('IAP Init Error:', err);
      }
    };

    if (alertInfo.isOpen) {
      initIAP();

      purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase) => {
        const receipt = purchase.transactionReceipt;
        if (receipt) {
          try {
            setProcessing(true);
            const { data } = await verifyReceipt({
              variables: { receipt }
            });

            // Backend returns Boolean (true = success, false = failure)
            if (data?.verifyApplePayment === true) {
              await RNIap.finishTransaction({ purchase, isConsumable: false });
              closeAlert();
              // Optional: Show success message or refresh user state
            } else {
              console.warn('Receipt verification failed');
            }
          } catch (error) {
            console.error('Verification Error', error);
          } finally {
            setProcessing(false);
          }
        }
      });

      purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
        console.warn('Purchase Error', error);
        setProcessing(false);
      });
    }

    return () => {
      if (purchaseUpdateSubscription) purchaseUpdateSubscription.remove();
      if (purchaseErrorSubscription) purchaseErrorSubscription.remove();
      RNIap.endConnection();
    };
  }, [alertInfo.isOpen]);

  const upgradeNow = async () => {
    // DEVELOPMENT MODE: Skip Apple IAP and send mock receipt to backend
    if (__DEV__) {
      console.log('🔧 DEV MODE: Simulating purchase and sending mock receipt to backend...');
      try {
        setProcessing(true);

        // Create a mock receipt (base64 encoded string)
        const mockReceipt = btoa(JSON.stringify({
          productId: 'com.safetycamai.monthly',
          transactionId: 'mock_' + Date.now(),
          purchaseDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          environment: 'development',
          bundleId: 'org.reactjs.native.example.safetycamai'
        }));

        console.log('📤 Sending mock receipt to backend:', mockReceipt.substring(0, 50) + '...');

        // Send to backend
        const { data } = await verifyReceipt({
          variables: { receipt: mockReceipt }
        });

        console.log('📥 Backend response:', data);

        // Backend returns Boolean (true = success, false = failure)
        if (data?.verifyApplePayment === true) {
          console.log('✅ Backend accepted the receipt!');
          closeAlert();
          // Optional: Show success message
        } else {
          console.warn('❌ Backend rejected the receipt');
        }
      } catch (error) {
        console.error('❌ Error sending to backend:', error);
      } finally {
        setProcessing(false);
      }
      return;
    }

    // PRODUCTION MODE: Use real Apple IAP
    try {
      setProcessing(true);
      await RNIap.requestSubscription({ sku: itemSkus[0] });
    } catch (err) {
      console.warn(err.message);
      setProcessing(false);
    }
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
                  style={[styles.upgradeButton, processing && { opacity: 0.7 }]}
                  onPress={upgradeNow}
                  disabled={processing}
                >
                  <Text style={styles.upgradeText}>
                    {processing ? 'Processing...' : 'Subscribe ($9.19/mo)'}
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
