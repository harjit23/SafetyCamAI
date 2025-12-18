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

        // Clear the redirectToSubscription flag since we've reached the subscription screen
        // This prevents the flag from persisting and causing repeated redirects on future logins
        AsyncStorage.removeItem('redirectToSubscription').catch(() => {});

        const initIAP = async () => {
            try {
                await RNIap.initConnection();
                const availableProducts = await RNIap.getSubscriptions({ skus: itemSkus });
                console.log('📦 Available Products:', availableProducts);
                if (availableProducts.length === 0) {
                    console.warn('⚠️ No products found. Check App Store Connect configuration.');
                }
                setProducts(availableProducts);
            } catch (err) {
                console.warn('IAP Init Error:', err);
                Toast.show({
                    type: 'error',
                    text1: 'Error',
                    text2: 'Failed to load subscription options',
                });
            }
        };

        initIAP();

        // Listen for purchase updates
        // Listen for purchase updates
        purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase) => {
            let receipt = purchase.transactionReceipt;

            // Ensure we have a valid receipt for iOS
            if (!receipt) {
                try {
                    receipt = await RNIap.getReceiptIOS();
                } catch (err) {
                    console.warn('Failed to get receipt from iOS:', err);
                }
            }

            if (receipt) {
                console.log('🧾 Real Receipt Length:', receipt.length);
                // Real receipts are usually > 1000 chars
                if (receipt.length < 100) {
                    console.warn('⚠️ Warning: Receipt seems too short to be valid!');
                }
                try {
                    setProcessing(true);
                    console.log('📤 Sending receipt to backend for verification...');

                    const { data } = await verifyReceipt({
                        variables: { receipt },
                    });

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
                        Toast.show({
                            type: 'error',
                            text1: 'Verification Failed',
                            text2: 'Receipt verification failed',
                        });
                    }
                } catch (error) {
                    console.error('❌ Error verifying receipt:', error);
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'Failed to verify payment',
                    });
                } finally {
                    setProcessing(false);
                }
            }
        });

        purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
            if (error.responseCode !== '2') {
                // User cancelled
                console.warn('Purchase Error', error);
                Toast.show({
                    type: 'error',
                    text1: 'Purchase Failed',
                    text2: error.message || 'An error occurred',
                });
            }
            setProcessing(false);
        });

        return () => {
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
                    text2: 'No subscription products available',
                });
                setProcessing(false);
                return;
            }

            // Request subscription - this triggers purchaseUpdatedListener on success
            await RNIap.requestSubscription({ sku: itemSkus[0] });
            console.log('✅ Purchase request sent to Apple');
        } catch (err) {
            console.warn('❌ Purchase error:', err.message);
            Toast.show({
                type: 'error',
                text1: 'Purchase Failed',
                text2: err.message || 'An error occurred',
            });
            setProcessing(false);
        }
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
                                    <ActivityIndicator size="small" color="#0C66E4" />
                                )}
                                <Text style={styles.pricePeriod}>per month</Text>
                            </View>

                            {/* Subscribe Button */}
                            <TouchableOpacity
                                style={[styles.subscribeButton, processing && { opacity: 0.7 }]}
                                onPress={handleSubscribe}
                                disabled={processing}
                            >
                                {processing ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.subscribeText}>Subscribe Now</Text>
                                )}
                            </TouchableOpacity>

                            {/* Terms */}
                            <Text style={styles.terms}>
                                Subscription automatically renews unless cancelled 24 hours before the
                                end of the current period.
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
    },
});
