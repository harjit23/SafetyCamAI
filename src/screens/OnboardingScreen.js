// OnboardingScreen.js - 3-screen onboarding flow for Apple compliance
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const ONBOARDING_KEY = 'onboarding_completed';

const slides = [
    {
        id: 1,
        icon: 'search',
        title: 'Visual Similarity Analysis',
        subtitle: 'What SafetyCam AI Does',
        description:
            'SafetyCam AI uses advanced image analysis to discover visually similar images found on publicly accessible websites.',
        bullets: [
            'Upload any photo for analysis',
            'Find similar images from public sources',
            'View detailed similarity comparisons',
        ],
        color: '#007bff',
    },
    {
        id: 2,
        icon: 'ban',
        title: 'Important Limitations',
        subtitle: 'What SafetyCam AI Does NOT Do',
        description:
            'This app is NOT designed for identification or verification purposes.',
        bullets: [
            'Does NOT identify individuals',
            'Does NOT confirm identities',
            'Does NOT provide criminal determinations',
            'Results are informational ONLY',
        ],
        color: '#dc3545',
        isCritical: true,
    },
    {
        id: 3,
        icon: 'lock',
        title: 'Your Privacy Matters',
        subtitle: 'Privacy & Responsibility',
        description:
            'We take your privacy seriously. Your uploaded images are processed securely.',
        bullets: [
            'Images processed on secure servers',
            'Face data not stored on your device',
            'You are responsible for lawful use',
            'Misuse is strictly prohibited',
        ],
        color: '#28a745',
    },
];

export default function OnboardingScreen({ navigation }) {
    const [currentSlide, setCurrentSlide] = useState(0);

    const handleNext = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        } else {
            completeOnboarding();
        }
    };

    const handleSkip = () => {
        completeOnboarding();
    };

    const completeOnboarding = async () => {
        try {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
            navigation.replace('Home');
        } catch (e) {
            console.warn('Failed to save onboarding status:', e);
            navigation.replace('Home');
        }
    };

    const slide = slides[currentSlide];

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={[slide.color, adjustColor(slide.color, 40)]}
                style={styles.gradient}
            >
                {/* Skip button */}
                {currentSlide < slides.length - 1 && (
                    <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>
                )}

                {/* Content */}
                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.iconContainer}>
                        <Icon name={slide.icon} size={60} color="#fff" />
                    </View>

                    <Text style={styles.subtitle}>{slide.subtitle}</Text>
                    <Text style={styles.title}>{slide.title}</Text>

                    <View style={styles.descriptionBox}>
                        <Text style={styles.description}>{slide.description}</Text>

                        <View style={styles.bulletsContainer}>
                            {slide.bullets.map((bullet, index) => (
                                <View key={index} style={styles.bulletItem}>
                                    <Icon
                                        name={slide.isCritical ? 'times' : 'check'}
                                        size={14}
                                        color={slide.isCritical ? '#dc3545' : '#28a745'}
                                        style={styles.bulletIcon}
                                    />
                                    <Text style={styles.bulletText}>{bullet}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>

                {/* Pagination dots */}
                <View style={styles.pagination}>
                    {slides.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                currentSlide === index && styles.dotActive,
                            ]}
                        />
                    ))}
                </View>

                {/* Next/Get Started button */}
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                    <Text style={styles.nextButtonText}>
                        {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
                    </Text>
                    <Icon name="arrow-right" size={16} color={slide.color} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </LinearGradient>
        </SafeAreaView>
    );
}

// Helper to lighten a color
const adjustColor = (color, amount) => {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00ff) + amount);
    const b = Math.min(255, (num & 0x0000ff) + amount);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#007bff',
    },
    gradient: {
        flex: 1,
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    skipButton: {
        alignSelf: 'flex-end',
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 10,
    },
    skipText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 16,
        fontWeight: '600',
    },
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 24,
    },
    descriptionBox: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 16,
        padding: 20,
        width: width - 48,
        maxWidth: 400,
    },
    description: {
        fontSize: 15,
        color: '#333',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 16,
    },
    bulletsContainer: {
        marginTop: 8,
    },
    bulletItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    bulletIcon: {
        marginRight: 10,
        width: 16,
    },
    bulletText: {
        fontSize: 14,
        color: '#333',
        flex: 1,
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 24,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255,255,255,0.4)',
        marginHorizontal: 5,
    },
    dotActive: {
        backgroundColor: '#fff',
        width: 24,
    },
    nextButton: {
        backgroundColor: '#fff',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        minWidth: 180,
    },
    nextButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007bff',
    },
});
