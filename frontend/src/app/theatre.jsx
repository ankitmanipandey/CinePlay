import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    FlatList,
    Image,
    ActivityIndicator,
    Keyboard,
    StatusBar,
    ScrollView,
    useWindowDimensions,
    Modal,
    BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import * as ScreenOrientation from 'expo-screen-orientation';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient'; // <-- Added import
import axios from 'axios';

import TheatrePlayer from '../screens/TheatrePlayer';
import { useAuthStore } from '../store/useAuthStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;
const SOCKET_URL = BACKEND_URL;

// --- MULTI-KEY ROUND ROBIN SETUP ---
const RAW_KEYS = process.env.EXPO_PUBLIC_YOUTUBE_API_KEYS || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '';
let ACTIVE_YT_KEYS = RAW_KEYS.split(',').map(k => k.trim()).filter(Boolean);

const fetchYouTubeWithRetry = async (urlTemplate) => {
    while (ACTIVE_YT_KEYS.length > 0) {
        const currentKey = ACTIVE_YT_KEYS[0];

        const url = urlTemplate.replace('__API_KEY__', currentKey);

        try {
            const res = await fetch(url);
            const data = await res.json();

            // Check for Quota Exceeded (429) or Access Forbidden (403)
            if (data.error && (data.error.code === 403 || data.error.code === 429)) {
                console.warn(`[TheatreScreen YT Quota Error] Key failed: ${currentKey}. Removing from rotation...`);
                ACTIVE_YT_KEYS.shift(); // Permanently deletes dead key for this session
                continue; // Immediately try the next key
            }

            return data; // Request was successful
        } catch (err) {
            console.error("[TheatreScreen YT Fetch Error]", err);
            return { error: { code: 500, message: "Network error occurred." } };
        }
    }

    return { error: { code: 429, message: 'All YouTube API keys have exhausted their daily quota.' } };
};

export default function TheatreScreen() {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const { roomId, isHost } = useLocalSearchParams();
    const isHostBool = isHost === 'true';

    // --- Loading State ---
    // Viewers start in a "joining" state until the server confirms the room exists
    const [isJoining, setIsJoining] = useState(!isHostBool);

    // --- User Identity & Room State ---
    const { user, token } = useAuthStore();
    const [username, setUsername] = useState('');
    const [roomUsers, setRoomUsers] = useState([]);
    const [selectedUserToMod, setSelectedUserToMod] = useState(null);

    const [socket, setSocket] = useState(null);
    const [ytId, setYtId] = useState('');
    const [videoTitle, setVideoTitle] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    const playerRef = useRef(null);
    const isPlayingRef = useRef(false);

    // --- Search State ---
    const [searchInput, setSearchInput] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // --- Chat & Tab State ---
    const [activeTab, setActiveTab] = useState('search');
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const chatListRef = useRef(null);

    // --- NEW: Keyboard State ---
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    const [isShareModalVisible, setIsShareModalVisible] = useState(false);
    const [friendsList, setFriendsList] = useState([]);
    const [isFetchingFriends, setIsFetchingFriends] = useState(false);
    const [isWaitingForHost, setIsWaitingForHost] = useState(false);
    const [pendingJoinRequest, setPendingJoinRequest] = useState(null);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    // --- Keyboard Listeners ---
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            'keyboardDidShow',
            () => setIsKeyboardVisible(true)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            'keyboardDidHide',
            () => setIsKeyboardVisible(false)
        );

        return () => {
            keyboardDidHideListener.remove();
            keyboardDidShowListener.remove();
        };
    }, []);

    useEffect(() => {
        const onHardwareBackPress = () => {
            handleBackPress(); // Trigger your custom exit logic
            return true; // Return true to stop the default Android back behavior
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            onHardwareBackPress
        );

        return () => backHandler.remove();
    }, [isFullScreen, isHostBool, socket, roomId]);

    // --- 1. CORE SOCKET SETUP ---
    useEffect(() => {
        const assignedUsername = user?.name ? user.name : `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
        setUsername(assignedUsername);

        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            newSocket.emit('join_room', {
                roomId,
                username: assignedUsername,
                isHost: isHostBool,
                userId: user?._id // Required for the Gatekeeper logic!
            });
        });

        newSocket.on('room_users', (userList) => {
            setIsJoining(false); // Room is confirmed, hide loading screen
            setRoomUsers(userList);
        });

        newSocket.on('kicked_from_room', (data) => {
            Toast.show({ type: 'hotstarError', text1: 'Removed', text2: data.reason, position: 'top' });
            if (router.canGoBack()) router.back();
            else router.replace('/');
        });

        newSocket.on('new_video', (data) => {
            if (isHostBool) return;
            setYtId(data.ytId);
            setVideoTitle(data.title);
            setIsPlaying(true);
            setIsMuted(false);
        });

        newSocket.on('room_not_found', () => {
            Toast.show({
                type: 'hotstarError',
                text1: 'Room Not Found',
                text2: 'This room does not exist or has been closed.',
                position: 'top'
            });
            // Safe routing exit
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/');
            }
        });

        newSocket.on('waiting_for_host', () => {
            setIsJoining(false);
            setIsWaitingForHost(true);
        });

        newSocket.on('entry_approved', () => {
            setIsWaitingForHost(false);
            Toast.show({ type: 'hotstarSuccess', text1: 'Host let you in!', position: 'top' });
        });

        newSocket.on('entry_denied', (data) => {
            Toast.show({ type: 'hotstarError', text1: 'Entry Denied', text2: data.reason, position: 'top' });
            if (router.canGoBack()) router.back();
            else router.replace('/');
        });

        newSocket.on('request_host_permission', (data) => {
            if (isHostBool) {
                setPendingJoinRequest(data);
            }
        });

        newSocket.on('remote_sync', (data) => {
            if (isHostBool) return;

            playerRef.current?.getCurrentTime().then(viewerTime => {
                const timeDiff = Math.abs(viewerTime - data.timestamp);

                if (data.action === 'pause') {
                    setIsMuted(true);
                    setIsPlaying(true);

                    if (timeDiff > 0.001) {
                        playerRef.current?.seekTo(data.timestamp, true);
                    }
                } else {
                    setIsMuted(false);
                    setIsPlaying(true);

                    if (timeDiff > 2) {
                        playerRef.current?.seekTo(data.timestamp + 0.5, true);
                    }
                }
            }).catch(() => { });
        });

        newSocket.on('receive_chat', (data) => {
            setMessages(prev => [...prev, data]);
            // Optional: Auto-scroll on new message
            setTimeout(() => {
                chatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        });

        newSocket.on('room_closed', () => {
            if (!isHostBool) {
                Toast.show({ type: 'hotstarError', text1: 'Room Closed', text2: 'The host has ended the watch party.', position: 'top' });
                // Safe routing exit
                if (router.canGoBack()) {
                    router.back();
                } else {
                    router.replace('/');
                }
            }
        });

        return () => {
            newSocket.disconnect();
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        };
    }, [roomId, isHostBool, user]);

    // --- 2. HOST SYNC ENGINE (Real-Time Heartbeat) ---
    useEffect(() => {
        if (!isHostBool || !socket || !ytId) return;

        let lastTime = 0;
        const interval = setInterval(() => {
            playerRef.current?.getCurrentTime().then(currentTime => {
                const currentIsPlaying = isPlayingRef.current;

                if (currentIsPlaying && Math.abs(currentTime - lastTime - 1) > 2 && lastTime !== 0) {
                    socket.emit('sync_action', { roomId, action: 'play', timestamp: currentTime });
                }
                lastTime = currentTime;

                socket.emit('sync_action', {
                    roomId,
                    action: currentIsPlaying ? 'play' : 'pause',
                    timestamp: currentTime,
                });
            }).catch(() => { });
        }, 1000);

        return () => clearInterval(interval);
    }, [isHostBool, socket, ytId, roomId]);

    const onPlayerStateChange = (state) => {
        if (!isHostBool) return;

        playerRef.current?.getCurrentTime().then(currentTime => {
            if (state === 'playing') {
                setIsPlaying(true);
                socket?.emit('sync_action', { roomId, action: 'play', timestamp: currentTime });
            } else if (state === 'paused' || state === 'buffering') {
                setIsPlaying(false);
                socket?.emit('sync_action', { roomId, action: 'pause', timestamp: currentTime });
            }
        }).catch(() => { });
    };

    const handleSearch = async () => {
        if (!searchInput.trim()) return;
        Keyboard.dismiss();
        setIsSearching(true);
        try {
            // Apply the dynamic round-robin URL template instead of standard fetch
            const searchUrlTemplate = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchInput)}&type=video&maxResults=10&key=__API_KEY__`;

            const data = await fetchYouTubeWithRetry(searchUrlTemplate);

            if (data.error) {
                Toast.show({ type: 'hotstarError', text1: data.error.message });
            } else if (data.items) {
                setSearchResults(data.items);
            }
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectVideo = (selectedYtId, selectedTitle) => {
        setYtId(selectedYtId);
        setVideoTitle(selectedTitle);
        setIsPlaying(true);
        socket.emit('change_video', { roomId, ytId: selectedYtId, title: selectedTitle });
        setSearchResults([]);
        setSearchInput('');
    };

    const toggleFullScreen = async () => {
        if (isFullScreen) {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            setIsFullScreen(false);
        } else {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            setIsFullScreen(true);
        }
    };

    const handleBackPress = async () => {
        if (isFullScreen) {
            await toggleFullScreen();
        } else {
            if (isHostBool && socket) socket.emit('close_room', roomId);
            router.back();
        }
    };

    const handleHostDecision = (decision) => {
        if (!pendingJoinRequest) return;
        socket.emit('host_decision', {
            ...pendingJoinRequest,
            decision,
            roomId,
            hostUserId: user._id
        });
        setPendingJoinRequest(null);
    };

    const handleKick = () => {
        if (!selectedUserToMod) return;
        socket.emit('kick_user', { roomId, targetUsername: selectedUserToMod });
        setSelectedUserToMod(null);
        Toast.show({ type: 'hotstarSuccess', text1: `${selectedUserToMod} was kicked.` });
    };

    const handleKickAndBlock = () => {
        if (!selectedUserToMod) return;
        socket.emit('kick_and_block_user', { roomId, targetUsername: selectedUserToMod, hostUserId: user._id });
        setSelectedUserToMod(null);
        Toast.show({ type: 'hotstarSuccess', text1: `${selectedUserToMod} was blocked.` });
    };

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;
        const msgData = {
            id: Date.now().toString(),
            roomId,
            sender: username,
            text: chatInput.trim(),
        };
        setMessages(prev => [...prev, msgData]);
        socket.emit('send_chat', msgData);
        setChatInput('');
    };

    const renderSearchResult = ({ item }) => (
        <TouchableOpacity style={styles.resultCard} activeOpacity={0.8} onPress={() => handleSelectVideo(item.id.videoId, item.snippet?.title)}>
            <Image source={{ uri: item.snippet?.thumbnails?.medium?.url }} style={styles.resultImage} />
            <View style={styles.resultPlayIcon}>
                <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.8)" />
            </View>
            <Text style={styles.resultTitle} numberOfLines={2}>{item.snippet?.title}</Text>
        </TouchableOpacity>
    );

    const renderChatMessage = ({ item }) => {
        const isMe = item.sender === username;
        return (
            <View style={[styles.chatMsgWrapper, isMe ? styles.chatMsgRight : styles.chatMsgLeft]}>
                {!isMe && <Text style={styles.chatSenderName}>{item.sender}</Text>}
                {isMe ? (
                    <LinearGradient
                        colors={['#00E5FF', '#9B51E0', '#FF007A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.chatBubble, styles.chatBubbleMe]}
                    >
                        <Text style={styles.chatText}>{item.text}</Text>
                    </LinearGradient>
                ) : (
                    <View style={[styles.chatBubble, styles.chatBubbleThem]}>
                        <Text style={styles.chatText}>{item.text}</Text>
                    </View>
                )}
            </View>
        );
    };

    const openShareModal = async () => {
        if (!user) {
            Toast.show({ type: 'hotstarInfo', text1: 'Log in to invite friends!' });
            return;
        }
        setIsShareModalVisible(true);
        setIsFetchingFriends(true);
        try {
            const res = await axios.get(`${BACKEND_URL}/buddies/list`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFriendsList(res.data);
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Failed to load friends.' });
        } finally {
            setIsFetchingFriends(false);
        }
    };

    const sendTheatreInvite = async (receiverId) => {
        try {
            await axios.post(`${BACKEND_URL}/buddies/invite`,
                { receiverId, roomId, videoTitle }, // <-- ADDED videoTitle here!
                { headers: { Authorization: `Bearer ${token}` } }
            );
            Toast.show({ type: 'hotstarSuccess', text1: 'Invite Sent!' });
            setIsShareModalVisible(false);
        } catch (error) {
            // This will perfectly grab the 'Your Friend is blocked by Creator.' message
            const msg = error.response?.data?.message || 'Failed to send invite.';
            Toast.show({ type: 'hotstarError', text1: msg });
        }
    };

    const actualWidth = Math.max(width, height);
    const actualHeight = Math.min(width, height);
    const containerWidth = isFullScreen ? actualWidth : width;
    const containerHeight = isFullScreen ? actualHeight : width * (9 / 16);
    const innerVideoWidth = isFullScreen ? actualHeight * (16 / 9) : width;
    const innerVideoHeight = isFullScreen ? actualHeight : width * (9 / 16);

    // --- Loading UI ---
    if (isJoining) {
        return (
            <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar hidden={false} barStyle="light-content" backgroundColor="#000" />
                <ActivityIndicator size="large" color="#00E5FF" />
                <Text style={{ color: '#8F98A0', marginTop: 16, fontSize: 16, fontWeight: '500' }}>
                    Connecting to Room...
                </Text>
            </SafeAreaView>
        );
    }

    if (isWaitingForHost) {
        return (
            <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar hidden={false} barStyle="light-content" backgroundColor="#000" />
                <ActivityIndicator size="large" color="#FF007A" />
                <Text style={{ color: '#FFF', marginTop: 16, fontSize: 18, fontWeight: 'bold' }}>
                    Asking to enter...
                </Text>
                <Text style={{ color: '#8F98A0', marginTop: 8, fontSize: 14 }}>
                    Waiting for the Host to let you in.
                </Text>
                <TouchableOpacity onPress={handleBackPress} style={{ marginTop: 24, padding: 12 }}>
                    <Text style={{ color: '#00E5FF', fontWeight: 'bold' }}>Cancel</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // --- Main UI ---
    return (
        <SafeAreaView style={styles.safeArea} edges={isFullScreen ? [] : ['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior="padding"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
            >
                <StatusBar hidden={isFullScreen} showHideTransition="slide" barStyle="light-content" backgroundColor="#000" translucent={false} />

                <View style={[
                    styles.playerContainer,
                    { width: containerWidth, height: containerHeight },
                    isFullScreen && {
                        position: 'absolute', top: 0, left: 0, zIndex: 9999, elevation: 9999,
                        backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'
                    }
                ]}>
                    <TheatrePlayer
                        ref={playerRef}
                        ytId={ytId}
                        isPlaying={isPlaying}
                        isMuted={isMuted}
                        isHostBool={isHostBool}
                        onPlayerStateChange={onPlayerStateChange}
                        width={innerVideoWidth}
                        height={innerVideoHeight}
                    />

                    {isFullScreen && (
                        <TouchableOpacity style={styles.fullscreenExitBtn} onPress={toggleFullScreen} activeOpacity={0.7}>
                            <Ionicons name="close" size={26} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={{ display: isFullScreen ? 'none' : 'flex', flex: 1 }}>

                    {/* HIDE THESE ELEMENTS WHEN KEYBOARD IS VISIBLE */}
                    <>
                        {videoTitle !== '' && (
                            <View style={styles.nowPlayingBar}>
                                {/* Using Theme Cyan */}
                                <Ionicons name="play" size={14} color="#00E5FF" />
                                <Text style={styles.nowPlayingText} numberOfLines={1}>
                                    <Text style={{ color: '#8F98A0', fontWeight: 'bold' }}>Now Playing: </Text>
                                    {videoTitle}
                                </Text>
                            </View>
                        )}

                        <View style={styles.externalControlBar}>
                            <View style={styles.externalLeftControls}>
                                <TouchableOpacity onPress={handleBackPress} style={styles.externalBtn}>
                                    <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={toggleFullScreen} style={styles.externalBtn}>
                                    <Ionicons name="expand" size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>

                            {/* Flexible spacer prevents left and right controls from ever colliding */}
                            <View style={{ flex: 1, minWidth: 16 }} />

                            {/* Wrap right controls in a ScrollView for narrow screens */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.externalRightControls}
                                bounces={false}
                            >
                                <TouchableOpacity onPress={openShareModal} style={[styles.externalBtn, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
                                    <Ionicons name="paper-plane" size={16} color="#00E5FF" />
                                    <Text style={[styles.externalBtnText, { color: '#00E5FF' }]}>Share</Text>
                                </TouchableOpacity>
                                {/* Using Theme Purple */}
                                <View style={[styles.externalBtn, { backgroundColor: 'rgba(155, 81, 224, 0.15)' }]}>
                                    <Ionicons name="key" size={16} color="#9B51E0" />
                                    <Text style={[styles.externalBtnText, { color: '#9B51E0', letterSpacing: 1 }]}>{roomId}</Text>
                                </View>

                                <View style={[styles.externalBtn, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                                    <Ionicons name="people" size={18} color="#8F98A0" />
                                    <Text style={[styles.externalBtnText, { color: '#8F98A0' }]}>{roomUsers.length}</Text>
                                </View>
                            </ScrollView>
                        </View>

                        {roomUsers.length > 0 && (
                            <View style={styles.roomUsersContainer}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomUsersScroll}>
                                    {roomUsers
                                        .filter(name => name !== username)
                                        .map((name, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={styles.userChip}
                                                activeOpacity={isHostBool ? 0.7 : 1}
                                                onPress={() => {
                                                    if (isHostBool) setSelectedUserToMod(name);
                                                }}
                                            >
                                                <View style={styles.userChipDot} />
                                                <Text style={styles.userChipText}>{name}</Text>
                                            </TouchableOpacity> /* <-- Fixed closing tag here */
                                        ))}
                                </ScrollView>
                            </View>
                        )}
                    </>

                    <View style={styles.controlsContainer}>
                        {/* HIDE TABS WHEN KEYBOARD IS VISIBLE */}
                        {isHostBool && !isKeyboardVisible && (
                            <View style={styles.tabContainer}>
                                <TouchableOpacity
                                    style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]}
                                    onPress={() => setActiveTab('search')}
                                >
                                    <Ionicons name="search" size={18} color={activeTab === 'search' ? '#FFF' : '#8F98A0'} />
                                    <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>Search</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.tabBtn, activeTab === 'chat' && styles.tabBtnActive]}
                                    onPress={() => setActiveTab('chat')}
                                >
                                    <Ionicons name="chatbubbles" size={18} color={activeTab === 'chat' ? '#FFF' : '#8F98A0'} />
                                    <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Chat</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {isHostBool && activeTab === 'search' ? (
                            <View style={styles.hostPanel}>
                                <View style={styles.searchRow}>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="Search YouTube..."
                                        placeholderTextColor="#8F98A0"
                                        value={searchInput}
                                        onChangeText={setSearchInput}
                                        onSubmitEditing={handleSearch}
                                        returnKeyType="search"
                                        selectionColor="#9B51E0"
                                    />
                                    {/* Updated Push/Search Button with Gradient */}
                                    <TouchableOpacity style={styles.pushBtnContainer} onPress={handleSearch}>
                                        <LinearGradient
                                            colors={['#00E5FF', '#9B51E0', '#FF007A']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.pushBtnGradient}
                                        >
                                            {isSearching ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="search" size={24} color="#FFF" />}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>

                                {searchResults.length > 0 ? (
                                    <View style={styles.resultsContainer}>
                                        <Text style={styles.resultsHeader}>Select a video to play:</Text>
                                        <FlatList
                                            data={searchResults}
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            keyExtractor={(item) => item.id.videoId}
                                            renderItem={renderSearchResult}
                                            contentContainerStyle={{ gap: 12, paddingVertical: 10 }}
                                            keyboardShouldPersistTaps="handled"
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="search" size={40} color="#2A2A30" />
                                        <Text style={styles.emptyStateText}>Search for a video to sync with the room.</Text>
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View style={styles.chatPanel}>
                                {/* HIDE VIEWER HEADER WHEN KEYBOARD IS VISIBLE */}
                                {!isHostBool && !isKeyboardVisible && (
                                    // Using Theme Pink
                                    <View style={styles.viewerHeader}>
                                        <Ionicons name="lock-closed" size={16} color="#FF007A" />
                                        <Text style={styles.viewerHeaderText}>Viewer Mode: Sit back & enjoy</Text>
                                    </View>
                                )}

                                <FlatList
                                    ref={chatListRef}
                                    data={messages}
                                    keyExtractor={(item) => item.id}
                                    renderItem={renderChatMessage}
                                    contentContainerStyle={styles.chatListContent}
                                    showsVerticalScrollIndicator={false}
                                    onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
                                    onLayout={() => chatListRef.current?.scrollToEnd({ animated: true })}
                                    ListEmptyComponent={<Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>}
                                />

                                <View style={styles.chatInputRow}>
                                    <TextInput
                                        style={styles.chatInput}
                                        placeholder="Type a message..."
                                        placeholderTextColor="#8F98A0"
                                        value={chatInput}
                                        onChangeText={setChatInput}
                                        onSubmitEditing={handleSendMessage}
                                        returnKeyType="send"
                                        selectionColor="#9B51E0"
                                    />
                                    {/* Updated Send Button with Gradient */}
                                    <TouchableOpacity
                                        style={[styles.sendBtnContainer, !chatInput.trim() && { opacity: 0.5 }]}
                                        onPress={handleSendMessage}
                                        disabled={!chatInput.trim()}
                                    >
                                        <LinearGradient
                                            colors={['#00E5FF', '#9B51E0', '#FF007A']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={styles.sendBtnGradient}
                                        >
                                            <Ionicons name="send" size={20} color="#FFF" style={{ marginLeft: 2 }} />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>
            {/* INSTAGRAM-STYLE SHARE BOTTOM SHEET */}
            <Modal visible={isShareModalVisible} transparent={true} animationType="slide" onRequestClose={() => setIsShareModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Invite CineBuddies</Text>
                            <TouchableOpacity onPress={() => setIsShareModalVisible(false)}>
                                <Ionicons name="close-circle" size={28} color="#8F98A0" />
                            </TouchableOpacity>
                        </View>

                        {isFetchingFriends ? (
                            <ActivityIndicator size="large" color="#00E5FF" style={{ marginVertical: 40 }} />
                        ) : (
                            <FlatList
                                data={friendsList}
                                keyExtractor={item => item._id}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                ListEmptyComponent={<Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 20 }}>No CineBuddies found.</Text>}
                                renderItem={({ item }) => (
                                    <View style={styles.friendRow}>
                                        <View style={styles.friendAvatar}>
                                            <Text style={styles.friendAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                                        </View>
                                        <Text style={styles.friendName}>{item.name}</Text>
                                        <TouchableOpacity style={styles.sendInviteBtn} onPress={() => sendTheatreInvite(item._id)}>
                                            <Text style={styles.sendInviteText}>Send</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* HOST GATEKEEPER MODAL */}
            <Modal visible={!!pendingJoinRequest} transparent={true} animationType="fade">
                <View style={styles.modalOverlayCenter}>
                    <View style={styles.permissionModal}>
                        <Ionicons name="shield-checkmark" size={40} color="#00E5FF" style={{ alignSelf: 'center', marginBottom: 12 }} />
                        <Text style={styles.permissionTitle}>Someone wants to join</Text>
                        <Text style={styles.permissionDesc}>
                            <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{pendingJoinRequest?.joinerName}</Text> is asking to enter your room.
                        </Text>

                        <View style={styles.permissionActions}>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: '#00E5FF' }]} onPress={() => handleHostDecision('ALLOW')}>
                                <Text style={[styles.permBtnText, { color: '#000' }]}>Allow</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => handleHostDecision('REJECT')}>
                                <Text style={styles.permBtnText}>Decline</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(229, 57, 53, 0.15)' }]} onPress={() => handleHostDecision('BLOCK')}>
                                <Text style={[styles.permBtnText, { color: '#E53935' }]}>Block</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* HOST MODERATION MODAL */}
            <Modal visible={!!selectedUserToMod} transparent={true} animationType="fade" onRequestClose={() => setSelectedUserToMod(null)}>
                <View style={styles.modalOverlayCenter}>
                    <View style={styles.permissionModal}>
                        <Ionicons name="warning" size={40} color="#E53935" style={{ alignSelf: 'center', marginBottom: 12 }} />
                        <Text style={styles.permissionTitle}>Manage User</Text>
                        <Text style={styles.permissionDesc}>
                            What would you like to do with <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{selectedUserToMod}</Text>?
                        </Text>

                        <View style={styles.permissionActions}>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => setSelectedUserToMod(null)}>
                                <Text style={styles.permBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(229, 57, 53, 0.15)' }]} onPress={handleKick}>
                                <Text style={[styles.permBtnText, { color: '#E53935' }]}>Kick from Room</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: '#E53935' }]} onPress={handleKickAndBlock}>
                                <Text style={[styles.permBtnText, { color: '#FFF' }]}>Kick & Block Permanently</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#000' },
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    playerContainer: { position: 'relative', backgroundColor: '#000' },
    fullscreenExitBtn: { position: 'absolute', top: 15, left: 20, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 20 },

    nowPlayingBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#17171C', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 8 },
    nowPlayingText: { color: '#FFF', fontSize: 13, flex: 1 },

    externalControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#14141A', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    externalLeftControls: { flexDirection: 'row', gap: 12 },
    externalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    externalRightControls: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    externalBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

    roomUsersContainer: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    roomUsersScroll: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
    userChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E24', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, gap: 6 },
    userChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
    userChipText: { color: '#D0D0D5', fontSize: 12, fontWeight: '500' },

    controlsContainer: { flex: 1, padding: 16 },

    tabContainer: { flexDirection: 'row', backgroundColor: '#17171C', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
    tabBtnActive: { backgroundColor: '#2A2A30' },
    tabText: { color: '#8F98A0', fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: '#FFF' },

    hostPanel: { flex: 1 },
    searchRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
    searchInput: { flex: 1, backgroundColor: '#17171C', color: '#FFF', borderRadius: 10, paddingHorizontal: 16, height: 56, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },

    // Updated Button Styles
    pushBtnContainer: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden' },
    pushBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    resultsContainer: { flex: 1, marginTop: 6 },
    resultsHeader: { color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 8 },
    resultCard: { width: 160 },
    resultImage: { width: '100%', height: 90, borderRadius: 8, backgroundColor: '#25252A' },
    resultPlayIcon: { position: 'absolute', top: 29, left: 64, zIndex: 2 },
    resultTitle: { color: '#D0D0D5', fontSize: 13, marginTop: 8, fontWeight: '500' },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 40 },
    emptyStateText: { color: '#8F98A0', marginTop: 12, fontSize: 14 },

    chatPanel: { flex: 1, backgroundColor: '#14141A', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
    viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 0, 122, 0.1)', paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    viewerHeaderText: { color: '#FF007A', fontSize: 13, fontWeight: 'bold' },
    chatListContent: { padding: 16, paddingBottom: 10 },
    emptyChatText: { color: '#8F98A0', textAlign: 'center', marginTop: 20, fontSize: 13 },
    chatMsgWrapper: { marginBottom: 12, maxWidth: '80%' },
    chatMsgLeft: { alignSelf: 'flex-start' },
    chatMsgRight: { alignSelf: 'flex-end' },
    chatSenderName: { color: '#8F98A0', fontSize: 11, marginBottom: 4, marginLeft: 4 },
    chatBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
    chatBubbleThem: { backgroundColor: '#2A2A30', borderBottomLeftRadius: 4 },
    chatBubbleMe: { borderBottomRightRadius: 4 }, // Background handled by LinearGradient now
    chatText: { color: '#FFF', fontSize: 14, lineHeight: 20 },
    chatInputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#17171C', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', gap: 10 },
    chatInput: { flex: 1, backgroundColor: '#0A0A0C', color: '#FFF', borderRadius: 20, paddingHorizontal: 16, height: 44, fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

    // Updated Button Styles
    sendBtnContainer: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
    sendBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    bottomSheet: { backgroundColor: '#17171C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '60%' },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sheetTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    friendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    friendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#9B51E0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    friendAvatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },
    friendName: { flex: 1, color: '#FFF', fontSize: 16, fontWeight: '500' },
    sendInviteBtn: { backgroundColor: '#00E5FF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    sendInviteText: { color: '#000', fontWeight: 'bold', fontSize: 13 },
    modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    permissionModal: { backgroundColor: '#1E1E24', borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
    permissionTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    permissionDesc: { color: '#8F98A0', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    permissionActions: { gap: 12 },
    permBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    permBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
});