import { useState, useEffect, useCallback } from 'react';
import { Keyboard } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '../store/useAuthStore';
import { useGlobalSocket } from '../store/useGlobalSocket';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const useCineBuddiesLogic = () => {
    const router = useRouter();
    const { token } = useAuthStore();
    const { globalSocket } = useGlobalSocket();

    const [activeTab, setActiveTab] = useState('chats');
    const [friends, setFriends] = useState([]);
    const [isLoadingFriends, setIsLoadingFriends] = useState(true);

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

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.trim()) {
                executeSearch();
            } else {
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

    const handleManualSubmit = () => {
        Keyboard.dismiss();
        if (searchQuery.trim()) {
            executeSearch();
        }
    };

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

    const getUserStatus = (id) => {
        if (discoverData.friends.some(f => f._id === id)) return 'friend';
        if (discoverData.received.some(r => r._id === id)) return 'received';
        if (discoverData.sent.some(s => s._id === id)) return 'sent';
        return 'none';
    };

    return {
        router, activeTab, setActiveTab, friends, isLoadingFriends, discoverData,
        isLoadingDiscover, searchQuery, setSearchQuery, searchResults, isSearching,
        handleManualSubmit, sendRequest, unfriendUser, handleRequestAction,
        handleOpenChat, getUserStatus
    };
};