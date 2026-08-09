import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity } from 'react-native';

const LoginScreen = () => {
    // Local state for our form inputs
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        // We will wire this to your Node/Express backend later!
        console.log('Login attempt with:', email, password);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>

                <View style={styles.header}>
                    <Text style={styles.brandTitle}>CinePlay</Text>
                    <Text style={styles.subtitle}>
                        Stream everything from dark crime thrillers to light-hearted rom-coms.
                    </Text>
                </View>

                <View style={styles.form}>
                    <TextInput
                        style={styles.input}
                        placeholder="Email Address"
                        placeholderTextColor="#8F98B2"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#8F98B2"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                        <Text style={styles.loginButtonText}>Log In</Text>
                    </TouchableOpacity>
                </View>

            </View>
        </SafeAreaView>
    );
};

export default LoginScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#090E17', // Hotstar Deep Navy Background
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    header: {
        marginBottom: 40,
        alignItems: 'center',
    },
    brandTitle: {
        color: '#FFFFFF',
        fontSize: 42,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 8,
    },
    subtitle: {
        color: '#8F98B2',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    form: {
        width: '100%',
        gap: 16, // Modern spacing between inputs
    },
    input: {
        backgroundColor: '#161F2E', // Slightly lighter navy for input fields
        color: '#FFFFFF',
        height: 56,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#2A3547',
    },
    loginButton: {
        backgroundColor: '#1F80E0', // Hotstar Primary Blue
        height: 56,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});