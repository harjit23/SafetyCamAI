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
        let isSubscribed = true; // Track if component is mounted

        // Clear the redirectToSubscription flag since we've reached the subscription screen
        // This prevents the flag from persisting and causing repeated redirects on future logins
        AsyncStorage.removeItem('redirectToSubscription').catch(() => {});

        const initIAP = async () => {
            try {
                await RNIap.initConnection();
                
                // Check for existing purchases (active subscriptions)
                try {
                    const existingPurchases = await RNIap.getAvailablePurchases();
                    console.log('📦 Existing purchases found:', existingPurchases?.length || 0);
                    
                    // If user has active subscription(s), verify with backend
                    if (existingPurchases && existingPurchases.length > 0) {
                        console.log('🔄 User has existing purchases, checking subscription status...');
                        // We'll let the user know they may already have a subscription
                        // The actual verification happens when they try to subscribe
                    }
                } catch (pendingErr) {
                    console.warn('Error checking existing purchases:', pendingErr);
                }
                
                const availableProducts = await RNIap.getSubscriptions({ skus: itemSkus });
                console.log('📦 Available Products:', availableProducts);
                if (availableProducts.length === 0) {
                    console.warn('⚠️ No products found. Check App Store Connect configuration.');
                }
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

        // Listen for purchase updates (triggered when user clicks Subscribe or has pending purchase)
        purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase) => {
            console.log('📥 Purchase update received:', purchase?.transactionId);
            
            if (!purchase) {
                console.log('⚠️ Received empty purchase update, ignoring...');
                if (isSubscribed) setProcessing(false);
                return;
            }

            let receipt = purchase.transactionReceipt;

            // Ensure we have a valid receipt for iOS
            if (!receipt) {
                try {
                    receipt = await RNIap.getReceiptIOS();
                    console.log('📥 Got receipt from getReceiptIOS, length:', receipt?.length);
                } catch (err) {
                    console.warn('Failed to get receipt from iOS:', err);
                    if (isSubscribed) setProcessing(false);
                    return;
                }
            }

            if (!receipt) {
                console.warn('⚠️ No receipt available');
                if (isSubscribed) setProcessing(false);
                return;
            }

            console.log('🧾 Receipt Length:', receipt.length);
            
            try {
                if (isSubscribed) setProcessing(true);
                console.log('📤 Sending receipt to backend for verification...');

                const { data } = await verifyReceipt({
                    variables: { receipt },
                });

                console.log('📥 Backend response:', data);

                // Backend returns Boolean (true = success, false = failure)
                if (data?.verifyApplePayment === true) {
                    console.log('✅ Payment verified successfully!');
                    await RNIap.finishTransaction({ purchase, isConsumable: false });

                    Toast.show({
                        type: 'success',
                        text1: 'Success',
                        text2: 'Subscription activated successfully!',
                    });

                    // Navigate back to Home after successful payment
                    setTimeout(() => {
                        navigation.navigate('Home');
                    }, 1500);
                } else {
                    console.warn('❌ Backend rejected the receipt');
                    // Finish the transaction to clear it from the queue
                    await RNIap.finishTransaction({ purchase, isConsumable: false });
                    
                    Toast.show({
                        type: 'error',
                        text1: 'Verification Failed',
                        text2: 'Receipt verification failed. Please try again.',
                    });
                }
            } catch (error) {
                console.error('❌ Error verifying receipt:', error);
                // Finish the transaction to clear it
                try {
                    await RNIap.finishTransaction({ purchase, isConsumable: false });
                } catch (e) {
                    console.warn('Failed to finish transaction:', e);
                }
                
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to verify payment. Please try again.',
                });
            } finally {
                if (isSubscribed) setProcessing(false);
            }
        });

        purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
            console.log('❌ Purchase error received:', error);
            // responseCode 2 = User cancelled
            if (error.responseCode !== '2' && error.responseCode !== 2) {
                console.warn('Purchase Error:', error);
                Toast.show({
                    type: 'error',
                    text1: 'Purchase Failed',
                    text2: error.message || 'An error occurred',
                });
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
        // MOCK MODE: Only for UI testing without IAP (manual flag)
        // Set to true ONLY when testing UI without real purchases
        const USE_MOCK_FOR_UI_TESTING = false;

        if (USE_MOCK_FOR_UI_TESTING) {
            console.log('🔧 MOCK MODE: Simulating purchase for UI testing...');
            try {
                setProcessing(true);

                // Create a mock receipt (base64 encoded string)
                const mockReceipt = btoa(
                    JSON.stringify({
                        productId: 'com.safetycamai.monthly',
                        transactionId: 'mock_' + Date.now(),
                        purchaseDate: new Date().toISOString(),
                        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                        environment: 'mock',
                        bundleId: 'org.reactjs.native.example.safetycamai',
                    })
                );

                console.log('📤 Generated mock receipt:', mockReceipt.substring(0, 50) + '...');

                // SIMULATE BACKEND DELAY
                await new Promise(resolve => setTimeout(resolve, 1000));

                // BYPASS BACKEND VERIFICATION FOR MOCK TESTING
                // (Backend will reject mock receipts with status 21002)
                console.log('✅ MOCK MODE: Bypassing backend verification (Simulating Success)');

                Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Subscription active! (Mock Mode)',
                });

                // Navigate back to Home after successful payment
                setTimeout(() => {
                    navigation.navigate('Home');
                }, 1500);

            } catch (error) {
                console.error('❌ Error in mock mode:', error);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to simulate receipt',
                });
            } finally {
                setProcessing(false);
            }
            return;
        }

        // REAL IAP MODE: Works with both Sandbox and Production
        // This will trigger purchaseUpdatedListener which calls the backend
        console.log('🛒 Starting real IAP purchase flow...');
        try {
            setProcessing(true);

            // Check if products are loaded
            if (products.length === 0) {
                console.warn('⚠️ No products available. Cannot start purchase.');
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'No subscription products available. Pull down to refresh.',
                });
                setProcessing(false);
                return;
            }

            // Set a timeout to prevent infinite loading if purchase flow doesn't respond
            const purchaseTimeout = setTimeout(() => {
                console.warn('⏰ Purchase request timed out');
                setProcessing(false);
                Toast.show({
                    type: 'info',
                    text1: 'Purchase Pending',
                    text2: 'If you completed the purchase, it will be verified shortly.',
                });
            }, 60000); // 60 second timeout

            // Request subscription - this triggers purchaseUpdatedListener on success
            console.log('📤 Requesting subscription for SKU:', itemSkus[0]);
            await RNIap.requestSubscription({ sku: itemSkus[0] });
            console.log('✅ Purchase request sent to Apple');
            
            // Clear timeout - the purchaseUpdatedListener will handle the rest
            clearTimeout(purchaseTimeout);
        } catch (err) {
            console.warn('❌ Purchase error:', err.message, err.code);
            
            // Check for specific error codes
            if (err.code === 'E_USER_CANCELLED' || err.message?.includes('cancelled')) {
                console.log('👤 User cancelled the purchase');
                // Don't show error for user cancellation
            } else if (err.code === 'E_ALREADY_OWNED' || err.message?.includes('already own')) {
                Toast.show({
                    type: 'success',
                    text1: 'Already Subscribed',
                    text2: 'You already have an active subscription!',
                });
                setTimeout(() => navigation.navigate('Home'), 1500);
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Purchase Failed',
                    text2: err.message || 'An error occurred. Please try again.',
                });
            }
            setProcessing(false);
        }
    };

    // Handle Stripe payment - opens external browser (Safari)
    const handleStripePayment = async () => {
        // Replace this URL with your actual Stripe payment page
        const STRIPE_PAYMENT_URL = 'https://your-website.com/subscribe';
        
        try {
            const canOpen = await Linking.canOpenURL(STRIPE_PAYMENT_URL);
            if (canOpen) {
                await Linking.openURL(STRIPE_PAYMENT_URL);
            } else {
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Unable to open payment page',
                });
            }
        } catch (error) {
            console.error('Error opening Stripe URL:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'Failed to open payment page',
            });
        }
    };

    // Handle cancel
    const handleCancel = () => {
        navigation.goBack();
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
            <StatusBar barStyle="light-content" backgroundColor="#007bff" />
            <LinearGradient colors={['#007bff', '#69bfff']} style={styles.container}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                        >
                            <Icon name="arrow-left" size={20} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Upgrade to Premium</Text>
                    </View>

                    {/* Main Content */}
                    <View style={styles.content}>
                        <View style={styles.card}>
                            <Text style={styles.title}>SafetyCam AI Premium</Text>
                            <Text style={styles.subtitle}>
                                Unlock unlimited access to all features
                            </Text>

                            {/* Benefits */}
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

                            {/* Pricing */}
                            <View style={styles.pricingContainer}>
                                {products.length > 0 ? (
                                    <Text style={styles.price}>{products[0].localizedPrice}</Text>
                                ) : (
                                    <Text style={styles.price}>$9.99</Text>
                                )}
                                <Text style={styles.pricePeriod}>per month</Text>
                            </View>

                            {/* Payment Options */}
                            <View style={styles.paymentOptionsContainer}>
                                <Text style={styles.paymentOptionsTitle}>Choose Payment Method</Text>

                                {/* Apple Pay Button */}
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

                                {/* Stripe Button - Opens in Safari */}
                                <TouchableOpacity
                                    style={styles.stripeButton}
                                    onPress={handleStripePayment}
                                >
                                    <View style={styles.buttonContent}>
                                        <Icon name="credit-card" size={20} color="#fff" />
                                        <Text style={styles.stripeText}>Pay with Card</Text>
                                    </View>
                                </TouchableOpacity>

                                {/* Cancel Button */}
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={handleCancel}
                                >
                                    <Text style={styles.cancelText}>Cancel</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Terms */}
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
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    backButton: {
        padding: 10,
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
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
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#0C66E4',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 32,
    },
    benefitsContainer: {
        marginBottom: 32,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    benefitText: {
        fontSize: 16,
        color: '#333',
        marginLeft: 12,
        fontWeight: '500',
    },
    pricingContainer: {
        alignItems: 'center',
        marginBottom: 24,
        paddingVertical: 20,
        backgroundColor: '#f8f9fa',
        borderRadius: 12,
    },
    price: {
        fontSize: 48,
        fontWeight: '700',
        color: '#0C66E4',
    },
    pricePeriod: {
        fontSize: 16,
        color: '#666',
        marginTop: 4,
    },
    subscribeButton: {
        backgroundColor: '#0C66E4',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    subscribeText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    terms: {
        fontSize: 12,
        color: '#999',
        textAlign: 'center',
        lineHeight: 18,
        marginTop: 16,
    },
    // Payment Options Styles
    paymentOptionsContainer: {
        marginTop: 8,
    },
    paymentOptionsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        textAlign: 'center',
        marginBottom: 16,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    applePayButton: {
        backgroundColor: '#000',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    applePayText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 10,
    },
    stripeButton: {
        backgroundColor: '#635BFF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    stripeText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 10,
    },
    cancelButton: {
        backgroundColor: 'transparent',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ccc',
        alignItems: 'center',
    },
    cancelText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
    },
});
