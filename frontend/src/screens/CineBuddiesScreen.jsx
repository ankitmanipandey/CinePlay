import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '../store/useAuthStore';
import { useGlobalSocket } from '../store/useGlobalSocket';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export default function CineBuddiesScreen() {
    const router = useRouter();
    const { token } = useAuthStore();
    const { globalSocket } = useGlobalSocket();

    const [activeTab, setActiveTab] = useState('chats');
    const [friends, setFriends] = useState([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Reload friends list instantly when returning from ChatScreen to ensure badges are cleared
    useFocusEffect(
        useCallback(() => {
            if (activeTab === 'chats') {
                fetchFriends();
            }
        }, [activeTab])
    );

    useEffect(() => {
        if (!globalSocket) return;

        // 1. Live Chat Counter
        const handleRealTimeChat = (newMessage) => {
            setFriends(prev => prev.map(friend => {
                if (String(friend._id) === String(newMessage.sender)) {
                    return { ...friend, unreadCount: (friend.unreadCount || 0) + 1 };
                }
                return friend;
            }));
        };

        // 2. Live Online Presence
        const handleStatus = ({ userId, isOnline }) => {
            setFriends(prev => prev.map(f =>
                String(f._id) === String(userId) ? { ...f, isOnline } : f
            ));
        };

        globalSocket.on('receive_direct_message', handleRealTimeChat);
        globalSocket.on('user_status', handleStatus);

        return () => {
            globalSocket.off('receive_direct_message', handleRealTimeChat);
            globalSocket.off('user_status', handleStatus);
        };
    }, [globalSocket]);

    const fetchFriends = async () => {
        setIsLoadingFriends(true);
        try {
            const res = await axios.get(`${BACKEND_URL}/buddies/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFriends(res.data);
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Failed to load friends' });
        } finally {
            setIsLoadingFriends(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        Keyboard.dismiss();
        setIsSearching(true);
        try {
            const res = await axios.get(`${BACKEND_URL}/buddies/search?query=${encodeURIComponent(searchQuery)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSearchResults(res.data);
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Search failed' });
        } finally {
            setIsSearching(false);
        }
    };

    const sendRequest = async (receiverId) => {
        try {
            await axios.post(`${BACKEND_URL}/buddies/request`,
                { receiverId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Toast.show({ type: 'hotstarSuccess', text1: 'Cinerequest Sent!' });
        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to send request';
            Toast.show({ type: 'hotstarError', text1: msg });
        }
    };

    const unfriendUser = async (friendId) => {
        try {
            await axios.post(`${BACKEND_URL}/buddies/unfriend`,
                { friendId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Toast.show({ type: 'hotstarSuccess', text1: 'Removed from CineBuddies' });
            // Update local state to reflect removal
            setFriends(prev => prev.filter(f => f._id !== friendId));
            setSearchResults(prev => prev.map(u => u)); // trigger re-render
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Failed to unfriend' });
        }
    };

    // Optimistic badge clearing before navigation
    const handleOpenChat = (friendId) => {
        setFriends(prev => prev.map(f => f._id === friendId ? { ...f, unreadCount: 0 } : f));
        router.push(`/chat?buddyId=${friendId}`);
    };

    const renderFriend = ({ item }) => {
        const initial = item.name ? item.name.charAt(0).toUpperCase() : '?';
        return (
            <TouchableOpacity style={styles.userCard} onPress={() => handleOpenChat(item._id)}>

                {/* NEW AVATAR WRAPPER FOR ONLINE DOT */}
                <View style={styles.avatarWrapper}>
                    <LinearGradient colors={['#9B51E0', '#FF007A']} style={styles.avatar}>
                        <Text style={styles.avatarText}>{initial}</Text>
                    </LinearGradient>
                    {item.isOnline && <View style={styles.onlineIndicator} />}
                </View>

                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={[styles.userEmail, item.isOnline && { color: '#00E676' }]}>
                        {item.isOnline ? 'Online' : 'Tap to chat'}
                    </Text>
                </View>

                {/* UNREAD CHAT BADGE */}
                {item.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                    </View>
                ) : (
                    <Ionicons name="chatbubble-ellipses" size={20} color="#8F98A0" />
                )}
            </TouchableOpacity>
        );
    };

    const renderSearchResult = ({ item }) => {
        const initial = item.name ? item.name.charAt(0).toUpperCase() : '?';
        const isAlreadyFriend = friends.some(f => f._id === item._id);

        return (
            <View style={styles.userCard}>
                <View style={[styles.avatar, { backgroundColor: '#2A2A30' }]}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userEmail}>{item.email}</Text>
                </View>

                {/* DYNAMIC ADD / UNFRIEND BUTTON */}
                {isAlreadyFriend ? (
                    <TouchableOpacity style={[styles.addBtn, { borderColor: '#E53935', backgroundColor: 'rgba(229, 57, 53, 0.1)' }]} onPress={() => unfriendUser(item._id)}>
                        <Ionicons name="person-remove" size={16} color="#E53935" />
                        <Text style={[styles.addBtnText, { color: '#E53935' }]}>Unfriend</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={() => sendRequest(item._id)}>
                        <Ionicons name="person-add" size={16} color="#00E5FF" />
                        <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>CineBuddies</Text>
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === 'chats' && styles.activeTab]} onPress={() => setActiveTab('chats')}>
                    <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>Chats</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'discover' && styles.activeTab]} onPress={() => setActiveTab('discover')}>
                    <Text style={[styles.tabText, activeTab === 'discover' && styles.activeTabText]}>Discover</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'chats' ? (
                isLoadingFriends ? (
                    <ActivityIndicator size="large" color="#9B51E0" style={{ marginTop: 50 }} />
                ) : (
                    <FlatList
                        data={friends}
                        keyExtractor={item => item._id}
                        renderItem={renderFriend}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>You have no CineBuddies yet. Go to Discover to find friends!</Text>}
                    />
                )
            ) : (
                <View style={styles.discoverContainer}>
                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={20} color="#8F98A0" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search by name or email..."
                            placeholderTextColor="#8F98A0"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                            autoCapitalize="none"
                        />
                    </View>

                    {isSearching ? (
                        <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40 }} />
                    ) : (
                        <FlatList
                            data={searchResults}
                            keyExtractor={item => item._id}
                            renderItem={renderSearchResult}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                searchQuery ? <Text style={styles.emptyText}>No users found.</Text> : null
                            }
                        />
                    )}
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    backButton: { marginRight: 16 },
    headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold' },

    tabContainer: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: '#17171C', borderRadius: 8, padding: 4, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
    activeTab: { backgroundColor: '#2A2A30' },
    tabText: { color: '#8F98A0', fontWeight: '600', fontSize: 14 },
    activeTabText: { color: '#FFFFFF' },

    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    emptyText: { color: '#8F98A0', textAlign: 'center', marginTop: 40, fontSize: 15, paddingHorizontal: 20 },

    userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#17171C', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },

    // NEW AVATAR STYLES (Wrapper for the Green Dot)
    avatarWrapper: { position: 'relative', marginRight: 14 },
    avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    onlineIndicator: {
        position: 'absolute',
        bottom: -2, right: -2,
        width: 14, height: 14,
        borderRadius: 7,
        backgroundColor: '#00E676',
        borderWidth: 2.5,
        borderColor: '#17171C' // Matches userCard background 
    },

    userInfo: { flex: 1 },
    userName: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    userEmail: { color: '#8F98A0', fontSize: 13 },

    unreadBadge: { backgroundColor: '#00E5FF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
    unreadBadgeText: { color: '#000', fontSize: 12, fontWeight: 'bold' },

    addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 229, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)', gap: 6 },
    addBtnText: { color: '#00E5FF', fontWeight: 'bold', fontSize: 13 },

    discoverContainer: { flex: 1 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#17171C', marginHorizontal: 16, paddingHorizontal: 16, height: 50, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 16 },
    searchInput: { flex: 1, color: '#FFF', fontSize: 15, marginLeft: 10 }
});