import { useState, useRef } from 'react';
import { Animated, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import axios from 'axios';

import { useAuthStore } from '../store/useAuthStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const useLoginLogic = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const [nameError, setNameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const router = useRouter();
    const insets = useSafeAreaInsets();
    const setSession = useAuthStore((state) => state.setSession);

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
        setEmailError(''); setPasswordError('');
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
        setNameError(''); setEmailError(''); setPasswordError('');
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
            Toast.show({ type: 'hotstarSuccess', text1: 'Password changed successfully', position: 'top', topOffset: insets.top > 0 ? insets.top + 10 : 50 });
            setPassword('');
            setTimeout(() => { handleForgotPasswordNavigation(); }, 1000);
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
            setIsEmailVerified(false);
            Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
        });
    };

    const handleBackNavigation = () => {
        if (isForgotPassword && isEmailVerified) {
            Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
                setIsEmailVerified(false); setPassword(''); setPasswordError('');
                Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
            });
        } else {
            router.back();
        }
    };

    return {
        name, setName, email, setEmail, password, setPassword,
        isSignUp, isForgotPassword, isEmailVerified, isLoading,
        nameError, emailError, passwordError,
        fadeAnim, nameShake, emailShake, passwordShake,
        handleLogin, handleSignup, handleVerifyEmail, handleDirectPasswordReset,
        handleSignUpNavigation, handleForgotPasswordNavigation, handleBackNavigation
    };
};