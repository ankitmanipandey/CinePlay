import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { WebView } from 'react-native-webview';

import TheatrePlayer from '../screens/TheatrePlayer';
import { useAuthStore } from '../store/useAuthStore';
import { tmdbService } from '../services/tmdbService';
import { getImageUrl } from '../constants/config';

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

    // --- Vidking (WebView) specific refs ---
    const webViewRef = useRef(null);
    const vidkingTimeRef = useRef(0);
    const lastVidkingEmitRef = useRef(0);
    const isVidkingRef = useRef(false);

    const [searchType, setSearchType] = useState('youtube');

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
    const [tvDetails, setTvDetails] = useState(null);

    const isCustomVideo = !!ytId && ytId.startsWith('CUSTOM:');
    const isVidking = !!ytId && ytId.startsWith('VIDKING:');

    useEffect(() => { isVidkingRef.current = isVidking; }, [isVidking]);

    const vidkingParts = isVidking ? ytId.split(':') : [];
    const vidkingType = vidkingParts[1] || 'movie';
    const vidkingId = vidkingParts[2];
    const vidkingSeason = vidkingParts[3] ? parseInt(vidkingParts[3], 10) : 1;
    const vidkingEpisode = vidkingParts[4] ? parseInt(vidkingParts[4], 10) : 1;

    // --- Vidking Auto-Hide Timer Logic ---
    const vidkingOverlayTimer = useRef(null);

    const wakeVidkingOverlay = useCallback(() => {
        if (!isVidking) return;
        setOverlayVisible(true);
        if (vidkingOverlayTimer.current) clearTimeout(vidkingOverlayTimer.current);
        vidkingOverlayTimer.current = setTimeout(() => {
            setOverlayVisible(false);
        }, 4000); // UI auto-hides after 4 seconds of inactivity
    }, [isVidking]);

    // --- Vidking real-time sync: host relays real player events, viewer enforces them ---
    const handleVidkingPlayerEvent = useCallback((eventData) => {
        if (!eventData) return;
        const { event: evt, currentTime } = eventData;
        if (typeof currentTime === 'number') vidkingTimeRef.current = currentTime;

        // Only the host broadcasts sync — viewers never emit from their own player events.
        if (!isHostBool || !socket) return;

        if (evt === 'play') {
            setIsPlaying(true);
            socket.emit('sync_action', { roomId, action: 'play', timestamp: currentTime });
        } else if (evt === 'pause') {
            setIsPlaying(false);
            socket.emit('sync_action', { roomId, action: 'pause', timestamp: currentTime });
        } else if (evt === 'seeked') {
            socket.emit('sync_action', { roomId, action: isPlayingRef.current ? 'play' : 'pause', timestamp: currentTime });
        } else if (evt === 'timeupdate') {
            // Throttle to ~1/sec so we don't flood the socket with every tick.
            const now = Date.now();
            if (now - lastVidkingEmitRef.current > 1000) {
                lastVidkingEmitRef.current = now;
                socket.emit('sync_action', { roomId, action: isPlayingRef.current ? 'play' : 'pause', timestamp: currentTime });
            }
        }
    }, [isHostBool, socket, roomId]);

    // Viewer-side: drive the real <video> element inside the WebView directly,
    // since Vidking has no documented inbound postMessage command API.
    const applyVidkingRemoteSync = useCallback((data) => {
        if (!webViewRef.current) return;
        const t = typeof data.timestamp === 'number' ? data.timestamp : 0;
        const shouldPlay = data.action !== 'pause';
        const js = `
            (function() {
                try {
                    var v = document.querySelector('video');
                    if (v) {
                        if (Math.abs(v.currentTime - (${t})) > 1.5) { v.currentTime = ${t}; }
                        if (${shouldPlay}) { v.play().catch(function(){}); }
                        else { v.pause(); }
                    }
                } catch (e) {}
            })();
            true;
        `;
        webViewRef.current.injectJavaScript(js);
    }, []);

    useEffect(() => {
        if (ytId) {
            if (isVidking) {
                wakeVidkingOverlay();
            } else {
                setOverlayVisible(true);
                extendOverlayTimer();
            }
        }
        return () => {
            if (vidkingOverlayTimer.current) clearTimeout(vidkingOverlayTimer.current);
        };
    }, [ytId, isVidking, wakeVidkingOverlay]);

    // Ensure TV Details fetch updates correctly
    useEffect(() => {
        if (isVidking && vidkingType === 'tv' && vidkingId) {
            tmdbService.getDetails(vidkingId, 'tv')
                .then(details => {
                    if (details) setTvDetails(details);
                })
                .catch(() => { });
        } else {
            setTvDetails(null);
        }
    }, [isVidking, vidkingType, vidkingId]);

    const tvSeasons = tvDetails?.seasons?.filter(s => s.season_number > 0) || [];
    const currentSeasonData = tvSeasons.find(s => s.season_number === vidkingSeason) || tvSeasons[0];
    const episodeCount = currentSeasonData?.episode_count || 1;
    const episodesArray = Array.from({ length: episodeCount }, (_, i) => i + 1);

    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
        return () => {
            keyboardDidShowListener.remove();
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

            if (isVidkingRef.current) {
                setIsPlaying(data.action !== 'pause');
                applyVidkingRemoteSync(data);
                return;
            }

            playerRef.current?.getCurrentTime().then(viewerTime => {
                const timeDiff = Math.abs(viewerTime - data.timestamp);
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
    }, [roomId, isHostBool, user, initialYtId, initialTitle, applyVidkingRemoteSync]);

    // --- HOST SYNC ENGINE (YouTube / custom video only — Vidking is event-driven via handleVidkingPlayerEvent) ---
    useEffect(() => {
        if (!isHostBool || !socket || !ytId || isVidking) return;
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
    }, [isHostBool, socket, ytId, roomId, isVidking]);

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

    const removeReaction = (id) => setActiveReactions(prev => prev.filter(r => r.id !== id));
    const removeFloatingMessage = (id) => setActiveFloatingMessages(prev => prev.filter(m => m.id !== id));
    const toggleDistractionFree = () => setShowFloatingEmojis(prev => !prev);

    // Extends timer for UI buttons based on the active player type
    const extendOverlayTimer = () => {
        if (isVidking) {
            wakeVidkingOverlay();
        } else {
            playerRef.current?.extendControls?.();
        }
    };

    const handleVideoTap = () => {
        if (!isCustomVideo && !isVidking) {
            playerRef.current?.toggleControls?.();
        }
    };

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;
        const msgData = { id: Date.now().toString(), roomId, sender: username, text: chatInput.trim(), isReaction: false };
        setMessages(prev => [...prev, msgData]);
        setActiveFloatingMessages(prev => [...prev, { id: msgData.id, sender: username, text: msgData.text }]);
        socket.emit('send_chat', msgData);
        setChatInput('');
    };

    const handleSearch = async () => {
        if (!searchInput.trim()) return;
        Keyboard.dismiss();
        setIsSearching(true);
        try {
            if (searchType === 'youtube') {
                const searchUrlTemplate = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchInput)}&type=video&maxResults=10&key=__API_KEY__`;
                const data = await fetchYouTubeWithRetry(searchUrlTemplate);
                if (data.error) Toast.show({ type: 'hotstarError', text1: data.error.message });
                else if (data.items) setSearchResults(data.items);
            } else {
                const tmdbResults = await tmdbService.smartSearch(searchInput, 1);
                setSearchResults(tmdbResults || []);
            }
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Search failed' });
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

    const handleSeasonChange = (seasonNum) => {
        if (!isHostBool) {
            Toast.show({ type: 'hotstarInfo', text1: 'Only the host can change episodes' });
            return;
        }
        const newYtId = `VIDKING:tv:${vidkingId}:${seasonNum}:1`;
        setYtId(newYtId);
        socket?.emit('change_video', { roomId, ytId: newYtId, title: videoTitle });
    };

    const handleEpisodeChange = (epNum) => {
        if (!isHostBool) {
            Toast.show({ type: 'hotstarInfo', text1: 'Only the host can change episodes' });
            return;
        }
        const newYtId = `VIDKING:tv:${vidkingId}:${vidkingSeason}:${epNum}`;
        setYtId(newYtId);
        socket?.emit('change_video', { roomId, ytId: newYtId, title: videoTitle });
    };

    const toggleFullScreen = async () => {
        if (isFullScreen) {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            setIsFullScreen(false);
            extendOverlayTimer();
        } else {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            setIsFullScreen(true);
            extendOverlayTimer();
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
            Toast.show({ type: 'hotstarError', text1: 'Failed to send some invites.' });
        }
    };

    const renderSearchResult = ({ item }) => {
        if (searchType === 'youtube') {
            return (
                <TouchableOpacity style={styles.resultCard} activeOpacity={0.8} onPress={() => handleSelectVideo(item.id.videoId, item.snippet?.title)}>
                    <Image source={{ uri: item.snippet?.thumbnails?.medium?.url }} style={styles.resultImage} />
                    <View style={styles.resultPlayIcon}><Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.8)" /></View>
                    <Text style={styles.resultTitle} numberOfLines={2}>{item.snippet?.title}</Text>
                </TouchableOpacity>
            );
        } else {
            const title = item.title || item.name;
            const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
            const vidId = mediaType === 'tv'
                ? `VIDKING:tv:${item.id}:1:1`
                : `VIDKING:movie:${item.id}`;
            return (
                <TouchableOpacity style={styles.resultCard} activeOpacity={0.8} onPress={() => handleSelectVideo(vidId, title)}>
                    <Image source={{ uri: getImageUrl(item.backdrop_path || item.poster_path, 'w500') }} style={[styles.resultImage, { backgroundColor: '#25252A' }]} />
                    <View style={styles.resultPlayIcon}><Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.8)" /></View>
                    <Text style={styles.resultTitle} numberOfLines={2}>{title}</Text>
                </TouchableOpacity>
            );
        }
    };

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

    // Controls visibility logic cleanly respects the timer states
    const showOverlayUI = ytId && overlayVisible;

    return (
        <SafeAreaView style={styles.safeArea} edges={isFullScreen ? [] : ['top', 'left', 'right']}>
            <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
                <StatusBar hidden={isFullScreen} showHideTransition="slide" barStyle="light-content" backgroundColor="#000" translucent={false} />

                {/* --- VIDEO CONTAINER --- */}
                <View
                    style={[
                        styles.playerContainer,
                        { width: containerWidth, height: containerHeight },
                        isFullScreen && { position: 'absolute', top: 0, left: 0, zIndex: 9999, elevation: 9999, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }
                    ]}
                    onStartShouldSetResponderCapture={() => {
                        if (ytId && !isVidking) {
                            handleVideoTap();
                        }
                        return false;
                    }}
                >
                    {isVidking ? (
                        <View style={{ width: innerVideoWidth, height: innerVideoHeight, backgroundColor: '#000', position: 'relative' }}>
                            <WebView
                                ref={webViewRef}
                                key={`vidking-theatre-${vidkingId}-${vidkingSeason}-${vidkingEpisode}`}
                                source={{
                                    uri: `https://www.vidking.net/embed/${vidkingType === 'tv'
                                        ? `tv/${vidkingId}/${vidkingSeason}/${vidkingEpisode}`
                                        : `movie/${vidkingId}`
                                        }?autoPlay=true`
                                }}
                                style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
                                javaScriptEnabled={true}
                                allowsFullscreenVideo={false}
                                mediaPlaybackRequiresUserAction={false}
                                allowsInlineMediaPlayback={true}
                                setSupportMultipleWindows={false}
                                onMessage={(event) => {
                                    try {
                                        const data = JSON.parse(event.nativeEvent.data);
                                        if (data.type === 'USER_TOUCH') {
                                            wakeVidkingOverlay();
                                        } else if (data.type === 'PLAYER_EVENT') {
                                            handleVidkingPlayerEvent(data.data);
                                        }
                                    } catch (e) { }
                                }}
                                onShouldStartLoadWithRequest={(request) => {
                                    if (!request.url.includes('vidking.net') && !request.url.includes('about:blank')) {
                                        return false;
                                    }
                                    return true;
                                }}
                                injectedJavaScript={`
                (function() {
                    window.open = function() { return null; };
                    var restrictJoinee = ${!isHostBool};

                    var rules = [
                        'iframe[src*="ads"], .ad-overlay, .jw-ad, .jw-icon-fullscreen, .vjs-fullscreen-control, [aria-label="Fullscreen"], [title="Fullscreen"] { display: none !important; }'
                    ];

                    // Joinees keep full access to volume, captions, settings, quality/language,
                    // and can still tap to reveal the controlbar/progress — only the actual
                    // play/pause toggle and the seek/scrub bar are made inert.
                    if (restrictJoinee) {
                        rules.push(
                            '.jw-display-icon-container, .jw-icon-playback, .jw-icon-display, ' +
                            '.jw-progress, .jw-rail, .jw-buffer, .jw-knob, ' +
                            '.jw-slider-time, .jw-slider-horizontal, .jw-rail-group ' +
                            '{ pointer-events: none !important; }'
                        );
                    }

                    var style = document.createElement('style');
                    style.innerHTML = rules.join(' ');
                    document.head.appendChild(style);

                    var triggerPlay = function() {
                        var v = document.querySelector('video');
                        if (v) v.play().catch(function(){});
                        var playBtn = document.querySelector('.play-btn, .jw-display-icon-container, [aria-label="Play"]');
                        if (playBtn) playBtn.click();
                    };
                    setTimeout(triggerPlay, 400);
                    setTimeout(triggerPlay, 1200);
                    setTimeout(triggerPlay, 2500);

                    ['click', 'touchstart'].forEach(function(evt) {
                        document.addEventListener(evt, function(e) {
                            if (!e.isTrusted) return;
                            if (window.ReactNativeWebView) {
                                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'USER_TOUCH' }));
                            }
                        }, { passive: true });
                    });

                    window.addEventListener('message', function(event) {
                        try {
                            var msg = event.data;
                            if (typeof msg === 'string') {
                                try { msg = JSON.parse(msg); } catch (e2) {}
                            }
                            if (msg && msg.type === 'PLAYER_EVENT' && msg.data && window.ReactNativeWebView) {
                                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PLAYER_EVENT', data: msg.data }));
                            }
                        } catch (e) {}
                    });

                    true;
                })();
            `}
                            />

                            {/* Fallback wake hotspot when overlays are hidden */}
                            {!overlayVisible && (
                                <TouchableOpacity
                                    style={styles.fsWakeHotspot}
                                    onPress={wakeVidkingOverlay}
                                    activeOpacity={1}
                                />
                            )}
                        </View>
                    ) : (
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
                    )}

                    {/* Uniform fullscreen exit button for both modes */}
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
                                <Ionicons name={isVidking ? "film" : "play"} size={14} color={isVidking ? "#FF007A" : "#00E5FF"} />
                                <Text style={styles.nowPlayingText} numberOfLines={1}>
                                    <Text style={{ color: '#8F98A0', fontWeight: 'bold' }}>Now Playing: </Text>
                                    {videoTitle}
                                    {isVidking && vidkingType === 'tv' ? ` (S${vidkingSeason} E${vidkingEpisode})` : ''}
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

                        {/* --- TV SHOW SEASONS & EPISODES SELECTOR BAR --- */}
                        {isVidking && vidkingType === 'tv' && tvSeasons.length > 0 && (
                            <View style={styles.theatreTvBar}>
                                <View style={styles.theatreTvHeader}>
                                    <Text style={styles.theatreTvTitle}>
                                        Season {vidkingSeason} • Episode {vidkingEpisode}
                                    </Text>
                                    {!isHostBool && (
                                        <Text style={styles.theatreTvHostOnly}>(Controlled by Host)</Text>
                                    )}
                                </View>

                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.theatreTvRow}>
                                    {tvSeasons.map((season) => (
                                        <TouchableOpacity
                                            key={`theatre-s-${season.season_number}`}
                                            style={[styles.tvChip, vidkingSeason === season.season_number && styles.tvChipActive]}
                                            onPress={() => handleSeasonChange(season.season_number)}
                                        >
                                            <Text style={[styles.tvChipText, vidkingSeason === season.season_number && styles.tvChipTextActive]}>
                                                S{season.season_number}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}

                                    <View style={styles.tvChipDivider} />

                                    {episodesArray.map((ep) => (
                                        <TouchableOpacity
                                            key={`theatre-ep-${ep}`}
                                            style={[styles.tvChip, vidkingEpisode === ep && styles.tvChipActive]}
                                            onPress={() => handleEpisodeChange(ep)}
                                        >
                                            <Text style={[styles.tvChipText, vidkingEpisode === ep && styles.tvChipTextActive]}>
                                                Ep {ep}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

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

                                {/* Search Toggle */}
                                <View style={styles.searchToggleRow}>
                                    <TouchableOpacity
                                        style={[styles.searchToggleBtn, searchType === 'youtube' && styles.searchToggleBtnActiveYt]}
                                        onPress={() => { setSearchType('youtube'); setSearchResults([]); setSearchInput(''); }}
                                    >
                                        <Ionicons name="logo-youtube" size={16} color={searchType === 'youtube' ? "#FF007A" : "#8F98A0"} />
                                        <Text style={[styles.searchToggleText, searchType === 'youtube' && { color: '#FF007A' }]}>YouTube</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.searchToggleBtn, searchType === 'movie' && styles.searchToggleBtnActiveMovie]}
                                        onPress={() => { setSearchType('movie'); setSearchResults([]); setSearchInput(''); }}
                                    >
                                        <Ionicons name="film" size={16} color={searchType === 'movie' ? "#00E5FF" : "#8F98A0"} />
                                        <Text style={[styles.searchToggleText, searchType === 'movie' && { color: '#00E5FF' }]}>Movies / Shows</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.searchRow}>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder={searchType === 'youtube' ? "Search YouTube..." : "Search TMDB Movies / Shows..."}
                                        placeholderTextColor="#8F98A0"
                                        value={searchInput}
                                        onChangeText={setSearchInput}
                                        onSubmitEditing={handleSearch}
                                        returnKeyType="search"
                                        selectionColor={searchType === 'youtube' ? "#FF007A" : "#00E5FF"}
                                    />
                                    <TouchableOpacity style={styles.pushBtnContainer} onPress={handleSearch}>
                                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pushBtnGradient}>
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
                                            keyExtractor={(item, index) => item.id?.videoId || String(item.id) || String(index)}
                                            renderItem={renderSearchResult}
                                            contentContainerStyle={{ gap: 12, paddingVertical: 10 }}
                                            keyboardShouldPersistTaps="handled"
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="search" size={40} color="#2A2A30" />
                                        <Text style={styles.emptyStateText}>Search for a title to sync with the room.</Text>
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
    fsWakeHotspot: { position: 'absolute', top: 0, left: 0, width: 100, height: 100, zIndex: 99998 },

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

    theatreTvBar: {
        backgroundColor: '#121217',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)'
    },
    theatreTvHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    theatreTvTitle: {
        color: '#00E5FF',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    theatreTvHostOnly: {
        color: '#8F98A0',
        fontSize: 11,
        fontStyle: 'italic'
    },
    theatreTvRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 2
    },
    tvChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    tvChipActive: {
        backgroundColor: 'rgba(0, 229, 255, 0.2)',
        borderColor: '#00E5FF'
    },
    tvChipText: {
        color: '#8F98A0',
        fontSize: 12,
        fontWeight: '600'
    },
    tvChipTextActive: {
        color: '#00E5FF',
        fontWeight: 'bold'
    },
    tvChipDivider: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255,255,255,0.15)',
        marginHorizontal: 4
    },

    controlsContainer: { flex: 1, padding: 16 },

    tabContainer: { flexDirection: 'row', backgroundColor: '#17171C', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6 },
    tabBtnActive: { backgroundColor: '#2A2A30' },
    tabText: { color: '#8F98A0', fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: '#FFF' },

    hostPanel: { flex: 1 },

    searchToggleRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    searchToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#17171C', paddingVertical: 10, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: 'transparent' },
    searchToggleBtnActiveYt: { backgroundColor: 'rgba(255, 0, 122, 0.1)', borderColor: '#FF007A' },
    searchToggleBtnActiveMovie: { backgroundColor: 'rgba(0, 229, 255, 0.1)', borderColor: '#00E5FF' },
    searchToggleText: { color: '#8F98A0', fontSize: 13, fontWeight: '600' },

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