import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '../store/useAuthStore';
import { useGlobalSocket } from '../store/useGlobalSocket';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ChatScreen() {
    const router = useRouter();
    const { buddyId } = useLocalSearchParams();
    const safeBuddyId = Array.isArray(buddyId) ? buddyId[0] : buddyId;

    const { token, user } = useAuthStore();
    const { globalSocket, setActiveChat } = useGlobalSocket()

    const [messages, setMessages] = useState([]);
    const [buddyInfo, setBuddyInfo] = useState(null);
    const [isBuddyOnline, setIsBuddyOnline] = useState(false);

    // 🚨 NEW: Track friendship status
    const [isFriend, setIsFriend] = useState(true);

    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const markMessagesAsRead = async () => {
        if (!safeBuddyId) return;
        try {
            await axios.put(`${BACKEND_URL}/chat/mark-read`,
                { buddyId: safeBuddyId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            console.error("Failed to mark messages read", error);
        }
    };

    useEffect(() => {
        if (!safeBuddyId) return;

        const fetchHistory = async () => {
            try {
                const res = await axios.get(`${BACKEND_URL}/chat/${safeBuddyId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setBuddyInfo(res.data.buddy);
                setIsBuddyOnline(res.data.buddy.isOnline); // 🚨 seed initial status
                setMessages(res.data.messages);
                setIsFriend(res.data.isFriend); // 🚨 Read status from server
                markMessagesAsRead();
            } catch (error) {
                console.error("Failed to load chat", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [safeBuddyId]);

    useEffect(() => {
        if (safeBuddyId) {
            setActiveChat(safeBuddyId);
        }
        // Cleanup when we leave the screen
        return () => setActiveChat(null);
    }, [safeBuddyId, setActiveChat]);

    // Real-Time Listeners
    useEffect(() => {
        if (!globalSocket || !safeBuddyId) return;

        const handleNewMessage = (newMessage) => {
            if (String(newMessage.sender) === String(safeBuddyId)) {
                setMessages(prev => {
                    if (prev.some(m => String(m._id) === String(newMessage._id))) return prev;
                    return [...prev, newMessage];
                });
                markMessagesAsRead();
            }
        };

        const handleStatus = ({ userId, isOnline }) => {
            if (String(userId) === String(safeBuddyId)) setIsBuddyOnline(isOnline);
        };

        // 🚨 LIVE KICKOUT: If unfriended while looking at screen
        const handleFriendRemoved = ({ unfriendedBy }) => {
            if (String(unfriendedBy) === String(safeBuddyId)) {
                setIsFriend(false);
                Keyboard.dismiss();
            }
        };

        globalSocket.on('receive_direct_message', handleNewMessage);
        globalSocket.on('user_status', handleStatus);
        globalSocket.on('friend_removed', handleFriendRemoved);

        return () => {
            globalSocket.off('receive_direct_message', handleNewMessage);
            globalSocket.off('user_status', handleStatus);
            globalSocket.off('friend_removed', handleFriendRemoved);
        };
    }, [globalSocket, safeBuddyId]);

    const sendMessage = async () => {
        if (!inputText.trim() || !isFriend) return;

        const tempText = inputText.trim();
        setInputText('');

        const optimisticMsg = {
            _id: Date.now().toString(),
            sender: user._id,
            receiver: safeBuddyId,
            text: tempText,
            createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);

        try {
            await axios.post(`${BACKEND_URL}/chat/send`,
                { receiverId: safeBuddyId, text: tempText },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (error) {
            // 🚨 Revert optimistic update and show error if block failed
            setMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
            Toast.show({
                type: 'hotstarError',
                text1: error.response?.status === 403 ? 'Cannot send message' : 'Message failed to send'
            });
            if (error.response?.status === 403) setIsFriend(false);
        }
    };

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

                {/* 🚨 DYNAMIC BOTTOM BAR: Show input ONLY if friends */}
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
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#17171C', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    backButton: { marginRight: 16 },

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
    inputBox: { flex: 1, backgroundColor: '#0A0A0C', color: '#FFF', borderRadius: 24, paddingHorizontal: 16, height: 48, fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginRight: 10 },
    sendButton: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
    sendGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // 🚨 NEW: Unfriended Box Styling
    unfriendedContainer: { padding: 20, backgroundColor: '#17171C', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
    unfriendedText: { color: '#8F98A0', textAlign: 'center', fontSize: 14, lineHeight: 20 }
});