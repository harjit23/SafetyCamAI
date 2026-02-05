// SafetyDisclaimer.js - Blocking modal for first-time users
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome';

const DISCLAIMER_KEY = 'safety_disclaimer_accepted';

export default function SafetyDisclaimer({ children }) {
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkDisclaimerStatus();
    }, []);

    const checkDisclaimerStatus = async () => {
        try {
            const accepted = await AsyncStorage.getItem(DISCLAIMER_KEY);
            if (!accepted) {
                setVisible(true);
            }
        } catch (e) {
            console.warn('Failed to check disclaimer status:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        try {
            await AsyncStorage.setItem(DISCLAIMER_KEY, 'true');
            setVisible(false);
        } catch (e) {
            console.warn('Failed to save disclaimer acceptance:', e);
            setVisible(false);
        }
    };

    if (loading) {
        return null;
    }

    return (
        <>
            {children}
            <Modal
                visible={visible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => { }}
            >
                <View style={styles.overlay}>
                    <View style={styles.modalContainer}>
                        <LinearGradient
                            colors={['#007bff', '#0056b3']}
                            style={styles.header}
                        >
                            <Icon name="shield" size={32} color="#fff" />
                            <Text style={styles.headerTitle}>Important Notice</Text>
                        </LinearGradient>

                        <ScrollView style={styles.content}>
                            <Text style={styles.paragraph}>
                                <Text style={styles.appName}>SafetyCam AI</Text> is designed for{' '}
                                <Text style={styles.bold}>lawful, ethical, and informational purposes only</Text>.
                            </Text>

                            <View style={styles.bulletContainer}>
                                <View style={styles.bulletItem}>
                                    <Icon name="times-circle" size={16} color="#dc3545" style={styles.bulletIcon} />
                                    <Text style={styles.bulletText}>
                                        This app does <Text style={styles.bold}>not</Text> identify individuals
                                    </Text>
                                </View>
                                <View style={styles.bulletItem}>
                                    <Icon name="times-circle" size={16} color="#dc3545" style={styles.bulletIcon} />
                                    <Text style={styles.bulletText}>
                                        This app does <Text style={styles.bold}>not</Text> confirm identities or criminal activity
                                    </Text>
                                </View>
                                <View style={styles.bulletItem}>
                                    <Icon name="times-circle" size={16} color="#dc3545" style={styles.bulletIcon} />
                                    <Text style={styles.bulletText}>
                                        This app does <Text style={styles.bold}>not</Text> provide law-enforcement authority
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.paragraph}>
                                Results are for <Text style={styles.bold}>informational purposes only</Text> and
                                show visually similar images from publicly accessible sources.
                            </Text>

                            <Text style={styles.paragraph}>
                                Users are solely responsible for complying with all applicable laws.{' '}
                                <Text style={styles.bold}>Misuse is strictly prohibited.</Text>
                            </Text>

                            <View style={styles.warningBox}>
                                <Icon name="exclamation-triangle" size={18} color="#856404" />
                                <Text style={styles.warningText}>
                                    Do not use results for harassment, profiling, discrimination, or any unlawful purpose.
                                </Text>
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
                            <Text style={styles.acceptButtonText}>I Understand</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        maxHeight: '85%',
        overflow: 'hidden',
    },
    header: {
        padding: 20,
        alignItems: 'center',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 8,
    },
    content: {
        padding: 20,
    },
    paragraph: {
        fontSize: 15,
        color: '#333',
        lineHeight: 22,
        marginBottom: 16,
    },
    appName: {
        fontWeight: 'bold',
        color: '#007bff',
    },
    bold: {
        fontWeight: 'bold',
    },
    bulletContainer: {
        marginBottom: 16,
    },
    bulletItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    bulletIcon: {
        marginRight: 10,
        marginTop: 2,
    },
    bulletText: {
        flex: 1,
        fontSize: 14,
        color: '#333',
        lineHeight: 20,
    },
    warningBox: {
        backgroundColor: '#fff3cd',
        borderRadius: 8,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 8,
    },
    warningText: {
        flex: 1,
        fontSize: 13,
        color: '#856404',
        marginLeft: 10,
        lineHeight: 18,
    },
    acceptButton: {
        backgroundColor: '#007bff',
        margin: 20,
        marginTop: 10,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
    acceptButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
