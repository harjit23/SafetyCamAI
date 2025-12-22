// src/screens/SubscriptionScreen.js
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    StatusBar,
    Linking,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useMutation } from '@apollo/client';
import Toast from 'react-native-toast-message';
import * as RNIap from 'react-native-iap';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { VERIFY_RECEIPT_MUTATION } from '../graphql/mutations';

const itemSkus = ['com.safetycamai.monthly'];

export default function SubscriptionScreen() {
    const navigation = useNavigation();
    const [verifyReceipt] = useMutation(VERIFY_RECEIPT_MUTATION);
    const [processing, setProcessing] = useState(false);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        let purchaseUpdateSubscription = null;
        let purchaseErrorSubscription = null;
        let isSubscribed = true;

        AsyncStorage.removeItem('redirectToSubscription').catch(() => { });

        const initIAP = async () => {
            try {
                await RNIap.initConnection();
                const availableProducts = await RNIap.getSubscriptions({ skus: itemSkus });
                if (isSubscribed) {
                    setProducts(availableProducts);
                }
            } catch (err) {
                console.warn('IAP Init Error:', err);
                if (isSubscribed) {
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'Failed to load subscription options',
                    });
                }
            }
        };

        initIAP();

        purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase) => {
            if (!purchase) return;
            let receipt = purchase.transactionReceipt;
            if (!receipt && Platform.OS === 'ios') {
                try {
                    receipt = await RNIap.getReceiptIOS();
                } catch (err) {
                    console.warn('Failed to get receipt from iOS:', err);
                }
            }

            if (!receipt) {
                if (isSubscribed) setProcessing(false);
                return;
            }

            try {
                if (isSubscribed) setProcessing(true);
                const { data } = await verifyReceipt({ variables: { receipt } });

                if (data?.verifyApplePayment === true) {
                    await RNIap.finishTransaction({ purchase, isConsumable: false });
                    Toast.show({ type: 'success', text1: 'Success', text2: 'Subscription activated successfully!' });
                    setTimeout(() => navigation.navigate('Home'), 1500);
                } else {
                    await RNIap.finishTransaction({ purchase, isConsumable: false });
                    Toast.show({ type: 'error', text1: 'Verification Failed', text2: 'Receipt verification failed.' });
                }
            } catch (error) {
                console.error('❌ Error verifying receipt:', error);
                try {
                    await RNIap.finishTransaction({ purchase, isConsumable: false }); } catch (e) {} 
                    Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to verify payment.' });
                } finally {
                    if (isSubscribed) setProcessing(false);
                }
            });

        purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
            if (error.responseCode !== '2' && error.responseCode !== 2) {
                Toast.show({ type: 'error', text1: 'Purchase Failed', text2: error.message || 'An error occurred' });
            }
            if (isSubscribed) setProcessing(false);
        });

        return () => {
            isSubscribed = false;
            if (purchaseUpdateSubscription) purchaseUpdateSubscription.remove();
            if (purchaseErrorSubscription) purchaseErrorSubscription.remove();
            RNIap.endConnection();
        };
    }, [verifyReceipt, navigation]);

    const handleSubscribe = async () => {
        try {
            setProcessing(true);
            if (products.length === 0) {
                Toast.show({ type: 'error', text1: 'Error', text2: 'No products available.' });
                setProcessing(false);
                return;
            }
            await RNIap.requestSubscription({ sku: itemSkus[0] });
        } catch (err) {
            if (err.code === 'E_ALREADY_OWNED') {
                Toast.show({ type: 'success', text1: 'Already Subscribed', text2: 'You already have an active subscription!' });
                setTimeout(() => navigation.navigate('Home'), 1500);
            } else if (err.code !== 'E_USER_CANCELLED') {
                Toast.show({ type: 'error', text1: 'Purchase Failed', text2: err.message || 'An error occurred.' });
            }
        } finally {
            setProcessing(false);
        }
    };

    const handleRestorePurchase = async () => {
        try {
            setProcessing(true);
            const availablePurchases = await RNIap.getAvailablePurchases();
            
            if (!availablePurchases || availablePurchases.length === 0) {
                Toast.show({ type: 'info', text1: 'No Purchases Found', text2: 'We couldn\'t find any active subscriptions to restore.' });
                return;
            }

            const validPurchase = availablePurchases
                .filter(p => itemSkus.includes(p.productId))
                .sort((a, b) => b.transactionDate - a.transactionDate)[0];

            if (!validPurchase) {
                Toast.show({ type: 'info', text1: 'No Valid Subscription', text2: 'No active SafetyCam AI subscription found.' });
                return;
            }

            let receipt = validPurchase.transactionReceipt;
            if (Platform.OS === 'ios' && !receipt) {
                try {
                    receipt = await RNIap.getReceiptIOS();
                } catch (err) {
                    console.warn('Failed to get receipt from iOS during restore:', err);
                }
            }

            if (!receipt) throw new Error('Could not retrieve purchase receipt');

            const { data } = await verifyReceipt({ variables: { receipt } });

            if (data?.verifyApplePayment === true) {
                Toast.show({ type: 'success', text1: 'Restore Successful', text2: 'Your premium access has been restored.' });
                setTimeout(() => navigation.navigate('Home'), 1500);
            } else {
                Toast.show({ type: 'error', text1: 'Restore Failed', text2: 'Verification failed.' });
            }
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Restore Error', text2: err.message || 'An error occurred.' });
        } finally {
            setProcessing(false);
        }
    };

    const handleStripePayment = async () => {
        const STRIPE_PAYMENT_URL = 'https://safetycamai.com';
        try {
            const canOpen = await Linking.canOpenURL(STRIPE_PAYMENT_URL);
            if (canOpen) await Linking.openURL(STRIPE_PAYMENT_URL);
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to open payment page' });
        }
    };

    const handleCancel = () => navigation.goBack();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
            <StatusBar barStyle="light-content" backgroundColor="#007bff" />
            <LinearGradient colors={['#007bff', '#69bfff']} style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
                            <Icon name="arrow-left" size={20} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Upgrade to Premium</Text>
                    </View>

                    <View style={styles.content}>
                        <View style={styles.card}>
                            <Text style={styles.title}>SafetyCam AI Premium</Text>
                            <Text style={styles.subtitle}>Unlock unlimited access to all features</Text>

                            <View style={styles.benefitsContainer}>
                                <View style={styles.benefitItem}>
                                    <Icon name="check-circle" size={24} color="#0C66E4" />
                                    <Text style={styles.benefitText}>Unlimited Searches</Text>
                                </View>
                                <View style={styles.benefitItem}>
                                    <Icon name="check-circle" size={24} color="#0C66E4" />
                                    <Text style={styles.benefitText}>Advanced Facial Recognition</Text>
                                </View>
                                <View style={styles.benefitItem}>
                                    <Icon name="check-circle" size={24} color="#0C66E4" />
                                    <Text style={styles.benefitText}>Priority Support</Text>
                                </View>
                                <View style={styles.benefitItem}>
                                    <Icon name="check-circle" size={24} color="#0C66E4" />
                                    <Text style={styles.benefitText}>No Ads</Text>
                                </View>
                            </View>

                            <View style={styles.pricingContainer}>
                                {products.length > 0 ? (
                                    <Text style={styles.price}>{products[0].localizedPrice}</Text>
                                ) : (
                                    <Text style={styles.price}>$9.99</Text>
                                )}
                                <Text style={styles.pricePeriod}>per month</Text>
                            </View>

                            <View style={styles.paymentOptionsContainer}>
                                <Text style={styles.paymentOptionsTitle}>Choose Payment Method</Text>

                                <TouchableOpacity
                                    style={[styles.applePayButton, processing && { opacity: 0.7 }]}
                                    onPress={handleSubscribe}
                                    disabled={processing}
                                >
                                    {processing ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <View style={styles.buttonContent}>
                                            <Icon name="apple" size={22} color="#fff" />
                                            <Text style={styles.applePayText}>Pay with Apple</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.stripeButton} onPress={handleStripePayment}>
                                    <View style={styles.buttonContent}>
                                        <Icon name="cc-stripe" size={20} color="#fff" />
                                        <Text style={styles.stripeText}>Pay Via Stripe</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.restoreButton}
                                    onPress={handleRestorePurchase}
                                    disabled={processing}
                                >
                                    <Text style={styles.restoreText}>Already a member? Restore Purchase</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.terms}>
                                Subscription automatically renews unless cancelled 24 hours before the
                                end of the current period. By subscribing, you agree to our Terms of Service.
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </LinearGradient>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, padding: 20 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
    backButton: { padding: 10, marginRight: 10 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
    content: { flex: 1, justifyContent: 'center' },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    title: { fontSize: 28, fontWeight: '700', color: '#0C66E4', textAlign: 'center', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 32 },
    benefitsContainer: { marginBottom: 32 },
    benefitItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    benefitText: { fontSize: 16, color: '#333', marginLeft: 12, fontWeight: '500' },
    pricingContainer: {
        alignItems: 'center',
        marginBottom: 24,
        paddingVertical: 20,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
    },
    price: { fontSize: 48, fontWeight: '700', color: '#0C66E4' },
    pricePeriod: { fontSize: 16, color: '#666', marginTop: 4 },
    terms: { fontSize: 12, color: '#999', textAlign: 'center', lineHeight: 18, marginTop: 16 },
    paymentOptionsContainer: { marginTop: 8 },
    paymentOptionsTitle: { fontSize: 16, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 16 },
    buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    applePayButton: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
    applePayText: { color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 10 },
    stripeButton: { backgroundColor: '#635BFF', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
    stripeText: { color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 10 },
    cancelButton: {
        backgroundColor: 'transparent',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ccc',
        alignItems: 'center',
    },
    cancelText: { color: '#666', fontSize: 16, fontWeight: '600' },
    restoreButton: { marginTop: 20, paddingVertical: 10, alignItems: 'center' },
    restoreText: { color: '#007bff', fontSize: 14, fontWeight: '500', textDecorationLine: 'underline' },
});