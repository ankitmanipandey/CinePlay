import { useState, useEffect } from 'react';
import { Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '../store/useAuthStore';
import { useGlobalSocket } from '../store/useGlobalSocket';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

export const useChatLogic = () => {
    const router = useRouter();
    const { buddyId } = useLocalSearchParams();
    const safeBuddyId = Array.isArray(buddyId) ? buddyId[0] : buddyId;

    const { token, user } = useAuthStore();
    const { globalSocket, setActiveChat } = useGlobalSocket();

    const [messages, setMessages] = useState([]);
    const [buddyInfo, setBuddyInfo] = useState(null);
    const [isBuddyOnline, setIsBuddyOnline] = useState(false);
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
                setIsBuddyOnline(res.data.buddy.isOnline);
                setMessages(res.data.messages);
                setIsFriend(res.data.isFriend);
                markMessagesAsRead();
            } catch (error) {
                console.error("Failed to load chat", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [safeBuddyId, token]);

    useEffect(() => {
        if (safeBuddyId) {
            setActiveChat(safeBuddyId);
        }
        return () => setActiveChat(null);
    }, [safeBuddyId, setActiveChat]);

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
            setMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
            Toast.show({
                type: 'hotstarError',
                text1: error.response?.status === 403 ? 'Cannot send message' : 'Message failed to send'
            });
            if (error.response?.status === 403) setIsFriend(false);
        }
    };

    return {
        router, user,
        messages, buddyInfo, isBuddyOnline, isFriend,
        inputText, setInputText, isLoading, sendMessage
    };
};