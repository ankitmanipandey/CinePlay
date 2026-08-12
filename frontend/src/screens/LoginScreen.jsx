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
    ActivityIndicator,
    ScrollView
} from 'react-native';
import React, { useState, useRef } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, {
    Defs,
    LinearGradient as SvgLinearGradient,
    Stop,
    Circle,
    Path
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import Toast from 'react-native-toast-message';
import axios from 'axios';

import { useAuthStore } from '../store/useAuthStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const CinePlayLogo = ({ size = 38 }) => (
    <Svg viewBox="0 0 500 500" width={size} height={size}>
        <Defs>
            <SvgLinearGradient id="playGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#00E5FF" />
                <Stop offset="50%" stopColor="#9B51E0" />
                <Stop offset="100%" stopColor="#FF007A" />
            </SvgLinearGradient>
        </Defs>
        <Circle cx="250" cy="250" r="250" fill="url(#playGrad)" />
        <Path
            d="M 190 145 L 365 250 L 190 355 Z"
            fill="#FFFFFF"
            stroke="#FFFFFF"
            strokeWidth="25"
            strokeLinejoin="round"
        />
    </Svg>
);

const LoginScreen = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // View States
    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [isEmailVerified, setIsEmailVerified] = useState(false); // NEW STATE
    const [isLoading, setIsLoading] = useState(false);

    // Error States
    const [nameError, setNameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const router = useRouter();
    const insets = useSafeAreaInsets();
    const setSession = useAuthStore((state) => state.setSession);

    // Animations
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const nameShake = useRef(new Animated.Value(0)).current;
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

        if (isSignUp && !isForgotPassword && !name.trim()) {
            setNameError('Name is required');
            triggerShake(nameShake);
            isValid = false;
        }

        if (!email.trim()) {
            setEmailError('Email is required');
            triggerShake(emailShake);
            isValid = false;
        } else if (!emailRegex.test(email.trim())) {
            setEmailError('Invalid email format');
            triggerShake(emailShake);
            isValid = false;
        }

        if (!isForgotPassword && !password) {
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
        } else if (lowerMsg.includes('already exists') || lowerMsg.includes('format') || lowerMsg.includes('no account found')) {
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

    const handleAuthSuccess = async (responseObj, successMessage) => {
        await setSession(responseObj.token, responseObj);
        router.replace('/tabs/home');
        setTimeout(() => {
            Toast.show({
                type: 'hotstarSuccess',
                text1: successMessage,
                position: 'top',
                topOffset: insets.top > 0 ? insets.top + 10 : 50,
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
            if (response.data.token) await handleAuthSuccess(response.data, 'Login Successful');
        } catch (error) {
            handleBackendError(error.response?.data?.message || "Network error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async () => {
        setNameError('');
        setEmailError('');
        setPasswordError('');
        if (!validateFields()) return;

        Keyboard.dismiss();
        setIsLoading(true);

        try {
            const response = await axios.post(`${API_URL}/auth/register`, { name, email, password });
            if (response.data.token) await handleAuthSuccess(response.data, 'Signup Successful');
        } catch (error) {
            handleBackendError(error.response?.data?.message || "Network error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    // --- STEP 1: VERIFY EMAIL ---
    const handleVerifyEmail = async () => {
        setEmailError('');
        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setEmailError('Please enter a valid email');
            triggerShake(emailShake);
            return;
        }

        Keyboard.dismiss();
        setIsLoading(true);

        try {
            await axios.post(`${API_URL}/auth/verify-email`, { email });
            // Email exists! Transition to New Password input
            Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                setIsEmailVerified(true);
                Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
            });
        } catch (error) {
            handleBackendError(error.response?.data?.message || "Error verifying email");
        } finally {
            setIsLoading(false);
        }
    };

    // --- STEP 2: SUBMIT NEW PASSWORD ---
    const handleDirectPasswordReset = async () => {
        setPasswordError('');
        if (!password || password.length < 6) {
            setPasswordError('Password must be at least 6 characters');
            triggerShake(passwordShake);
            return;
        }

        Keyboard.dismiss();
        setIsLoading(true);

        try {
            await axios.post(`${API_URL}/auth/reset-password-direct`, { email, newPassword: password });
            Toast.show({
                type: 'hotstarSuccess',
                text1: 'Password changed successfully',
                position: 'top',
                topOffset: insets.top > 0 ? insets.top + 10 : 50,
            });
            // Switch back to login view smoothly
            setPassword('');
            setTimeout(() => {
                handleForgotPasswordNavigation();
            }, 1000);
        } catch (error) {
            handleBackendError(error.response?.data?.message || "Error resetting password");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignUpNavigation = () => {
        setNameError(''); setEmailError(''); setPasswordError('');
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
            setIsSignUp(!isSignUp);
            setIsForgotPassword(false);
            setIsEmailVerified(false);
            Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
        });
    };

    const handleForgotPasswordNavigation = () => {
        setNameError(''); setEmailError(''); setPasswordError('');
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
            setIsForgotPassword(!isForgotPassword);
            setIsSignUp(false);
            setIsEmailVerified(false); // Always reset email verification on toggle
            Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
        });
    };

    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.background}>
            <Stack.Screen options={{ animation: 'slide_from_right' }} />
            <SafeAreaView style={styles.safeArea}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>

                        <TouchableOpacity style={styles.backButton} onPress={() => {
                            // If deep in forgot password, back arrow resets to email verification, otherwise goes back in nav
                            if (isForgotPassword && isEmailVerified) {
                                Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                                    setIsEmailVerified(false); setPassword(''); setPasswordError('');
                                    Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
                                });
                            } else {
                                router.back();
                            }
                        }}>
                            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                        </TouchableOpacity>

                        <View style={styles.spacer}>
                            <View style={styles.logoCenterContainer}>
                                <CinePlayLogo size={70} />
                                <MaskedView style={styles.logoMaskedView} maskElement={<Text style={styles.logoText}>CinePlay</Text>}>
                                    <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                        <Text style={[styles.logoText, { opacity: 0 }]}>CinePlay</Text>
                                    </LinearGradient>
                                </MaskedView>
                            </View>
                        </View>

                        <View style={styles.content}>
                            <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
                                {isForgotPassword
                                    ? (isEmailVerified ? 'Create New Password' : 'Verify your Email')
                                    : (isSignUp ? 'Sign Up to watch for free' : 'Login to watch for free')
                                }
                            </Animated.Text>

                            {/* Name Input */}
                            {isSignUp && !isForgotPassword && (
                                <View style={styles.inputWrapper}>
                                    <Animated.View style={[styles.inputContainer, nameError ? styles.inputErrorBorder : null, { transform: [{ translateX: nameShake }], opacity: fadeAnim }]}>
                                        <Text style={[styles.floatingLabel, nameError ? styles.errorLabel : null]}>Name</Text>
                                        <TextInput
                                            style={styles.input} selectionColor="#9B51E0" value={name}
                                            onChangeText={(text) => { setName(text); setNameError(''); }}
                                            autoCapitalize="words" placeholderTextColor="#8F98A0"
                                        />
                                    </Animated.View>
                                    {nameError.trim() !== '' && <Text style={styles.errorText}>{nameError}</Text>}
                                </View>
                            )}

                            {/* Email Input (Hidden during Step 2 of Reset) */}
                            {(!isForgotPassword || (isForgotPassword && !isEmailVerified)) && (
                                <View style={styles.inputWrapper}>
                                    <Animated.View style={[styles.inputContainer, emailError ? styles.inputErrorBorder : null, { transform: [{ translateX: emailShake }], opacity: fadeAnim }]}>
                                        <Text style={[styles.floatingLabel, emailError ? styles.errorLabel : null]}>Email address</Text>
                                        <TextInput
                                            style={styles.input} selectionColor="#9B51E0" value={email}
                                            onChangeText={(text) => { setEmail(text); setEmailError(''); if (passwordError.toLowerCase().includes('invalid')) setPasswordError(''); }}
                                            keyboardType="email-address" autoCapitalize="none"
                                            editable={!isEmailVerified} // Lock it just in case
                                        />
                                    </Animated.View>
                                    {emailError.trim() !== '' && <Text style={styles.errorText}>{emailError}</Text>}
                                </View>
                            )}

                            {/* Password Input (Hidden during Step 1 of Reset) */}
                            {(!isForgotPassword || (isForgotPassword && isEmailVerified)) && (
                                <View style={styles.inputWrapper}>
                                    <Animated.View style={[styles.inputContainer, passwordError ? styles.inputErrorBorder : null, { transform: [{ translateX: passwordShake }], opacity: fadeAnim }]}>
                                        <Text style={[styles.floatingLabel, passwordError ? styles.errorLabel : null]}>{isForgotPassword ? 'New Password' : 'Password'}</Text>
                                        <TextInput
                                            style={styles.input} selectionColor="#9B51E0" value={password}
                                            onChangeText={(text) => { setPassword(text); setPasswordError(''); if (emailError === ' ') setEmailError(''); }}
                                            secureTextEntry={true}
                                        />
                                    </Animated.View>
                                    {passwordError.trim() !== '' && <Text style={styles.errorText}>{passwordError}</Text>}
                                </View>
                            )}

                            {/* Forgot Password Link */}
                            {!isSignUp && !isForgotPassword && (
                                <Animated.View style={{ opacity: fadeAnim }}>
                                    <TouchableOpacity style={styles.forgotPasswordContainer} onPress={handleForgotPasswordNavigation} activeOpacity={0.7}>
                                        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            )}

                            {/* Dynamic Submit Button */}
                            <Pressable
                                style={[styles.loginButtonContainer, isLoading && styles.loginButtonDisabled]}
                                onPress={isForgotPassword ? (isEmailVerified ? handleDirectPasswordReset : handleVerifyEmail) : (isSignUp ? handleSignup : handleLogin)}
                                disabled={isLoading}
                            >
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginButtonGradient}>
                                    {isLoading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Animated.Text style={[styles.loginButtonText, { opacity: fadeAnim }]}>
                                            {isForgotPassword ? (isEmailVerified ? 'Change Password' : 'Verify') : (isSignUp ? 'Sign Up' : 'Login')}
                                        </Animated.Text>
                                    )}
                                </LinearGradient>
                            </Pressable>

                            {/* Footer */}
                            <View style={styles.footerContainer}>
                                {isForgotPassword ? (
                                    <Animated.Text style={[styles.footerText, { opacity: fadeAnim }]}>
                                        Remember your password?{' '}
                                        <Text style={styles.linkText} onPress={handleForgotPasswordNavigation}>Login</Text>
                                    </Animated.Text>
                                ) : (
                                    <Animated.Text style={[styles.footerText, { opacity: fadeAnim }]}>
                                        {isSignUp ? "Already have an account" : "Don't have an account"}?{' '}
                                        <Text style={styles.linkText} onPress={handleSignUpNavigation}>
                                            {isSignUp ? 'Login' : 'Sign Up'}
                                        </Text>
                                    </Animated.Text>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient >
    );
};

export default LoginScreen;

const styles = StyleSheet.create({
    background: { flex: 1 },
    safeArea: { flex: 1 },
    container: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingHorizontal: 20 },
    backButton: { marginTop: 16, width: 40, height: 40, justifyContent: 'center', zIndex: 10 },
    spacer: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 180, paddingVertical: 20 },
    logoCenterContainer: { alignItems: 'center', gap: 12 },
    logoMaskedView: { height: 42, flexDirection: 'row', alignItems: 'center' },
    logoText: { fontSize: 36, fontWeight: '900', letterSpacing: 0.5, lineHeight: 42, includeFontPadding: false },
    content: { paddingBottom: 40 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 24 },
    inputWrapper: { marginBottom: 20 },
    inputContainer: { borderWidth: 1, borderColor: '#8F98A0', borderRadius: 8, height: 56, justifyContent: 'center', paddingHorizontal: 16 },
    inputErrorBorder: { borderColor: '#E53935' },
    floatingLabel: { position: 'absolute', top: -10, left: 12, backgroundColor: '#0A0A0C', paddingHorizontal: 6, color: '#8F98A0', fontSize: 12 },
    errorLabel: { color: '#E53935' },
    input: { color: '#FFFFFF', fontSize: 16, height: '100%' },
    errorText: { color: '#E53935', fontSize: 12, marginTop: 6, marginLeft: 4 },
    forgotPasswordContainer: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -8 },
    forgotPasswordText: { color: '#8F98A0', fontSize: 13, fontWeight: '600' },
    loginButtonContainer: { marginTop: 8, borderRadius: 8, overflow: 'hidden' },
    loginButtonGradient: { height: 52, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
    loginButtonDisabled: { opacity: 0.7 },
    loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    footerContainer: { alignItems: 'center', marginTop: 24 },
    footerText: { color: '#8F98A0', fontSize: 14 },
    linkText: { color: '#9B51E0', fontWeight: 'bold' },
});