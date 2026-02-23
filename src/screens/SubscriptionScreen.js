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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMutation } from '@apollo/client';
import Toast from 'react-native-toast-message';
import * as RNIap from 'react-native-iap';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { VERIFY_RECEIPT_MUTATION, REFRESH_TOKEN } from '../graphql/mutations';
import { useLoader } from '../context/LoaderContext';

import { useAuth } from '../context/AuthContext';

const itemSkus = ['com.safetycamai.monthly'];

export default function SubscriptionScreen() {
    const navigation = useNavigation();
    const { refreshUser } = useAuth();
    const [verifyReceipt] = useMutation(VERIFY_RECEIPT_MUTATION);
    const [refreshTokenMutation] = useMutation(REFRESH_TOKEN);
    const { showLoader, hideLoader } = useLoader();
    const [processing, setProcessing] = useState(false);
    const [products, setProducts] = useState([]);
    const [fetchError, setFetchError] = useState(null);
    const isUserInitiatedRef = React.useRef(false);

    // ─── Fetch products every time screen comes into focus ───────────────────
    useFocusEffect(
        React.useCallback(() => {
            let isActive = true;

            const fetchProducts = async () => {
                try {
                    setFetchError(null);
                    if (products.length === 0) showLoader('Loading options...');
                    await RNIap.initConnection();
                    const availableProducts = await RNIap.getSubscriptions({ skus: itemSkus });
                    if (isActive) {
                        console.log('📦 Fetched products:', availableProducts.length);
                        setProducts(availableProducts);
                    }
                } catch (err) {
                    console.warn('IAP Fetch Error:', err);
                    if (isActive) {
                        setFetchError('Failed to load subscription options.');
                    }
                } finally {
                    if (isActive) hideLoader();
                }
            };

            fetchProducts();

            return () => { isActive = false; };
        }, [])
    );

    // ─── Setup purchase listeners ─────────────────────────────────────────────
    useEffect(() => {
        let purchaseUpdateSubscription = null;
        let purchaseErrorSubscription = null;
        let isSubscribed = true;

        AsyncStorage.removeItem('redirectToSubscription').catch(() => { });

        const setupListeners = async () => {
            try { await RNIap.initConnection(); } catch (e) { }

            purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase) => {
                console.log('🔔 Purchase Update Listener Triggered:', purchase?.transactionId);
                if (!purchase) return;

                if (!isUserInitiatedRef.current) {
                    console.log('⚠️ Ignoring purchase update: Not initiated by user action on this screen');
                    try { await RNIap.finishTransaction({ purchase, isConsumable: false }); } catch (e) { }
                    return;
                }

                let receipt = purchase.transactionReceipt;
                if (!receipt && Platform.OS === 'ios') {
                    try { receipt = await RNIap.getReceiptIOS(); } catch (err) { }
                }

                if (!receipt) {
                    console.warn('❌ No receipt found in purchase update');
                    if (isSubscribed) { setProcessing(false); hideLoader(); }
                    return;
                }

                try {
                    if (isSubscribed) { setProcessing(true); showLoader('Verifying purchase...'); }
                    console.log('📤 Verifying receipt with backend...');
                    const { data } = await verifyReceipt({ variables: { receipt } });

                    if (data?.verifyApplePayment === true) {
                        console.log('✅ Receipt verified successfully');
                        try {
                            const token = await AsyncStorage.getItem('accessToken');
                            const refreshToken = await AsyncStorage.getItem('refreshToken');
                            if (token && refreshToken) {
                                const { data: refreshData } = await refreshTokenMutation({ variables: { token, refreshToken } });
                                if (refreshData?.refreshToken) {
                                    await AsyncStorage.setItem('accessToken', refreshData.refreshToken.token);
                                    await AsyncStorage.setItem('refreshToken', refreshData.refreshToken.refreshToken);
                                }
                            }
                        } catch (refreshErr) { console.warn('Token refresh failed:', refreshErr); }

                        await refreshUser();
                        await RNIap.finishTransaction({ purchase, isConsumable: false });
                        Toast.show({ type: 'success', text1: 'Success', text2: 'Subscription activated successfully!' });
                        isUserInitiatedRef.current = false;
                        setTimeout(() => navigation.navigate('Home'), 1500);
                    } else {
                        console.warn('❌ Receipt verification failed on backend');
                        await RNIap.finishTransaction({ purchase, isConsumable: false });
                        Toast.show({ type: 'error', text1: 'Verification Failed', text2: 'Receipt verification failed.' });
                        isUserInitiatedRef.current = false;
                    }
                } catch (error) {
                    console.error('❌ Error verifying receipt:', error);
                    try { await RNIap.finishTransaction({ purchase, isConsumable: false }); } catch (e) { }
                    Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to verify payment.' });
                    isUserInitiatedRef.current = false;
                } finally {
                    if (isSubscribed) { setProcessing(false); hideLoader(); }
                }
            });

            purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
                if (error.responseCode !== '2' && error.responseCode !== 2) {
                    Toast.show({ type: 'error', text1: 'Purchase Failed', text2: error.message || 'An error occurred' });
                }
                if (isSubscribed) { setProcessing(false); hideLoader(); }
                isUserInitiatedRef.current = false;
            });
        };

        setupListeners();

        return () => {
            isSubscribed = false;
            if (purchaseUpdateSubscription) purchaseUpdateSubscription.remove();
            if (purchaseErrorSubscription) purchaseErrorSubscription.remove();
            RNIap.endConnection();
        };
    }, [verifyReceipt, navigation]);

    // ─── Handlers ────────────────────────────────────────────────────────────

    const retryFetch = async () => {
        showLoader('Retrying...');
        setFetchError(null);
        try {
            await RNIap.initConnection();
            const availableProducts = await RNIap.getSubscriptions({ skus: itemSkus });
            setProducts(availableProducts);
            if (availableProducts.length === 0) setFetchError('No products found. Please try again later.');
        } catch (err) {
            setFetchError('Failed to load products. Check your connection.');
        } finally {
            hideLoader();
        }
    };

    const handleSubscribe = async () => {
        try {
            console.log('🚀 Initiating subscription purchase...');
            isUserInitiatedRef.current = true;
            setProcessing(true);
            showLoader('Connecting to Store...');

            // Retry fetch inline if products are empty
            if (products.length === 0) {
                try {
                    const availableProducts = await RNIap.getSubscriptions({ skus: itemSkus });
                    setProducts(availableProducts);
                    if (availableProducts.length === 0) throw new Error('No products available');
                } catch (e) {
                    Toast.show({ type: 'error', text1: 'Error', text2: 'No products available. Please tap Retry.' });
                    setProcessing(false);
                    hideLoader();
                    isUserInitiatedRef.current = false;
                    return;
                }
            }

            await RNIap.requestSubscription({ sku: itemSkus[0] });
        } catch (err) {
            console.error('❌ Subscription Request Error:', err);
            isUserInitiatedRef.current = false;
            if (err.code === 'E_ALREADY_OWNED') {
                Toast.show({ type: 'success', text1: 'Already Subscribed', text2: 'You already have an active subscription!' });
                setTimeout(() => navigation.navigate('Home'), 1500);
            } else if (err.code !== 'E_USER_CANCELLED') {
                Toast.show({ type: 'error', text1: 'Purchase Failed', text2: err.message || 'An error occurred.' });
            }
        } finally {
            setProcessing(false);
            hideLoader();
        }
    };

    const handleRestorePurchase = async () => {
        try {
            console.log('🔄 Initiating restore purchase...');
            isUserInitiatedRef.current = true;
            setProcessing(true);
            showLoader('Restoring purchases...');
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
                try { receipt = await RNIap.getReceiptIOS(); } catch (err) { }
            }

            if (!receipt) throw new Error('Could not retrieve purchase receipt');

            const { data } = await verifyReceipt({ variables: { receipt } });

            if (data?.verifyApplePayment === true) {
                try {
                    const token = await AsyncStorage.getItem('accessToken');
                    const refreshToken = await AsyncStorage.getItem('refreshToken');
                    if (token && refreshToken) {
                        const { data: refreshData } = await refreshTokenMutation({ variables: { token, refreshToken } });
                        if (refreshData?.refreshToken) {
                            await AsyncStorage.setItem('accessToken', refreshData.refreshToken.token);
                            await AsyncStorage.setItem('refreshToken', refreshData.refreshToken.refreshToken);
                        }
                    }
                } catch (refreshErr) { }

                await refreshUser();
                Toast.show({ type: 'success', text1: 'Restore Successful', text2: 'Your premium access has been restored.' });
                setTimeout(() => navigation.navigate('Home'), 1500);
            } else {
                Toast.show({ type: 'error', text1: 'Restore Failed', text2: 'Verification failed.' });
            }
        } catch (err) {
            Toast.show({ type: 'error', text1: 'Restore Error', text2: err.message || 'An error occurred.' });
        } finally {
            setProcessing(false);
            hideLoader();
        }
    };

    const handleCancel = () => navigation.goBack();

    // ─── Render ───────────────────────────────────────────────────────────────
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
                                    <Text style={styles.benefitText}>Advanced Image Analysis</Text>
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

                                {/* Retry button shown only on error */}
                                {fetchError && (
                                    <View style={styles.errorContainer}>
                                        <Text style={styles.errorText}>{fetchError}</Text>
                                        <TouchableOpacity style={styles.retryButton} onPress={retryFetch}>
                                            <Text style={styles.retryText}>Retry</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
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
                                            <Text style={styles.applePayText}>Subscribe</Text>
                                        </View>
                                    )}
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

                            {/* Legal text with EULA + Privacy Policy links */}
                            <Text style={styles.terms}>
                                Subscription automatically renews unless cancelled 24 hours before the
                                end of the current period. By subscribing, you agree to our{' '}
                                <Text
                                    style={styles.linkText}
                                    onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
                                >
                                    Terms of Use (EULA)
                                </Text>
                                {' '}and{' '}
                                <Text
                                    style={styles.linkText}
                                    onPress={() => Linking.openURL('https://safetycamai.com/privacy/')}
                                >
                                    Privacy Policy
                                </Text>.
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
    errorContainer: {
        marginTop: 12,
        padding: 10,
        backgroundColor: '#ffebec',
        borderRadius: 8,
        alignItems: 'center',
        width: '100%',
    },
    errorText: { color: '#d32f2f', textAlign: 'center', marginBottom: 8, fontSize: 12 },
    retryButton: {
        backgroundColor: '#d32f2f',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    retryText: { color: '#fff', fontWeight: '600', fontSize: 12 },
    terms: { fontSize: 12, color: '#999', textAlign: 'center', lineHeight: 20, marginTop: 16 },
    linkText: { textDecorationLine: 'underline', color: '#0C66E4' },
    paymentOptionsContainer: { marginTop: 8 },
    paymentOptionsTitle: { fontSize: 16, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 16 },
    buttonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    applePayButton: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
    applePayText: { color: '#fff', fontSize: 18, fontWeight: '700', marginLeft: 10 },
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