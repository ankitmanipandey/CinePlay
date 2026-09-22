import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/useAuthStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export const useTheatreLobbyLogic = () => {
    const router = useRouter();
    const { token, user } = useAuthStore();

    const [publicRooms, setPublicRooms] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Join State
    const [joinCode, setJoinCode] = useState('');

    // Create Modal State
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [newRoomPin, setNewRoomPin] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const fetchPublicRooms = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${BACKEND_URL}/rooms/public`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPublicRooms(res.data);
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Failed to fetch public rooms' });
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        fetchPublicRooms();
    }, [fetchPublicRooms]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchPublicRooms();
    };

    const handleJoinPrivate = () => {
        if (joinCode.length === 5) {
            router.push(`/theatre?roomId=${joinCode}&isHost=false`);
        } else {
            Toast.show({ type: 'hotstarError', text1: 'Enter a valid 5-digit code' });
        }
    };

    const handleCreateRoomSubmit = async () => {
        setIsCreating(true);
        try {
            const payload = {
                roomName: newRoomName.trim() || `${user?.name?.split(' ')[0] || 'My'} Theatre`,
                isPublic,
                pin: !isPublic && newRoomPin.trim().length > 0 ? newRoomPin.trim() : null
            };

            const res = await axios.post(`${BACKEND_URL}/rooms`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setIsCreateModalVisible(false);
            router.push(`/theatre?roomId=${res.data.roomId}&isHost=true`);
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Failed to create room' });
        } finally {
            setIsCreating(false);
        }
    };

    return {
        router,
        user,
        publicRooms,
        isLoading,
        refreshing,
        joinCode,
        setJoinCode,
        isCreateModalVisible,
        setIsCreateModalVisible,
        newRoomName,
        setNewRoomName,
        isPublic,
        setIsPublic,
        newRoomPin,
        setNewRoomPin,
        isCreating,
        onRefresh,
        handleJoinPrivate,
        handleCreateRoomSubmit
    };
};