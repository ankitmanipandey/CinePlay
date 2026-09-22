import React from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity, Pressable,
    Animated, ActivityIndicator, useWindowDimensions, KeyboardAvoidingView,
    Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useLoginLogic } from '../hooks/useLoginLogic';
import CinePlayLogo from '../components/Logo/CinePlayLogo';
import GradientText from '../components/Logo/GradientText';

export default function LoginScreenWeb() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;

    const {
        name, setName, email, setEmail, password, setPassword,
        isSignUp, isForgotPassword, isEmailVerified, isLoading,
        nameError, emailError, passwordError,
        fadeAnim, nameShake, emailShake, passwordShake,
        handleLogin, handleSignup, handleVerifyEmail, handleDirectPasswordReset,
        handleSignUpNavigation, handleForgotPasswordNavigation, handleBackNavigation
    } = useLoginLogic();

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Split-Screen Widescreen)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <View style={styles.webContainer}>
                <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.leftPanel}>
                    <TouchableOpacity style={styles.backButtonDesktop} onPress={handleBackNavigation} activeOpacity={0.7}>
                        <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={styles.brandCenter}>
                        <CinePlayLogo size={120} />
                        <GradientText text="CinePlay" fontSize={56} width={280} height={68} />
                        <Text style={styles.brandSubtitle}>Unlimited movies, TV shows, and more.</Text>
                    </View>
                </LinearGradient>

                <View style={styles.rightPanel}>
                    <View style={styles.formContainerDesktop}>
                        <Animated.Text style={[styles.titleDesktop, { opacity: fadeAnim }]}>
                            {isForgotPassword ? (isEmailVerified ? 'Create New Password' : 'Verify your Email') : (isSignUp ? 'Sign Up to watch for free' : 'Login to watch for free')}
                        </Animated.Text>

                        {isSignUp && !isForgotPassword && (
                            <View style={styles.inputWrapper}>
                                <Animated.View style={[styles.inputContainerDesktop, nameError ? styles.inputErrorBorder : null, { transform: [{ translateX: nameShake }], opacity: fadeAnim }]}>
                                    <Text style={[styles.floatingLabelDesktop, nameError ? styles.errorLabel : null]}>Name</Text>
                                    <TextInput
                                        style={styles.inputDesktop} selectionColor="#9B51E0" value={name} onChangeText={setName}
                                        autoCapitalize="words" placeholderTextColor="#8F98A0"
                                    />
                                </Animated.View>
                                {nameError.trim() !== '' && <Text style={styles.errorText}>{nameError}</Text>}
                            </View>
                        )}

                        {(!isForgotPassword || (isForgotPassword && !isEmailVerified)) && (
                            <View style={styles.inputWrapper}>
                                <Animated.View style={[styles.inputContainerDesktop, emailError ? styles.inputErrorBorder : null, { transform: [{ translateX: emailShake }], opacity: fadeAnim }]}>
                                    <Text style={[styles.floatingLabelDesktop, emailError ? styles.errorLabel : null]}>Email address</Text>
                                    <TextInput
                                        style={styles.inputDesktop} selectionColor="#9B51E0" value={email} onChangeText={setEmail}
                                        keyboardType="email-address" autoCapitalize="none" editable={!isEmailVerified}
                                    />
                                </Animated.View>
                                {emailError.trim() !== '' && <Text style={styles.errorText}>{emailError}</Text>}
                            </View>
                        )}

                        {(!isForgotPassword || (isForgotPassword && isEmailVerified)) && (
                            <View style={styles.inputWrapper}>
                                <Animated.View style={[styles.inputContainerDesktop, passwordError ? styles.inputErrorBorder : null, { transform: [{ translateX: passwordShake }], opacity: fadeAnim }]}>
                                    <Text style={[styles.floatingLabelDesktop, passwordError ? styles.errorLabel : null]}>{isForgotPassword ? 'New Password' : 'Password'}</Text>
                                    <TextInput
                                        style={styles.inputDesktop} selectionColor="#9B51E0" value={password} onChangeText={setPassword} secureTextEntry={true}
                                    />
                                </Animated.View>
                                {passwordError.trim() !== '' && <Text style={styles.errorText}>{passwordError}</Text>}
                            </View>
                        )}

                        {!isSignUp && !isForgotPassword && (
                            <Animated.View style={{ opacity: fadeAnim }}>
                                <TouchableOpacity style={styles.forgotPasswordContainer} onPress={handleForgotPasswordNavigation}>
                                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        )}

                        <Pressable
                            style={[styles.loginButtonContainerDesktop, isLoading && styles.loginButtonDisabled]}
                            onPress={isForgotPassword ? (isEmailVerified ? handleDirectPasswordReset : handleVerifyEmail) : (isSignUp ? handleSignup : handleLogin)}
                            disabled={isLoading}
                        >
                            <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginButtonGradientDesktop}>
                                {isLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                                    <Animated.Text style={[styles.loginButtonTextDesktop, { opacity: fadeAnim }]}>
                                        {isForgotPassword ? (isEmailVerified ? 'Change Password' : 'Verify') : (isSignUp ? 'Sign Up' : 'Login')}
                                    </Animated.Text>
                                )}
                            </LinearGradient>
                        </Pressable>

                        <View style={styles.footerContainer}>
                            {isForgotPassword ? (
                                <Animated.Text style={[styles.footerText, { opacity: fadeAnim }]}>
                                    Remember your password? <Text style={styles.linkText} onPress={handleForgotPasswordNavigation}>Login</Text>
                                </Animated.Text>
                            ) : (
                                <Animated.Text style={[styles.footerText, { opacity: fadeAnim }]}>
                                    {isSignUp ? "Already have an account" : "Don't have an account"}?{' '}
                                    <Text style={styles.linkText} onPress={handleSignUpNavigation}>{isSignUp ? 'Login' : 'Sign Up'}</Text>
                                </Animated.Text>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <LinearGradient colors={['#170D22', '#0A0A0C']} style={styles.mobileBackground}>
            <SafeAreaView style={styles.safeArea}>
                <KeyboardAvoidingView style={styles.mobileContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <ScrollView contentContainerStyle={styles.scrollContentMobile} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>

                        <TouchableOpacity style={styles.backButtonMobile} onPress={handleBackNavigation}>
                            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                        </TouchableOpacity>

                        <View style={styles.spacerMobile}>
                            <View style={styles.logoCenterContainerMobile}>
                                <CinePlayLogo size={70} />
                                <GradientText text="CinePlay" fontSize={36} width={190} height={44} />
                            </View>
                        </View>

                        <View style={styles.contentMobile}>
                            <Animated.Text style={[styles.titleMobile, { opacity: fadeAnim }]}>
                                {isForgotPassword ? (isEmailVerified ? 'Create New Password' : 'Verify your Email') : (isSignUp ? 'Sign Up to watch for free' : 'Login to watch for free')}
                            </Animated.Text>

                            {isSignUp && !isForgotPassword && (
                                <View style={styles.inputWrapperMobile}>
                                    <Animated.View style={[styles.inputContainerMobile, nameError ? styles.inputErrorBorder : null, { transform: [{ translateX: nameShake }], opacity: fadeAnim }]}>
                                        <Text style={[styles.floatingLabelMobile, nameError ? styles.errorLabel : null]}>Name</Text>
                                        <TextInput style={styles.inputMobile} selectionColor="#9B51E0" value={name} onChangeText={setName} autoCapitalize="words" placeholderTextColor="#8F98A0" />
                                    </Animated.View>
                                    {nameError.trim() !== '' && <Text style={styles.errorTextMobile}>{nameError}</Text>}
                                </View>
                            )}

                            {(!isForgotPassword || (isForgotPassword && !isEmailVerified)) && (
                                <View style={styles.inputWrapperMobile}>
                                    <Animated.View style={[styles.inputContainerMobile, emailError ? styles.inputErrorBorder : null, { transform: [{ translateX: emailShake }], opacity: fadeAnim }]}>
                                        <Text style={[styles.floatingLabelMobile, emailError ? styles.errorLabel : null]}>Email address</Text>
                                        <TextInput style={styles.inputMobile} selectionColor="#9B51E0" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!isEmailVerified} />
                                    </Animated.View>
                                    {emailError.trim() !== '' && <Text style={styles.errorTextMobile}>{emailError}</Text>}
                                </View>
                            )}

                            {(!isForgotPassword || (isForgotPassword && isEmailVerified)) && (
                                <View style={styles.inputWrapperMobile}>
                                    <Animated.View style={[styles.inputContainerMobile, passwordError ? styles.inputErrorBorder : null, { transform: [{ translateX: passwordShake }], opacity: fadeAnim }]}>
                                        <Text style={[styles.floatingLabelMobile, passwordError ? styles.errorLabel : null]}>{isForgotPassword ? 'New Password' : 'Password'}</Text>
                                        <TextInput style={styles.inputMobile} selectionColor="#9B51E0" value={password} onChangeText={setPassword} secureTextEntry={true} />
                                    </Animated.View>
                                    {passwordError.trim() !== '' && <Text style={styles.errorTextMobile}>{passwordError}</Text>}
                                </View>
                            )}

                            {!isSignUp && !isForgotPassword && (
                                <Animated.View style={{ opacity: fadeAnim }}>
                                    <TouchableOpacity style={styles.forgotPasswordContainerMobile} onPress={handleForgotPasswordNavigation} activeOpacity={0.7}>
                                        <Text style={styles.forgotPasswordTextMobile}>Forgot Password?</Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            )}

                            <Pressable
                                style={[styles.loginButtonContainerMobile, isLoading && styles.loginButtonDisabled]}
                                onPress={isForgotPassword ? (isEmailVerified ? handleDirectPasswordReset : handleVerifyEmail) : (isSignUp ? handleSignup : handleLogin)}
                                disabled={isLoading}
                            >
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginButtonGradientMobile}>
                                    {isLoading ? <ActivityIndicator color="#FFFFFF" /> : (
                                        <Animated.Text style={[styles.loginButtonTextMobile, { opacity: fadeAnim }]}>
                                            {isForgotPassword ? (isEmailVerified ? 'Change Password' : 'Verify') : (isSignUp ? 'Sign Up' : 'Login')}
                                        </Animated.Text>
                                    )}
                                </LinearGradient>
                            </Pressable>

                            <View style={styles.footerContainerMobile}>
                                {isForgotPassword ? (
                                    <Animated.Text style={[styles.footerTextMobile, { opacity: fadeAnim }]}>
                                        Remember your password? <Text style={styles.linkText} onPress={handleForgotPasswordNavigation}>Login</Text>
                                    </Animated.Text>
                                ) : (
                                    <Animated.Text style={[styles.footerTextMobile, { opacity: fadeAnim }]}>
                                        {isSignUp ? "Already have an account" : "Don't have an account"}?{' '}
                                        <Text style={styles.linkText} onPress={handleSignUpNavigation}>{isSignUp ? 'Login' : 'Sign Up'}</Text>
                                    </Animated.Text>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({

    // --- DESKTOP STYLES (>= 1024px) ---
    webContainer: { flex: 1, flexDirection: 'row', height: '100vh', backgroundColor: '#0A0A0C' },
    leftPanel: { flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    backButtonDesktop: { position: 'absolute', top: 40, left: 40, cursor: 'pointer', zIndex: 10 },
    brandCenter: { alignItems: 'center', gap: 16 },
    brandSubtitle: { color: '#8F98A0', fontSize: 20, marginTop: 8, fontWeight: '500' },
    rightPanel: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121217' },
    formContainerDesktop: { width: '100%', maxWidth: 420, paddingHorizontal: 32 },
    titleDesktop: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 32 },
    inputContainerDesktop: { borderWidth: 1, borderColor: '#3A3A40', borderRadius: 12, height: 64, justifyContent: 'center', paddingHorizontal: 20, backgroundColor: '#1E1E24' },
    floatingLabelDesktop: { position: 'absolute', top: -10, left: 16, backgroundColor: '#1E1E24', paddingHorizontal: 8, color: '#8F98A0', fontSize: 13, fontWeight: '600' },
    inputDesktop: { color: '#FFFFFF', fontSize: 16, height: '100%', outlineStyle: 'none' },
    loginButtonContainerDesktop: { marginTop: 16, borderRadius: 12, overflow: 'hidden', cursor: 'pointer' },
    loginButtonGradientDesktop: { height: 60, justifyContent: 'center', alignItems: 'center' },
    loginButtonTextDesktop: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },

    // --- MOBILE & TABLET STYLES (< 1024px) ---
    mobileBackground: { flex: 1 },
    safeArea: { flex: 1 },
    mobileContainer: { flex: 1 },
    scrollContentMobile: { flexGrow: 1, paddingHorizontal: 20 },
    backButtonMobile: { marginTop: 16, width: 40, height: 40, justifyContent: 'center', zIndex: 10, cursor: 'pointer' },
    spacerMobile: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 180, paddingVertical: 20 },
    logoCenterContainerMobile: { alignItems: 'center', gap: 12 },
    contentMobile: { paddingBottom: 40 },
    titleMobile: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 24 },
    inputWrapperMobile: { marginBottom: 20 },
    inputContainerMobile: { borderWidth: 1, borderColor: '#8F98A0', borderRadius: 8, height: 56, justifyContent: 'center', paddingHorizontal: 16 },
    floatingLabelMobile: { position: 'absolute', top: -10, left: 12, backgroundColor: '#0A0A0C', paddingHorizontal: 6, color: '#8F98A0', fontSize: 12 },
    inputMobile: { color: '#FFFFFF', fontSize: 16, height: '100%', outlineStyle: 'none' },
    errorTextMobile: { color: '#E53935', fontSize: 12, marginTop: 6, marginLeft: 4 },
    forgotPasswordContainerMobile: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -8, cursor: 'pointer' },
    forgotPasswordTextMobile: { color: '#8F98A0', fontSize: 13, fontWeight: '600' },
    loginButtonContainerMobile: { marginTop: 8, borderRadius: 8, overflow: 'hidden', cursor: 'pointer' },
    loginButtonGradientMobile: { height: 52, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
    loginButtonTextMobile: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
    footerContainerMobile: { alignItems: 'center', marginTop: 24 },
    footerTextMobile: { color: '#8F98A0', fontSize: 14 },

    // --- SHARED STYLES ---
    inputWrapper: { marginBottom: 24 },
    inputErrorBorder: { borderColor: '#E53935' },
    errorLabel: { color: '#E53935' },
    errorText: { color: '#E53935', fontSize: 13, marginTop: 8, marginLeft: 4 },
    forgotPasswordContainer: { alignSelf: 'flex-end', marginBottom: 24, marginTop: -8, cursor: 'pointer' },
    forgotPasswordText: { color: '#8F98A0', fontSize: 14, fontWeight: '600' },
    loginButtonDisabled: { opacity: 0.7, cursor: 'not-allowed' },
    footerContainer: { alignItems: 'center', marginTop: 32 },
    footerText: { color: '#8F98A0', fontSize: 15 },
    linkText: { color: '#00E5FF', fontWeight: 'bold', cursor: 'pointer' },
}); 