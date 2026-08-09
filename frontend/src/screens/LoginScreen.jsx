import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Pressable,
    Animated,
    Keyboard // <-- Added Keyboard import
} from 'react-native';
import React, { useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    // Error States
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const router = useRouter();

    // Animations
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const emailShake = useRef(new Animated.Value(0)).current;
    const passwordShake = useRef(new Animated.Value(0)).current;

    const triggerShake = (animValue) => {
        Animated.sequence([
            Animated.timing(animValue, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(animValue, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(animValue, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(animValue, { toValue: 0, duration: 50, useNativeDriver: true })
        ]).start();
    };

    const validateFields = () => {
        let isValid = true;

        // Basic Regex to check if email format is roughly valid (e.g., test@test.com)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email.trim()) {
            setEmailError('Email is required');
            triggerShake(emailShake);
            isValid = false;
        } else if (!emailRegex.test(email.trim())) {
            setEmailError('Invalid email format');
            triggerShake(emailShake);
            isValid = false;
        }

        if (!password) {
            setPasswordError('Password is required');
            triggerShake(passwordShake);
            isValid = false;
        }

        return isValid;
    };

    const handleBackendError = (message) => {
        const lowerMsg = message.toLowerCase();

        if (lowerMsg.includes('invalid email or password')) {
            setEmailError(' ');
            setPasswordError(message);
            triggerShake(emailShake);
            triggerShake(passwordShake);
        } else if (lowerMsg.includes('user already exists') || lowerMsg.includes('email format')) {
            setEmailError(message);
            triggerShake(emailShake);
        } else if (lowerMsg.includes('password')) {
            setPasswordError(message);
            triggerShake(passwordShake);
        } else {
            setPasswordError(message);
            triggerShake(emailShake);
            triggerShake(passwordShake);
        }
    };

    const handleLogin = async () => {
        setEmailError('');
        setPasswordError('');

        if (!validateFields()) return;

        // FIX 3: Dismiss the keyboard instantly to clear it from the layout
        Keyboard.dismiss();

        try {
            const response = await axios.post(`${API_URL}/login`, { email, password });

            if (response.data.token) {
                await SecureStore.setItemAsync('userToken', response.data.token);

                // Show toast immediately while the keyboard is closing
                Toast.show({
                    type: 'hotstarSuccess',
                    text1: 'Login Successful',
                    position: 'top',
                    topOffset: 60,
                    visibilityTime: 3000,
                });

                // FIX 4: Delay the screen transition by 150ms. 
                // This gives the Keyboard time to animate away completely before sliding the screen.
                setTimeout(() => {
                    router.replace('/home');
                }, 150);
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || "Network error occurred";
            handleBackendError(errorMessage);
        }
    };

    const handleSignup = async () => {
        setEmailError('');
        setPasswordError('');

        if (!validateFields()) return;

        // FIX 3: Dismiss keyboard
        Keyboard.dismiss();

        try {
            const response = await axios.post(`${API_URL}/register`, { email, password });

            if (response.data.token) {
                await SecureStore.setItemAsync('userToken', response.data.token);

                // Show toast immediately
                Toast.show({
                    type: 'hotstarSuccess',
                    text1: 'Signup Successful',
                    position: 'top',
                    topOffset: 60,
                    visibilityTime: 3000,
                });

                // FIX 4: Delay navigation
                setTimeout(() => {
                    router.replace('/home');
                }, 150);
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || "Network error occurred";
            handleBackendError(errorMessage);
        }
    };

    const handleSignUpNavigation = () => {
        setEmailError('');
        setPasswordError('');

        Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
        }).start(() => {
            setIsSignUp(!isSignUp);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }).start();
        });
    };

    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <TouchableOpacity style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={styles.spacer} />

                    <View style={styles.content}>
                        <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
                            {isSignUp ? 'Sign Up' : 'Login'} to watch for free
                        </Animated.Text>

                        {/* Email Input */}
                        <View style={styles.inputWrapper}>
                            <Animated.View style={[
                                styles.inputContainer,
                                emailError ? styles.inputErrorBorder : null,
                                { transform: [{ translateX: emailShake }] }
                            ]}>
                                <Text style={[styles.floatingLabel, emailError ? styles.errorLabel : null]}>Email address</Text>
                                <TextInput
                                    style={styles.input}
                                    selectionColor="#1F80E0"
                                    value={email}
                                    onChangeText={(text) => {
                                        setEmail(text);
                                        setEmailError('');
                                        if (passwordError.toLowerCase().includes('invalid')) {
                                            setPasswordError('');
                                        }
                                    }}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </Animated.View>
                            {emailError.trim() !== '' ? <Text style={styles.errorText}>{emailError}</Text> : null}
                        </View>

                        {/* Password Input */}
                        <View style={styles.inputWrapper}>
                            <Animated.View style={[
                                styles.inputContainer,
                                passwordError ? styles.inputErrorBorder : null,
                                { transform: [{ translateX: passwordShake }] }
                            ]}>
                                <Text style={[styles.floatingLabel, passwordError ? styles.errorLabel : null]}>Password</Text>
                                <TextInput
                                    style={styles.input}
                                    selectionColor="#1F80E0"
                                    value={password}
                                    onChangeText={(text) => {
                                        setPassword(text);
                                        setPasswordError('');
                                        if (emailError === ' ') {
                                            setEmailError('');
                                        }
                                    }}
                                    secureTextEntry={true}
                                />
                            </Animated.View>
                            {passwordError.trim() !== '' ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                        </View>

                        {/* Login Button */}
                        <Pressable
                            style={styles.loginButton}
                            onPress={isSignUp ? handleSignup : handleLogin}
                        >
                            <Animated.Text style={[styles.loginButtonText, { opacity: fadeAnim }]}>
                                {isSignUp ? 'Sign Up' : 'Login'}
                            </Animated.Text>
                        </Pressable>

                        {/* Footer Text */}
                        <View style={styles.footerContainer}>
                            <Animated.Text style={[styles.footerText, { opacity: fadeAnim }]}>
                                {isSignUp ? "Already have an account" : "Don't have an account"}?{' '}
                                <Text
                                    style={styles.linkText}
                                    onPress={handleSignUpNavigation}
                                >
                                    {isSignUp ? 'Login' : 'Sign Up'}
                                </Text>
                            </Animated.Text>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient >
    );
};

export default LoginScreen;

const styles = StyleSheet.create({
    background: { flex: 1 },
    safeArea: { flex: 1 },
    container: { flex: 1, paddingHorizontal: 20 },
    backButton: { marginTop: 16, width: 40, height: 40, justifyContent: 'center' },
    spacer: { flex: 1 },
    content: { paddingBottom: 40 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 24 },
    inputWrapper: { marginBottom: 20 },
    inputContainer: {
        borderWidth: 1,
        borderColor: '#8F98A0',
        borderRadius: 8,
        height: 56,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    inputErrorBorder: { borderColor: '#E53935' },
    floatingLabel: {
        position: 'absolute',
        top: -10,
        left: 12,
        backgroundColor: '#0A0A0C',
        paddingHorizontal: 6,
        color: '#8F98A0',
        fontSize: 12,
    },
    errorLabel: { color: '#E53935' },
    input: { color: '#FFFFFF', fontSize: 16, height: '100%' },
    errorText: { color: '#E53935', fontSize: 12, marginTop: 6, marginLeft: 4 },
    loginButton: {
        backgroundColor: '#1F80E0',
        borderRadius: 8,
        paddingTop: 16,
        paddingBottom: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    footerContainer: { alignItems: 'center', marginTop: 20 },
    footerText: { color: '#8F98A0', fontSize: 14 },
    linkText: { color: '#1F80E0', fontWeight: 'bold' },
});