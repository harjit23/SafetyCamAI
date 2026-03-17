import React from 'react';
import { StyleSheet, ActivityIndicator, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useNavigation } from '@react-navigation/native';

export default function StripePaymentScreen() {
    const navigation = useNavigation();
    const STRIPE_URL = 'https://buy.stripe.com/14k5mlbRx1VGfBe003?locale=en&__embed_source=buy_btn_1RNajwKLsA7J6NNllOqM5WFB';

    const goToHome = () => {
        navigation.reset({
            index: 0,
            routes: [{ name: 'Home' }],
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="black" />
            {/* Back Button */}
            <TouchableOpacity
                onPress={goToHome}
                style={styles.backButton}
            >
                <Icon name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>

            <WebView
                source={{ uri: STRIPE_URL }}
                startInLoadingState
                renderLoading={() => (
                    <ActivityIndicator
                        color="#0C66E4"
                        size="large"
                        style={styles.loading}
                    />
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "black" },
    loading: { 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'black'
    },
    backButton: {
        position: 'absolute',
        top: 20,
        left: 20,
        zIndex: 10,
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
});
