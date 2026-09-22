import React from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { useChatLogic } from '../hooks/useChatLogic';

export default function ChatScreenWeb() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;

    const {
        router, user,
        messages, buddyInfo, isBuddyOnline, isFriend,
        inputText, setInputText, isLoading, sendMessage
    } = useChatLogic();

    const renderMessage = ({ item }) => {
        const isMe = String(item.sender) === String(user._id);

        return (
            <View style={[styles.msgWrapper, isMe ? styles.msgRight : styles.msgLeft]}>
                {isMe ? (
                    <LinearGradient colors={['#00E5FF', '#9B51E0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleMe]}>
                        <Text style={styles.msgText}>{item.text}</Text>
                    </LinearGradient>
                ) : (
                    <View style={[styles.bubble, styles.bubbleThem]}>
                        <Text style={styles.msgText}>{item.text}</Text>
                    </View>
                )}
            </View>
        );
    };

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Centered Dashboard)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <SafeAreaView style={styles.containerDesktop} edges={['top']}>
                <View style={styles.chatWindowDesktop}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.headerBuddyInfo}>
                            <View style={styles.avatarWrapper}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {buddyInfo?.name ? buddyInfo.name.charAt(0).toUpperCase() : '?'}
                                    </Text>
                                </View>
                                {isBuddyOnline && isFriend && <View style={styles.onlineIndicator} />}
                            </View>
                            <View>
                                <Text style={styles.headerTitle}>{buddyInfo?.name || 'Loading...'}</Text>
                                <Text style={[styles.headerSubtitle, isBuddyOnline && isFriend && { color: '#00E676' }]}>
                                    {!isFriend ? 'Unavailable' : (isBuddyOnline ? 'Online' : 'Offline')}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={{ flex: 1 }}>
                        {isLoading ? (
                            <ActivityIndicator size="large" color="#9B51E0" style={{ flex: 1, justifyContent: 'center' }} />
                        ) : (
                            <FlatList
                                data={[...messages].reverse()}
                                keyExtractor={item => item._id}
                                renderItem={renderMessage}
                                contentContainerStyle={styles.chatContent}
                                showsVerticalScrollIndicator={false}
                                inverted={true}
                                ListEmptyComponent={
                                    <View style={{ transform: [{ scaleY: -1 }], alignItems: 'center', marginTop: 40 }}>
                                        <Text style={styles.emptyText}>Say hi to your CineBuddy!</Text>
                                    </View>
                                }
                            />
                        )}
                    </View>

                    {isFriend ? (
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.inputBoxDesktop}
                                placeholder="Type a message..."
                                placeholderTextColor="#8F98A0"
                                value={inputText}
                                onChangeText={setInputText}
                                onSubmitEditing={sendMessage}
                            />
                            <TouchableOpacity style={styles.sendButtonDesktop} onPress={sendMessage} disabled={!inputText.trim()}>
                                <LinearGradient
                                    colors={inputText.trim() ? ['#00E5FF', '#9B51E0', '#FF007A'] : ['#2A2A30', '#2A2A30']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    style={styles.sendGradient}
                                >
                                    <Ionicons name="send" size={20} color={inputText.trim() ? "#FFF" : "#8F98A0"} style={{ marginLeft: 2 }} />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.unfriendedContainer}>
                            <Text style={styles.unfriendedText}>You are no longer CineBuddies with this user. Add them again to continue chatting.</Text>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.headerBuddyInfo}>
                    <View style={styles.avatarWrapper}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {buddyInfo?.name ? buddyInfo.name.charAt(0).toUpperCase() : '?'}
                            </Text>
                        </View>
                        {isBuddyOnline && isFriend && <View style={styles.onlineIndicator} />}
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>{buddyInfo?.name || 'Loading...'}</Text>
                        <Text style={[styles.headerSubtitle, isBuddyOnline && isFriend && { color: '#00E676' }]}>
                            {!isFriend ? 'Unavailable' : (isBuddyOnline ? 'Online' : 'Offline')}
                        </Text>
                    </View>
                </View>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                {isLoading ? (
                    <ActivityIndicator size="large" color="#9B51E0" style={{ flex: 1, justifyContent: 'center' }} />
                ) : (
                    <FlatList
                        data={[...messages].reverse()}
                        keyExtractor={item => item._id}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.chatContent}
                        showsVerticalScrollIndicator={false}
                        inverted={true}
                        ListEmptyComponent={
                            <View style={{ transform: [{ scaleY: -1 }], alignItems: 'center', marginTop: 40 }}>
                                <Text style={styles.emptyText}>Say hi to your CineBuddy!</Text>
                            </View>
                        }
                    />
                )}

                {isFriend ? (
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.inputBox}
                            placeholder="Type a message..."
                            placeholderTextColor="#8F98A0"
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={sendMessage}
                        />
                        <TouchableOpacity style={styles.sendButton} onPress={sendMessage} disabled={!inputText.trim()}>
                            <LinearGradient
                                colors={inputText.trim() ? ['#00E5FF', '#9B51E0', '#FF007A'] : ['#2A2A30', '#2A2A30']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={styles.sendGradient}
                            >
                                <Ionicons name="send" size={18} color={inputText.trim() ? "#FFF" : "#8F98A0"} style={{ marginLeft: 2 }} />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.unfriendedContainer}>
                        <Text style={styles.unfriendedText}>You are no longer CineBuddies with this user. Add them again to continue chatting.</Text>
                    </View>
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A0C' },

    // --- DESKTOP SPECIFIC STYLES ---
    containerDesktop: { flex: 1, backgroundColor: '#0A0A0C', alignItems: 'center', justifyContent: 'center' },
    chatWindowDesktop: { width: '100%', maxWidth: 800, flex: 1, backgroundColor: '#0A0A0C', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#17171C' },
    inputBoxDesktop: { flex: 1, backgroundColor: '#0A0A0C', color: '#FFF', borderRadius: 28, paddingHorizontal: 20, height: 56, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginRight: 12, outlineStyle: 'none' },
    sendButtonDesktop: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', cursor: 'pointer' },

    // --- SHARED / MOBILE STYLES ---
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#17171C', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    backButton: { marginRight: 16, cursor: 'pointer' },
    headerBuddyInfo: { flexDirection: 'row', alignItems: 'center' },
    avatarWrapper: { position: 'relative', marginRight: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2A2A30', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
    onlineIndicator: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#00E676', borderWidth: 2.5, borderColor: '#17171C' },
    headerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
    headerSubtitle: { color: '#8F98A0', fontSize: 13, marginTop: 2 },

    chatContent: { padding: 16 },
    emptyText: { color: '#8F98A0', textAlign: 'center' },

    msgWrapper: { marginBottom: 12, maxWidth: '80%' },
    msgLeft: { alignSelf: 'flex-start' },
    msgRight: { alignSelf: 'flex-end' },
    bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 18 },
    bubbleThem: { backgroundColor: '#1E1E24', borderBottomLeftRadius: 4 },
    bubbleMe: { borderBottomRightRadius: 4 },
    msgText: { color: '#FFF', fontSize: 15, lineHeight: 22 },

    inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#17171C', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    inputBox: { flex: 1, backgroundColor: '#0A0A0C', color: '#FFF', borderRadius: 24, paddingHorizontal: 16, height: 48, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginRight: 10, outlineStyle: 'none' },
    sendButton: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', cursor: 'pointer' },
    sendGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    unfriendedContainer: { padding: 20, backgroundColor: '#17171C', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
    unfriendedText: { color: '#8F98A0', textAlign: 'center', fontSize: 14, lineHeight: 20 }
});