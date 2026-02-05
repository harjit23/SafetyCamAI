// ReportMisuse.js - Report misuse component for Apple compliance
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
    Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

const REPORT_EMAIL = 'safetycamai@gmail.com';
const REPORT_SUBJECT = 'SafetyCam AI - Report Misuse';

export default function ReportMisuse({ style }) {
    const handleReportMisuse = async () => {
        const mailtoUrl = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(REPORT_SUBJECT)}&body=${encodeURIComponent(
            'Please describe the misuse you want to report:\n\n'
        )}`;

        try {
            const canOpen = await Linking.canOpenURL(mailtoUrl);
            if (canOpen) {
                await Linking.openURL(mailtoUrl);
            } else {
                Alert.alert(
                    'Email Not Available',
                    `Please send your report to ${REPORT_EMAIL}`,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            Alert.alert(
                'Error',
                `Could not open email. Please contact ${REPORT_EMAIL}`,
                [{ text: 'OK' }]
            );
        }
    };

    return (
        <TouchableOpacity
            style={[styles.container, style]}
            onPress={handleReportMisuse}
        >
            <Icon name="flag" size={16} color="#dc3545" style={styles.icon} />
            <Text style={styles.text}>Report Misuse</Text>
        </TouchableOpacity>
    );
}

// Inline card version for Profile screen
export function ReportMisuseCard() {
    const handleReportMisuse = async () => {
        const mailtoUrl = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(REPORT_SUBJECT)}&body=${encodeURIComponent(
            'Please describe the misuse you want to report:\n\n'
        )}`;

        try {
            const canOpen = await Linking.canOpenURL(mailtoUrl);
            if (canOpen) {
                await Linking.openURL(mailtoUrl);
            } else {
                Alert.alert(
                    'Email Not Available',
                    `Please send your report to ${REPORT_EMAIL}`,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            Alert.alert(
                'Error',
                `Could not open email. Please contact ${REPORT_EMAIL}`,
                [{ text: 'OK' }]
            );
        }
    };

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Icon name="flag" size={20} color="#dc3545" />
                <Text style={styles.cardTitle}>Report Misuse</Text>
            </View>
            <Text style={styles.cardDescription}>
                If you believe this app is being misused or if you have concerns about content,
                please report it to us.
            </Text>
            <TouchableOpacity style={styles.reportButton} onPress={handleReportMisuse}>
                <Icon name="envelope" size={16} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.reportButtonText}>Send Report</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    icon: {
        marginRight: 8,
    },
    text: {
        fontSize: 14,
        color: '#dc3545',
        fontWeight: '500',
    },
    // Card styles
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: '#f8d7da',
        backgroundColor: '#fff',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginLeft: 10,
    },
    cardDescription: {
        fontSize: 13,
        color: '#666',
        lineHeight: 18,
        marginBottom: 12,
    },
    reportButton: {
        backgroundColor: '#dc3545',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    reportButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});
