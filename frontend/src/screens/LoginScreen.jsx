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
    Keyboard,
    ActivityIndicator
} from 'react-native';
import React, { useState, useRef } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import axios from 'axios';

// --- IMPORT YOUR GLOBAL STORE ---
import { useAuthStore } from '../store/useAuthStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Error States
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const router = useRouter();
    const insets = useSafeAreaInsets();

    // --- GRAB THE setSession METHOD FROM ZUSTAND ---
    const setSession = useAuthStore((state) => state.setSession);

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

    // --- UPDATED: Pass email, trigger setSession ---
    const handleAuthSuccess = async (token, userEmail, successMessage) => {
        // 1. Update Global Store (This also handles SecureStore under the hood!)
        await setSession(token, userEmail);

        // 2. Shift the user to the home screen instantly
        router.replace('/tabs/home');

        // 3. Fire the toast AFTER the navigation completes
        setTimeout(() => {
            Toast.show({
                type: 'hotstarSuccess',
                text1: successMessage,
                position: 'top',
                topOffset: insets.top > 0 ? insets.top + 10 : 50,
                visibilityTime: 3000,
            });
        }, 400);
    };

    const handleLogin = async () => {
        setEmailError('');
        setPasswordError('');

        if (!validateFields()) return;

        Keyboard.dismiss();
        setIsLoading(true);

        try {
            const response = await axios.post(`${API_URL}/auth/login`, { email, password });
            if (response.data.token) {
                // Pass the email so setSession can use it
                await handleAuthSuccess(response.data.token, email, 'Login Successful');
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || "Network error occurred";
            handleBackendError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async () => {
        setEmailError('');
        setPasswordError('');

        if (!validateFields()) return;

        Keyboard.dismiss();
        setIsLoading(true);

        try {
            const response = await axios.post(`${API_URL}/auth/register`, { email, password });
            if (response.data.token) {
                // Pass the email so setSession can use it
                await handleAuthSuccess(response.data.token, email, 'Signup Successful');
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || "Network error occurred";
            handleBackendError(errorMessage);
        } finally {
            setIsLoading(false);
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
            <Stack.Screen options={{ animation: 'slide_from_right' }} />

            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
                                        if (passwordError.toLowerCase().includes('invalid')) setPasswordError('');
                                    }}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </Animated.View>
                            {emailError.trim() !== '' && <Text style={styles.errorText}>{emailError}</Text>}
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
                                        if (emailError === ' ') setEmailError('');
                                    }}
                                    secureTextEntry={true}
                                />
                            </Animated.View>
                            {passwordError.trim() !== '' && <Text style={styles.errorText}>{passwordError}</Text>}
                        </View>

                        {/* Login Button with Loader */}
                        <Pressable
                            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                            onPress={isSignUp ? handleSignup : handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Animated.Text style={[styles.loginButtonText, { opacity: fadeAnim }]}>
                                    {isSignUp ? 'Sign Up' : 'Login'}
                                </Animated.Text>
                            )}
                        </Pressable>

                        {/* Footer Text */}
                        <View style={styles.footerContainer}>
                            <Animated.Text style={[styles.footerText, { opacity: fadeAnim }]}>
                                {isSignUp ? "Already have an account" : "Don't have an account"}?{' '}
                                <Text style={styles.linkText} onPress={handleSignUpNavigation}>
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
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    footerContainer: { alignItems: 'center', marginTop: 20 },
    footerText: { color: '#8F98A0', fontSize: 14 },
    linkText: { color: '#1F80E0', fontWeight: 'bold' },
});