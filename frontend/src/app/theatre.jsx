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
    BackHandler,
    Animated,
    Pressable,
    PanResponder
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import * as ScreenOrientation from 'expo-screen-orientation';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

import TheatrePlayer from '../screens/TheatrePlayer';
import { useAuthStore } from '../store/useAuthStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;
const SOCKET_URL = BACKEND_URL;

const RAW_KEYS = process.env.EXPO_PUBLIC_YOUTUBE_API_KEYS || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '';
let ACTIVE_YT_KEYS = RAW_KEYS.split(',').map(k => k.trim()).filter(Boolean);

const fetchYouTubeWithRetry = async (urlTemplate) => {
    while (ACTIVE_YT_KEYS.length > 0) {
        const currentKey = ACTIVE_YT_KEYS[0];
        const url = urlTemplate.replace('__API_KEY__', currentKey);
        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.error && (data.error.code === 403 || data.error.code === 429)) {
                ACTIVE_YT_KEYS.shift();
                continue;
            }
            return data;
        } catch (err) {
            return { error: { code: 500, message: "Network error occurred." } };
        }
    }
    return { error: { code: 429, message: 'All YouTube API keys have exhausted their daily quota.' } };
};

const FloatingEmoji = ({ emoji, sender, onComplete }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;
    const translateX = useRef(new Animated.Value(Math.random() * 40 - 20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(translateY, { toValue: -150, duration: 2000, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ]).start(() => onComplete());
    }, []);

    return (
        <Animated.View style={[styles.floatingEmojiContainer, { transform: [{ translateY }, { translateX }], opacity }]}>
            <Text style={styles.floatingEmojiSender} numberOfLines={1}>{sender}</Text>
            <Text style={styles.floatingEmoji}>{emoji}</Text>
        </Animated.View>
    );
};

const FloatingMessage = ({ msg, onComplete }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(translateY, { toValue: -150, duration: 4000, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 4000, useNativeDriver: true }),
        ]).start(() => onComplete());
    }, []);

    return (
        <Animated.View style={[styles.floatingMessageContainer, { transform: [{ translateY }], opacity }]}>
            <Text style={styles.floatingMessageSender}>{msg.sender}:</Text>
            <Text style={styles.floatingMessageText}>{msg.text}</Text>
        </Animated.View>
    );
};

const EMOJIS = ['😂', '🔥', '😱', '😍', '👏', '😢'];

const ReactionButtonUI = ({ isFullScreen, showFloatingEmojis, toggleDistractionFree, sendReaction, extendOverlayTimer }) => {
    const [pickerVisible, setPickerVisible] = useState(false);
    const [uiHoveredIndex, setUIHoveredIndex] = useState(-1);

    const timerRef = useRef(null);
    const isDraggingRef = useRef(false);
    const hoveredIndexRef = useRef(-1);

    const setHover = (idx) => {
        if (hoveredIndexRef.current !== idx) {
            hoveredIndexRef.current = idx;
            setUIHoveredIndex(idx);
        }
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                isDraggingRef.current = false;
                setHover(-1);
                timerRef.current = setTimeout(() => {
                    if (showFloatingEmojis) {
                        isDraggingRef.current = true;
                        setPickerVisible(true);
                        if (extendOverlayTimer) extendOverlayTimer();
                    }
                }, 250);
            },
            onPanResponderMove: (evt, gestureState) => {
                if (!isDraggingRef.current) {
                    if (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10) {
                        clearTimeout(timerRef.current);
                    }
                    return;
                }

                const { dx, dy } = gestureState;
                let index = -1;
                const EMOJI_SIZE = 44;

                if (isFullScreen) {
                    if (Math.abs(dx) > 80) { setHover(-1); return; }
                    let absDy = Math.abs(dy);
                    if (dy < 0 && absDy > 45 && absDy < 45 + EMOJIS.length * EMOJI_SIZE) {
                        index = Math.floor((absDy - 45) / EMOJI_SIZE);
                    }
                } else {
                    if (Math.abs(dy) > 80) { setHover(-1); return; }
                    let absDx = Math.abs(dx);
                    if (dx < 0 && absDx > 45 && absDx < 45 + EMOJIS.length * EMOJI_SIZE) {
                        let rawIndex = Math.floor((absDx - 45) / EMOJI_SIZE);
                        index = (EMOJIS.length - 1) - rawIndex;
                    }
                }
                setHover(index);
            },
            onPanResponderRelease: () => {
                clearTimeout(timerRef.current);
                if (!isDraggingRef.current) {
                    toggleDistractionFree();
                } else {
                    if (hoveredIndexRef.current !== -1) {
                        sendReaction(EMOJIS[hoveredIndexRef.current]);
                    }
                    setPickerVisible(false);
                    setHover(-1);
                    isDraggingRef.current = false;
                }

                if (extendOverlayTimer) extendOverlayTimer();
            },
            onPanResponderTerminate: () => {
                clearTimeout(timerRef.current);
                setPickerVisible(false);
                setHover(-1);
                isDraggingRef.current = false;
            }
        })
    ).current;

    const MainBtn = (
        <View {...panResponder.panHandlers} style={styles.reactionMainBtn}>
            <Ionicons
                name={showFloatingEmojis ? "happy-outline" : "eye-off-outline"}
                size={24}
                color={showFloatingEmojis ? "#FFFFFF" : "#E53935"}
            />
        </View>
    );

    const PickerMenu = (
        <View style={[
            isFullScreen ? styles.emojiPickerMenuVertical : styles.emojiPickerMenuHorizontal,
            isFullScreen ? { marginBottom: 10 } : { marginRight: 10 }
        ]}>
            {EMOJIS.map((emoji, idx) => {
                const isHovered = uiHoveredIndex === idx;
                return (
                    <View key={emoji} style={[styles.emojiOption, isHovered && styles.emojiOptionHovered]}>
                        <Text style={styles.emojiOptionText}>{emoji}</Text>
                    </View>
                );
            })}
        </View>
    );

    return (
        <View style={[{ pointerEvents: 'box-none', flexDirection: isFullScreen ? 'column-reverse' : 'row-reverse', alignItems: 'flex-end' }]}>
            {MainBtn}
            {pickerVisible && PickerMenu}
        </View>
    );
};

export default function TheatreScreen() {
    const router = useRouter();
    const { width, height } = useWindowDimensions();

    const { roomId, isHost, initialYtId, initialTitle } = useLocalSearchParams();
    const isHostBool = isHost === 'true';

    const [isJoining, setIsJoining] = useState(!isHostBool);
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

    const [searchInput, setSearchInput] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState('search');
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const chatListRef = useRef(null);
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

    const [isShareModalVisible, setIsShareModalVisible] = useState(false);
    const [friendsList, setFriendsList] = useState([]);
    const [isFetchingFriends, setIsFetchingFriends] = useState(false);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [isWaitingForHost, setIsWaitingForHost] = useState(false);
    const [pendingJoinRequest, setPendingJoinRequest] = useState(null);

    const [showFloatingEmojis, setShowFloatingEmojis] = useState(true);
    const [activeReactions, setActiveReactions] = useState([]);

    const [showFloatingMessages, setShowFloatingMessages] = useState(true);
    const [activeFloatingMessages, setActiveFloatingMessages] = useState([]);

    const [overlayVisible, setOverlayVisible] = useState(true);
    const overlayTimer = useRef(null);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
        return () => {
            keyboardDidHideListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    useEffect(() => {
        const onHardwareBackPress = () => {
            handleBackPress();
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
        return () => backHandler.remove();
    }, [isFullScreen, isHostBool, socket, roomId]);

    useEffect(() => {
        if (ytId) {
            setOverlayVisible(true);
            extendOverlayTimer();
        }
    }, [ytId]);

    // --- SOCKET SETUP ---
    useEffect(() => {
        const assignedUsername = user?.name ? user.name : `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
        setUsername(assignedUsername);

        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            newSocket.emit('join_room', { roomId, username: assignedUsername, isHost: isHostBool, userId: user?._id });

            if (isHostBool && initialYtId && initialTitle) {
                setYtId(initialYtId);
                setVideoTitle(initialTitle);
                newSocket.emit('change_video', { roomId, ytId: initialYtId, title: initialTitle });
            }
        });

        newSocket.on('room_users', (userList) => {
            setIsJoining(false);
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
            Toast.show({ type: 'hotstarError', text1: 'Room Not Found', text2: 'This room does not exist or has been closed.', position: 'top' });
            if (router.canGoBack()) router.back();
            else router.replace('/');
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
            if (isHostBool) setPendingJoinRequest(data);
        });

        newSocket.on('remote_sync', (data) => {
            if (isHostBool) return;
            playerRef.current?.getCurrentTime().then(viewerTime => {
                const timeDiff = Math.abs(viewerTime - data.timestamp);

                // --- FIXED: Joinee plays but is instantly muted to maintain sync ---
                if (data.action === 'pause') {
                    setIsMuted(true);
                    setIsPlaying(true);
                    if (timeDiff > 0.001) playerRef.current?.seekTo(data.timestamp, true);
                } else {
                    setIsMuted(false);
                    setIsPlaying(true);
                    if (timeDiff > 2) playerRef.current?.seekTo(data.timestamp + 0.5, true);
                }
            }).catch(() => { });
        });

        newSocket.on('receive_chat', (data) => {
            if (data.isReaction) {
                const newReaction = { id: Date.now().toString() + Math.random(), emoji: data.text, sender: data.sender };
                setActiveReactions(prev => [...prev, newReaction]);
            } else {
                const newFloatMsg = { id: data.id, sender: data.sender, text: data.text };
                setActiveFloatingMessages(prev => [...prev, newFloatMsg]);
            }

            setMessages(prev => [...prev, data]);
            setTimeout(() => { chatListRef.current?.scrollToEnd({ animated: true }); }, 100);
        });

        newSocket.on('room_closed', () => {
            if (!isHostBool) {
                Toast.show({ type: 'hotstarError', text1: 'Room Closed', text2: 'The host has ended the watch party.', position: 'top' });
                if (router.canGoBack()) router.back();
                else router.replace('/');
            }
        });

        return () => {
            newSocket.disconnect();
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        };
    }, [roomId, isHostBool, user, initialYtId, initialTitle]);

    // --- HOST SYNC ENGINE ---
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
                socket.emit('sync_action', { roomId, action: currentIsPlaying ? 'play' : 'pause', timestamp: currentTime });
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

    // --- REACTION LOGIC ---
    const sendReaction = (emoji) => {
        const msgData = {
            id: Date.now().toString(),
            roomId,
            sender: username,
            text: emoji,
            isReaction: true,
        };
        setActiveReactions(prev => [...prev, { id: msgData.id, emoji, sender: username }]);
        setMessages(prev => [...prev, msgData]);
        socket.emit('send_chat', msgData);
    };

    const removeReaction = (id) => {
        setActiveReactions(prev => prev.filter(r => r.id !== id));
    };

    const removeFloatingMessage = (id) => {
        setActiveFloatingMessages(prev => prev.filter(m => m.id !== id));
    };

    const toggleDistractionFree = () => {
        setShowFloatingEmojis(prev => !prev);
    };

    // --- UI TOGGLE SYNC LOGIC ---
    const extendOverlayTimer = () => {
        playerRef.current?.extendControls?.();
        if (overlayTimer.current) clearTimeout(overlayTimer.current);
        overlayTimer.current = setTimeout(() => setOverlayVisible(false), 6000); // --- FIXED: Increased timeout to 6 seconds ---
    };

    const handleVideoTap = () => {
        setOverlayVisible(true);
        extendOverlayTimer();
    };

    // --- NORMAL CHAT LOGIC ---
    const handleSendMessage = () => {
        if (!chatInput.trim()) return;
        const msgData = { id: Date.now().toString(), roomId, sender: username, text: chatInput.trim(), isReaction: false };
        setMessages(prev => [...prev, msgData]);

        setActiveFloatingMessages(prev => [...prev, { id: msgData.id, sender: username, text: msgData.text }]);

        socket.emit('send_chat', msgData);
        setChatInput('');
    };

    // --- YT SEARCH & ROOM CONTROLS ---
    const handleSearch = async () => {
        if (!searchInput.trim()) return;
        Keyboard.dismiss();
        setIsSearching(true);
        try {
            const searchUrlTemplate = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchInput)}&type=video&maxResults=10&key=__API_KEY__`;
            const data = await fetchYouTubeWithRetry(searchUrlTemplate);
            if (data.error) Toast.show({ type: 'hotstarError', text1: data.error.message });
            else if (data.items) setSearchResults(data.items);
        } catch (error) { } finally { setIsSearching(false); }
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
        if (isFullScreen) await toggleFullScreen();
        else {
            if (isHostBool && socket) socket.emit('close_room', roomId);
            router.back();
        }
    };

    const handleHostDecision = (decision) => {
        if (!pendingJoinRequest) return;
        socket.emit('host_decision', { ...pendingJoinRequest, decision, roomId, hostUserId: user._id });
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

    // --- INVITES ---
    const openShareModal = async () => {
        if (!user) { Toast.show({ type: 'hotstarInfo', text1: 'Log in to invite friends!' }); return; }
        setIsShareModalVisible(true);
        setSelectedFriends([]);
        setIsFetchingFriends(true);
        try {
            const res = await axios.get(`${BACKEND_URL}/buddies/list`, { headers: { Authorization: `Bearer ${token}` } });
            setFriendsList(res.data);
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Failed to load friends.' });
        } finally { setIsFetchingFriends(false); }
    };

    const toggleFriendSelection = (id) => setSelectedFriends(prev => prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]);

    const sendBulkTheatreInvites = async () => {
        if (selectedFriends.length === 0) return;
        try {
            await Promise.all(selectedFriends.map(receiverId =>
                axios.post(`${BACKEND_URL}/buddies/invite`, { receiverId, roomId, videoTitle }, { headers: { Authorization: `Bearer ${token}` } })
            ));
            Toast.show({ type: 'hotstarSuccess', text1: 'Invites Sent!' });
            setIsShareModalVisible(false);
            setSelectedFriends([]);
        } catch (error) {
            const msg = error.response?.data?.message || 'Failed to send some invites.';
            Toast.show({ type: 'hotstarError', text1: msg });
        }
    };

    // --- RENDERERS ---
    const renderSearchResult = ({ item }) => (
        <TouchableOpacity style={styles.resultCard} activeOpacity={0.8} onPress={() => handleSelectVideo(item.id.videoId, item.snippet?.title)}>
            <Image source={{ uri: item.snippet?.thumbnails?.medium?.url }} style={styles.resultImage} />
            <View style={styles.resultPlayIcon}><Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.8)" /></View>
            <Text style={styles.resultTitle} numberOfLines={2}>{item.snippet?.title}</Text>
        </TouchableOpacity>
    );

    const renderChatMessage = ({ item }) => {
        if (item.isReaction) {
            return (
                <View style={styles.reactionMessageWrapper}>
                    <Text style={styles.reactionMessageText}>
                        {item.sender === username ? 'You' : item.sender} reacted with <Text style={{ fontSize: 16 }}>{item.text}</Text>
                    </Text>
                </View>
            );
        }

        const isMe = item.sender === username;
        return (
            <View style={[styles.chatMsgWrapper, isMe ? styles.chatMsgRight : styles.chatMsgLeft]}>
                {!isMe && <Text style={styles.chatSenderName}>{item.sender}</Text>}
                {isMe ? (
                    <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.chatBubble, styles.chatBubbleMe]}>
                        <Text style={styles.chatText}>{item.text}</Text>
                    </LinearGradient>
                ) : (
                    <View style={[styles.chatBubble, styles.chatBubbleThem]}><Text style={styles.chatText}>{item.text}</Text></View>
                )}
            </View>
        );
    };

    const actualWidth = Math.max(width, height);
    const actualHeight = Math.min(width, height);
    const containerWidth = isFullScreen ? actualWidth : width;
    const containerHeight = isFullScreen ? actualHeight : width * (9 / 16);
    const innerVideoWidth = isFullScreen ? actualHeight * (16 / 9) : width;
    const innerVideoHeight = isFullScreen ? actualHeight : width * (9 / 16);

    if (isJoining) {
        return (
            <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar hidden={false} barStyle="light-content" backgroundColor="#000" />
                <ActivityIndicator size="large" color="#00E5FF" />
                <Text style={{ color: '#8F98A0', marginTop: 16, fontSize: 16, fontWeight: '500' }}>Connecting to Room...</Text>
            </SafeAreaView>
        );
    }

    if (isWaitingForHost) {
        return (
            <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar hidden={false} barStyle="light-content" backgroundColor="#000" />
                <ActivityIndicator size="large" color="#FF007A" />
                <Text style={{ color: '#FFF', marginTop: 16, fontSize: 18, fontWeight: 'bold' }}>Asking to enter...</Text>
                <Text style={{ color: '#8F98A0', marginTop: 8, fontSize: 14 }}>Waiting for the Host to let you in.</Text>
                <TouchableOpacity onPress={handleBackPress} style={{ marginTop: 24, padding: 12 }}>
                    <Text style={{ color: '#00E5FF', fontWeight: 'bold' }}>Cancel</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const showOverlayUI = ytId && overlayVisible;

    return (
        <SafeAreaView style={styles.safeArea} edges={isFullScreen ? [] : ['top', 'left', 'right']}>
            <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
                <StatusBar hidden={isFullScreen} showHideTransition="slide" barStyle="light-content" backgroundColor="#000" translucent={false} />

                {/* --- VIDEO CONTAINER (With synced tap listener) --- */}
                <View
                    style={[
                        styles.playerContainer,
                        { width: containerWidth, height: containerHeight },
                        isFullScreen && { position: 'absolute', top: 0, left: 0, zIndex: 9999, elevation: 9999, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }
                    ]}
                    onStartShouldSetResponderCapture={() => {
                        if (ytId) {
                            handleVideoTap();
                        }
                        return false;
                    }}
                >
                    <TheatrePlayer
                        ref={playerRef}
                        ytId={ytId}
                        isPlaying={isPlaying}
                        isMuted={isMuted}
                        isHostBool={isHostBool}
                        onPlayerStateChange={onPlayerStateChange}
                        width={innerVideoWidth}
                        height={innerVideoHeight}
                        isFullScreen={isFullScreen}
                        onExit={handleBackPress}
                        onToggleOrientation={async () => {
                            const current = await ScreenOrientation.getOrientationAsync();
                            if (current === ScreenOrientation.Orientation.PORTRAIT_UP) {
                                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
                            } else {
                                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                            }
                        }}
                        onControlsToggle={(visible) => {
                            setOverlayVisible(visible);
                        }}
                    />

                    {/* --- FIXED: Removed orientation button from overlay --- */}
                    {isFullScreen && showOverlayUI && (
                        <TouchableOpacity style={[styles.fullscreenExitBtn, { zIndex: 100000, elevation: 10 }]} onPress={toggleFullScreen} activeOpacity={0.7}>
                            <Ionicons name="close" size={26} color="#FFFFFF" />
                        </TouchableOpacity>
                    )}

                    {ytId && roomUsers.length > 0 && showOverlayUI && (
                        <View style={styles.liveViewerBadge} pointerEvents="none">
                            <Ionicons name="eye" size={14} color="#FFF" />
                            <Text style={styles.liveViewerText}>{roomUsers.length}</Text>
                        </View>
                    )}

                    {showOverlayUI && (
                        <View style={styles.rightOverlayWrapper} pointerEvents="box-none">
                            <View style={styles.rightActionButtons} pointerEvents="box-none">
                                <TouchableOpacity
                                    style={[styles.reactionMainBtn, { marginBottom: 12 }]}
                                    activeOpacity={0.7}
                                    onPress={() => {
                                        setShowFloatingMessages(prev => !prev);
                                        extendOverlayTimer();
                                    }}
                                >
                                    <Ionicons
                                        name={showFloatingMessages ? "chatbubble" : "chatbubble-outline"}
                                        size={22}
                                        color={showFloatingMessages ? "#FFFFFF" : "#E53935"}
                                    />
                                </TouchableOpacity>

                                <ReactionButtonUI
                                    isFullScreen={isFullScreen}
                                    showFloatingEmojis={showFloatingEmojis}
                                    toggleDistractionFree={toggleDistractionFree}
                                    sendReaction={sendReaction}
                                    extendOverlayTimer={extendOverlayTimer}
                                />
                            </View>
                        </View>
                    )}

                    <View style={styles.floatingMessagesZone} pointerEvents="none">
                        {showFloatingMessages && activeFloatingMessages.map(msg => (
                            <FloatingMessage key={msg.id} msg={msg} onComplete={() => removeFloatingMessage(msg.id)} />
                        ))}
                    </View>

                    {showFloatingEmojis && (
                        <View style={styles.floatingAnimationZone} pointerEvents="none">
                            {activeReactions.map((reaction) => (
                                <FloatingEmoji key={reaction.id} emoji={reaction.emoji} sender={reaction.sender} onComplete={() => removeReaction(reaction.id)} />
                            ))}
                        </View>
                    )}
                </View>

                {/* --- LOWER HALF UI --- */}
                <View style={{ display: isFullScreen ? 'none' : 'flex', flex: 1 }}>
                    <>
                        {videoTitle !== '' && (
                            <View style={styles.nowPlayingBar}>
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

                            <View style={{ flex: 1, minWidth: 16 }} />

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.externalRightControls} bounces={false}>
                                <TouchableOpacity onPress={openShareModal} style={[styles.externalBtn, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
                                    <Ionicons name="paper-plane" size={16} color="#00E5FF" />
                                    <Text style={[styles.externalBtnText, { color: '#00E5FF' }]}>Share</Text>
                                </TouchableOpacity>
                                <View style={[styles.externalBtn, { backgroundColor: 'rgba(155, 81, 224, 0.15)' }]}>
                                    <Ionicons name="key" size={16} color="#9B51E0" />
                                    <Text style={[styles.externalBtnText, { color: '#9B51E0', letterSpacing: 1 }]}>{roomId}</Text>
                                </View>
                            </ScrollView>
                        </View>

                        {isHostBool && roomUsers.filter(u => u !== username).length > 0 && (
                            <View style={styles.viewersBar}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.viewersScroll}
                                    bounces={true}
                                >
                                    {roomUsers.map((uname, idx) => {
                                        if (uname === username) return null;
                                        return (
                                            <TouchableOpacity
                                                key={idx}
                                                style={styles.viewerChip}
                                                activeOpacity={0.7}
                                                onPress={() => setSelectedUserToMod(uname)}
                                            >
                                                <Ionicons name="person" size={12} color="#00E5FF" />
                                                <Text style={styles.viewerChipText}>{uname}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}
                    </>

                    <View style={styles.controlsContainer}>
                        {isHostBool && !isKeyboardVisible && (
                            <View style={styles.tabContainer}>
                                <TouchableOpacity style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]} onPress={() => setActiveTab('search')}>
                                    <Ionicons name="search" size={18} color={activeTab === 'search' ? '#FFF' : '#8F98A0'} />
                                    <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>Search</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.tabBtn, activeTab === 'chat' && styles.tabBtnActive]} onPress={() => setActiveTab('chat')}>
                                    <Ionicons name="chatbubbles" size={18} color={activeTab === 'chat' ? '#FFF' : '#8F98A0'} />
                                    <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Chat</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {isHostBool && activeTab === 'search' ? (
                            <View style={styles.hostPanel}>
                                <View style={styles.searchRow}>
                                    <TextInput style={styles.searchInput} placeholder="Search YouTube..." placeholderTextColor="#8F98A0" value={searchInput} onChangeText={setSearchInput} onSubmitEditing={handleSearch} returnKeyType="search" selectionColor="#9B51E0" />
                                    <TouchableOpacity style={styles.pushBtnContainer} onPress={handleSearch}>
                                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pushBtnGradient}>
                                            {isSearching ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="search" size={24} color="#FFF" />}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                                {searchResults.length > 0 ? (
                                    <View style={styles.resultsContainer}>
                                        <Text style={styles.resultsHeader}>Select a video to play:</Text>
                                        <FlatList data={searchResults} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(item) => item.id.videoId} renderItem={renderSearchResult} contentContainerStyle={{ gap: 12, paddingVertical: 10 }} keyboardShouldPersistTaps="handled" />
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
                                {!isHostBool && !isKeyboardVisible && (
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
                                    <TextInput style={styles.chatInput} placeholder="Type a message..." placeholderTextColor="#8F98A0" value={chatInput} onChangeText={setChatInput} onSubmitEditing={handleSendMessage} returnKeyType="send" selectionColor="#9B51E0" />
                                    <TouchableOpacity style={[styles.sendBtnContainer, !chatInput.trim() && { opacity: 0.5 }]} onPress={handleSendMessage} disabled={!chatInput.trim()}>
                                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sendBtnGradient}>
                                            <Ionicons name="send" size={20} color="#FFF" style={{ marginLeft: 2 }} />
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* --- SHARE MODAL --- */}
            <Modal visible={isShareModalVisible} transparent={true} animationType="slide" onRequestClose={() => setIsShareModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Invite CineBuddies</Text>
                            <TouchableOpacity onPress={() => setIsShareModalVisible(false)}><Ionicons name="close-circle" size={28} color="#8F98A0" /></TouchableOpacity>
                        </View>
                        {isFetchingFriends ? (
                            <ActivityIndicator size="large" color="#00E5FF" style={{ marginVertical: 40 }} />
                        ) : (
                            <View style={{ flex: 1 }}>
                                <FlatList
                                    data={friendsList}
                                    keyExtractor={item => item._id}
                                    numColumns={4}
                                    columnWrapperStyle={{ justifyContent: 'flex-start', marginBottom: 20 }}
                                    contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
                                    ListEmptyComponent={<Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 20 }}>No CineBuddies found.</Text>}
                                    renderItem={({ item }) => {
                                        const isSelected = selectedFriends.includes(item._id);
                                        return (
                                            <TouchableOpacity style={styles.gridFriendItem} onPress={() => toggleFriendSelection(item._id)} activeOpacity={0.8}>
                                                <View style={[styles.gridFriendAvatar, isSelected && styles.gridFriendAvatarSelected]}>
                                                    <Text style={styles.gridFriendAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                                                    {isSelected && <View style={styles.checkBadge}><Ionicons name="checkmark-circle" size={24} color="#00E5FF" /></View>}
                                                </View>
                                                <Text style={styles.gridFriendName} numberOfLines={1}>{item.name.split(' ')[0]}</Text>
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                                <TouchableOpacity style={[styles.bulkSendBtn, selectedFriends.length === 0 && styles.bulkSendBtnDisabled]} disabled={selectedFriends.length === 0} onPress={sendBulkTheatreInvites}>
                                    <Text style={[styles.bulkSendBtnText, selectedFriends.length === 0 && { color: '#8F98A0' }]}>Send {selectedFriends.length > 0 ? `(${selectedFriends.length})` : ''}</Text>
                                </TouchableOpacity>
                            </View>
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
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: '#00E5FF' }]} onPress={() => handleHostDecision('ALLOW')}><Text style={[styles.permBtnText, { color: '#000' }]}>Allow</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => handleHostDecision('REJECT')}><Text style={styles.permBtnText}>Decline</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(229, 57, 53, 0.15)' }]} onPress={() => handleHostDecision('BLOCK')}><Text style={[styles.permBtnText, { color: '#E53935' }]}>Block</Text></TouchableOpacity>
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
                        <Text style={styles.permissionDesc}>What would you like to do with <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{selectedUserToMod}</Text>?</Text>
                        <View style={styles.permissionActions}>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => setSelectedUserToMod(null)}><Text style={styles.permBtnText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(229, 57, 53, 0.15)' }]} onPress={handleKick}><Text style={[styles.permBtnText, { color: '#E53935' }]}>Kick from Room</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: '#E53935' }]} onPress={handleKickAndBlock}><Text style={[styles.permBtnText, { color: '#FFF' }]}>Kick & Block Permanently</Text></TouchableOpacity>
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
    fullscreenExitBtn: { position: 'absolute', top: 15, left: 20, backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 20 },

    rightOverlayWrapper: { position: 'absolute', bottom: 15, right: 15, zIndex: 99999, pointerEvents: 'box-none' },
    rightActionButtons: { flexDirection: 'column', alignItems: 'flex-end', pointerEvents: 'box-none' },
    reactionMainBtn: { backgroundColor: 'rgba(0,0,0,0.7)', padding: 8, borderRadius: 20, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

    emojiPickerMenuHorizontal: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 24, paddingHorizontal: 8, paddingVertical: 8, alignItems: 'center' },
    emojiPickerMenuVertical: { flexDirection: 'column-reverse', backgroundColor: 'rgba(0,0,0,0.85)', borderRadius: 24, paddingHorizontal: 8, paddingVertical: 8, alignItems: 'center' },

    emojiOption: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    emojiOptionHovered: { transform: [{ scale: 1.4 }] },
    emojiOptionText: { fontSize: 26 },

    floatingAnimationZone: { position: 'absolute', right: 15, bottom: 60, width: 80, height: 200, zIndex: 99998, justifyContent: 'flex-end', alignItems: 'center' },

    floatingEmojiContainer: { position: 'absolute', bottom: 0, alignItems: 'center' },
    floatingEmojiSender: { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontWeight: 'bold', marginBottom: 2, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
    floatingEmoji: { fontSize: 36 },

    floatingMessagesZone: { position: 'absolute', bottom: 130, left: 15, width: 280, height: 250, pointerEvents: 'none', justifyContent: 'flex-end', zIndex: 99998 },
    floatingMessageContainer: { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center' },
    floatingMessageSender: { color: '#00E5FF', fontWeight: 'bold', fontSize: 13, marginRight: 6 },
    floatingMessageText: { color: '#FFF', fontSize: 13 },

    liveViewerBadge: { position: 'absolute', top: 15, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', zIndex: 99999 },
    liveViewerText: { color: '#FFF', marginLeft: 6, fontWeight: 'bold', fontSize: 13 },

    reactionMessageWrapper: {
        alignSelf: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    reactionMessageText: { color: '#8F98A0', fontSize: 12, fontWeight: '500' },

    nowPlayingBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#17171C', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: 8 },
    nowPlayingText: { color: '#FFF', fontSize: 13, flex: 1 },

    externalControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#14141A', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
    externalLeftControls: { flexDirection: 'row', gap: 12 },
    externalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    externalRightControls: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    externalBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

    controlsContainer: { flex: 1, padding: 16 },

    tabContainer: { flexDirection: 'row', backgroundColor: '#17171C', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
    tabBtnActive: { backgroundColor: '#2A2A30' },
    tabText: { color: '#8F98A0', fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: '#FFF' },

    hostPanel: { flex: 1 },
    searchRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
    searchInput: { flex: 1, backgroundColor: '#17171C', color: '#FFF', borderRadius: 10, paddingHorizontal: 16, height: 56, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },

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
    chatBubbleMe: { borderBottomRightRadius: 4 },
    chatText: { color: '#FFF', fontSize: 14, lineHeight: 20 },
    chatInputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#17171C', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', gap: 10 },
    chatInput: { flex: 1, backgroundColor: '#0A0A0C', color: '#FFF', borderRadius: 20, paddingHorizontal: 16, height: 44, fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

    sendBtnContainer: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
    sendBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    bottomSheet: { backgroundColor: '#17171C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '60%' },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sheetTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },

    gridFriendItem: { width: '25%', alignItems: 'center' },
    gridFriendAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#9B51E0', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent', position: 'relative' },
    gridFriendAvatarSelected: { borderColor: '#00E5FF' },
    gridFriendAvatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 20 },
    checkBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#17171C', borderRadius: 12 },
    gridFriendName: { color: '#FFF', fontSize: 12, fontWeight: '500', marginTop: 8, textAlign: 'center', paddingHorizontal: 4 },

    bulkSendBtn: { backgroundColor: '#00E5FF', paddingVertical: 14, borderRadius: 16, alignItems: 'center', marginTop: 10 },
    bulkSendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
    bulkSendBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

    modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    permissionModal: { backgroundColor: '#1E1E24', borderRadius: 20, padding: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
    permissionTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    permissionDesc: { color: '#8F98A0', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    permissionActions: { gap: 12 },
    permBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
    permBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 },
    viewersBar: {
        backgroundColor: '#14141A',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)'
    },
    viewersBarTitle: {
        color: '#8F98A0',
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.8
    },
    viewersScroll: {
        gap: 10,
        alignItems: 'center'
    },
    viewerChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 229, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(0, 229, 255, 0.3)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6
    },
    viewerChipText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600'
    },
});