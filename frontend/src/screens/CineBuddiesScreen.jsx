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

    // Discover State
    const [discoverData, setDiscoverData] = useState({ friends: [], sent: [], received: [] });
    const [isLoadingDiscover, setIsLoadingDiscover] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    useFocusEffect(
        useCallback(() => {
            if (activeTab === 'chats') {
                fetchFriends();
            } else if (activeTab === 'discover') {
                fetchDiscoverData();
            }
        }, [activeTab])
    );

    useEffect(() => {
        if (!globalSocket) return;

        // 1. Live Chat Counter & Status
        const handleRealTimeChat = (newMessage) => {
            setFriends(prev => prev.map(friend => {
                if (String(friend._id) === String(newMessage.sender)) {
                    return { ...friend, unreadCount: (friend.unreadCount || 0) + 1 };
                }
                return friend;
            }));
        };

        const handleStatus = ({ userId, isOnline }) => {
            setFriends(prev => prev.map(f =>
                String(f._id) === String(userId) ? { ...f, isOnline } : f
            ));
        };

        // 2. Discover Real-Time Sync
        const handleNewNotification = (notification) => {
            if (notification.type === 'CINEREQUEST') {
                setDiscoverData(prev => ({
                    ...prev,
                    received: [{ _id: notification.senderId, name: 'New Request' }, ...prev.received]
                }));
                if (activeTab === 'discover') fetchDiscoverData();
            } else if (notification.type === 'ACCEPTED_ALERT') {
                if (activeTab === 'discover') fetchDiscoverData();
            }
        };

        const handleRequestRejected = (alert) => {
            setDiscoverData(prev => ({
                ...prev,
                sent: prev.sent.filter(user => user._id !== alert.senderId)
            }));
        };

        const handleFriendRemoved = (data) => {
            setDiscoverData(prev => ({
                ...prev,
                friends: prev.friends.filter(f => f._id !== data.unfriendedBy)
            }));
            setFriends(prev => prev.filter(f => f._id !== data.unfriendedBy));
        };

        globalSocket.on('receive_direct_message', handleRealTimeChat);
        globalSocket.on('user_status', handleStatus);
        globalSocket.on('new_notification', handleNewNotification);
        globalSocket.on('request_rejected', handleRequestRejected);
        globalSocket.on('friend_removed', handleFriendRemoved);

        return () => {
            globalSocket.off('receive_direct_message', handleRealTimeChat);
            globalSocket.off('user_status', handleStatus);
            globalSocket.off('new_notification', handleNewNotification);
            globalSocket.off('request_rejected', handleRequestRejected);
            globalSocket.off('friend_removed', handleFriendRemoved);
        };
    }, [globalSocket, activeTab]);

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

    const fetchDiscoverData = async () => {
        setIsLoadingDiscover(true);
        try {
            const res = await axios.get(`${BACKEND_URL}/buddies/discover`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDiscoverData(res.data);
        } catch (error) {
            console.log(error);
        } finally {
            setIsLoadingDiscover(false);
        }
    };

    // --- DEBOUNCED SEARCH LOGIC (300ms delay) ---
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim()) {
                executeSearch();
            } else {
                // Instantly clear results if user deletes their input
                setSearchResults([]);
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const executeSearch = async () => {
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

    // Allows the user to still press the return/search key to dismiss keyboard
    const handleManualSubmit = () => {
        Keyboard.dismiss();
        if (searchQuery.trim()) {
            executeSearch();
        }
    };

    // --- OPTIMISTIC ACTIONS ---
    const sendRequest = async (user) => {
        setDiscoverData(prev => ({ ...prev, sent: [...prev.sent, user] }));
        try {
            await axios.post(`${BACKEND_URL}/buddies/request`,
                { receiverId: user._id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Toast.show({ type: 'hotstarSuccess', text1: 'Cinerequest Sent!' });
        } catch (error) {
            setDiscoverData(prev => ({ ...prev, sent: prev.sent.filter(u => u._id !== user._id) }));
            const msg = error.response?.data?.message || 'Failed to send request';
            Toast.show({ type: 'hotstarError', text1: msg });
        }
    };

    const unfriendUser = async (user) => {
        setDiscoverData(prev => ({ ...prev, friends: prev.friends.filter(f => f._id !== user._id) }));
        setFriends(prev => prev.filter(f => f._id !== user._id));
        try {
            await axios.post(`${BACKEND_URL}/buddies/unfriend`,
                { friendId: user._id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Toast.show({ type: 'hotstarSuccess', text1: 'Removed from CineBuddies' });
        } catch (error) {
            fetchDiscoverData();
            Toast.show({ type: 'hotstarError', text1: 'Failed to unfriend' });
        }
    };

    const handleRequestAction = async (action, user) => {
        if (action === 'accept') {
            setDiscoverData(prev => ({
                ...prev,
                received: prev.received.filter(u => u._id !== user._id),
                friends: [...prev.friends, user]
            }));
        } else {
            setDiscoverData(prev => ({
                ...prev,
                received: prev.received.filter(u => u._id !== user._id)
            }));
        }
        try {
            await axios.post(`${BACKEND_URL}/buddies/${action}`,
                { senderId: user._id },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Toast.show({ type: 'hotstarSuccess', text1: `Request ${action === 'accept' ? 'Accepted' : 'Rejected'}` });
        } catch (error) {
            fetchDiscoverData();
            Toast.show({ type: 'hotstarError', text1: 'Action failed' });
        }
    };

    const handleOpenChat = (friendId) => {
        setFriends(prev => prev.map(f => f._id === friendId ? { ...f, unreadCount: 0 } : f));
        router.push(`/chat?buddyId=${friendId}`);
    };

    // --- RENDER HELPERS ---
    const getUserStatus = (id) => {
        if (discoverData.friends.some(f => f._id === id)) return 'friend';
        if (discoverData.received.some(r => r._id === id)) return 'received';
        if (discoverData.sent.some(s => s._id === id)) return 'sent';
        return 'none';
    };

    const renderDynamicButton = (item, status) => {
        switch (status) {
            case 'friend':
                return (
                    <TouchableOpacity style={[styles.actionBtn, styles.unfriendBtn]} onPress={() => unfriendUser(item)}>
                        <Ionicons name="person-remove" size={16} color="#E53935" />
                        <Text style={[styles.btnText, { color: '#E53935' }]}>Unfriend</Text>
                    </TouchableOpacity>
                );
            case 'sent':
                return (
                    <View style={[styles.actionBtn, styles.sentBtn]}>
                        <Ionicons name="checkmark-done" size={16} color="#B3B3B3" />
                        <Text style={[styles.btnText, { color: '#B3B3B3' }]}>Sent</Text>
                    </View>
                );
            case 'received':
                return (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.iconBtnAccept} onPress={() => handleRequestAction('accept', item)}>
                            <Ionicons name="checkmark" size={20} color="#00E676" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconBtnReject} onPress={() => handleRequestAction('reject', item)}>
                            <Ionicons name="close" size={20} color="#E53935" />
                        </TouchableOpacity>
                    </View>
                );
            default: // 'none'
                return (
                    <TouchableOpacity style={[styles.actionBtn, styles.addBtn]} onPress={() => sendRequest(item)}>
                        <Ionicons name="person-add" size={16} color="#00E5FF" />
                        <Text style={[styles.btnText, { color: '#00E5FF' }]}>Add</Text>
                    </TouchableOpacity>
                );
        }
    };

    const renderUserItem = ({ item }) => {
        const initial = item.name ? item.name.charAt(0).toUpperCase() : '?';
        const status = getUserStatus(item._id);

        return (
            <View style={styles.userCard}>
                <View style={[styles.avatar, { backgroundColor: '#2A2A30' }]}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userEmail}>{item.email || 'CineBuddy User'}</Text>
                </View>
                {renderDynamicButton(item, status)}
            </View>
        );
    };

    const renderFriendChat = ({ item }) => {
        const initial = item.name ? item.name.charAt(0).toUpperCase() : '?';
        return (
            <TouchableOpacity style={styles.userCard} onPress={() => handleOpenChat(item._id)}>
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
                        renderItem={renderFriendChat}
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
                            onSubmitEditing={handleManualSubmit}
                            returnKeyType="search"
                            autoCapitalize="none"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                                <Ionicons name="close-circle" size={20} color="#8F98A0" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {isSearching || isLoadingDiscover ? (
                        <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40 }} />
                    ) : searchQuery ? (
                        <FlatList
                            data={searchResults}
                            keyExtractor={item => item._id}
                            renderItem={renderUserItem}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={<Text style={styles.emptyText}>No users found.</Text>}
                        />
                    ) : (
                        <FlatList
                            data={[
                                ...(discoverData.received.length ? [{ isHeader: true, title: 'Received Requests' }, ...discoverData.received] : []),
                                ...(discoverData.sent.length ? [{ isHeader: true, title: 'Sent Requests' }, ...discoverData.sent] : []),
                                ...(discoverData.friends.length ? [{ isHeader: true, title: 'Your Friends' }, ...discoverData.friends] : [])
                            ]}
                            keyExtractor={(item, index) => item.isHeader ? item.title : item._id}
                            renderItem={({ item }) => {
                                if (item.isHeader) {
                                    return <Text style={styles.sectionHeader}>{item.title}</Text>;
                                }
                                return renderUserItem({ item });
                            }}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={<Text style={styles.emptyText}>No recent activity. Search for users to add them!</Text>}
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
    sectionHeader: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginTop: 20, marginBottom: 10, marginLeft: 4 },

    userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#17171C', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },

    avatarWrapper: { position: 'relative', marginRight: 14 },
    avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    avatarText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    onlineIndicator: {
        position: 'absolute',
        bottom: -2, right: 10,
        width: 14, height: 14,
        borderRadius: 7,
        backgroundColor: '#00E676',
        borderWidth: 2.5,
        borderColor: '#17171C'
    },

    userInfo: { flex: 1 },
    userName: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
    userEmail: { color: '#8F98A0', fontSize: 13 },

    unreadBadge: { backgroundColor: '#00E5FF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center' },
    unreadBadgeText: { color: '#000', fontSize: 12, fontWeight: 'bold' },

    actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, gap: 6 },
    addBtn: { backgroundColor: 'rgba(0, 229, 255, 0.1)', borderColor: 'rgba(0, 229, 255, 0.3)' },
    unfriendBtn: { backgroundColor: 'rgba(229, 57, 53, 0.1)', borderColor: 'rgba(229, 57, 53, 0.3)' },
    sentBtn: { backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)' },
    btnText: { fontWeight: 'bold', fontSize: 13 },

    actionRow: { flexDirection: 'row', gap: 8 },
    iconBtnAccept: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0, 230, 118, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 230, 118, 0.3)' },
    iconBtnReject: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(229, 57, 53, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(229, 57, 53, 0.3)' },

    discoverContainer: { flex: 1 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#17171C', marginHorizontal: 16, paddingHorizontal: 16, height: 50, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 8 },
    searchInput: { flex: 1, color: '#FFF', fontSize: 15, marginLeft: 10, marginRight: 10 }
});