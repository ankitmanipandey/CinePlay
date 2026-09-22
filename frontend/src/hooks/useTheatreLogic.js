import { useState, useEffect, useRef, useCallback } from 'react';
import { Keyboard, Animated, Easing, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import io from 'socket.io-client';
import * as ScreenOrientation from 'expo-screen-orientation';
import Toast from 'react-native-toast-message';
import axios from 'axios';

import { useAuthStore } from '../store/useAuthStore';
import { tmdbService } from '../services/tmdbService';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;
const SOCKET_URL = BACKEND_URL;
const OVERLAY_FADE_IN_MS = 200;
const OVERLAY_FADE_OUT_MS = 300;
const VIDLINK_OVERLAY_HIDE_MS = 4000;

const RAW_KEYS = process.env.EXPO_PUBLIC_YOUTUBE_API_KEYS || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || '';
let ACTIVE_YT_KEYS = RAW_KEYS.split(',').map(k => k.trim()).filter(Boolean);

export const fetchYouTubeWithRetry = async (urlTemplate) => {
    if (ACTIVE_YT_KEYS.length === 0) return { error: { message: 'No YouTube API key configured' } };
    let lastError = null;
    for (const key of ACTIVE_YT_KEYS) {
        try {
            const res = await fetch(urlTemplate.replace('__API_KEY__', key));
            const data = await res.json();
            if (!data.error) return data;
            lastError = data;
            if (res.status !== 403) break;
        } catch (e) {
            lastError = { error: { message: 'Network error' } };
        }
    }
    return lastError || { error: { message: 'YouTube search failed' } };
};

export const useTheatreLogic = (width, height, isDesktop) => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const firstParam = (v) => (Array.isArray(v) ? v[0] : v);

    const roomId = firstParam(params.roomId);
    const isHost = firstParam(params.isHost);
    const initialYtId = firstParam(params.initialYtId);
    const initialTitle = firstParam(params.initialTitle);
    const startWithInitial = isHost === 'true' && !!initialYtId;

    const [isHostLocal, setIsHostLocal] = useState(isHost === 'true');
    const isHostRef = useRef(isHost === 'true');
    useEffect(() => { isHostRef.current = isHostLocal; }, [isHostLocal]);

    const [isJoining, setIsJoining] = useState(!isHostLocal);
    const { user, token } = useAuthStore();
    const [username, setUsername] = useState('');
    const [roomUsers, setRoomUsers] = useState([]);
    const [selectedUserToMod, setSelectedUserToMod] = useState(null);

    const [socket, setSocket] = useState(null);

    const [ytId, setYtId] = useState(startWithInitial ? initialYtId : '');
    const [videoTitle, setVideoTitle] = useState(startWithInitial ? (initialTitle || '') : '');
    const [isPlaying, setIsPlaying] = useState(startWithInitial);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullScreen, setIsFullScreen] = useState(false);

    const [isPinModalVisible, setIsPinModalVisible] = useState(false);
    const [roomPinInput, setRoomPinInput] = useState('');

    const ytIdRef = useRef(startWithInitial ? initialYtId : '');
    const videoTitleRef = useRef(startWithInitial ? (initialTitle || '') : '');
    useEffect(() => { ytIdRef.current = ytId; }, [ytId]);
    useEffect(() => { videoTitleRef.current = videoTitle; }, [videoTitle]);

    const playerRef = useRef(null);
    const isPlayingRef = useRef(startWithInitial);
    const webViewRef = useRef(null);
    const vidLinkTimeRef = useRef(0);
    const lastVidLinkEmitRef = useRef(0);
    const isVidLinkRef = useRef(false);

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
    const [pendingRequests, setPendingRequests] = useState([]);

    const [showFloatingEmojis, setShowFloatingEmojis] = useState(true);
    const [activeReactions, setActiveReactions] = useState([]);
    const [showFloatingMessages, setShowFloatingMessages] = useState(true);
    const [activeFloatingMessages, setActiveFloatingMessages] = useState([]);

    const [overlayVisible, setOverlayVisible] = useState(true);
    const [tvDetails, setTvDetails] = useState(null);

    const isCustomVideo = !!ytId && ytId.startsWith('CUSTOM:');
    const isVidLink = !!ytId && ytId.startsWith('VIDLINK:');
    useEffect(() => { isVidLinkRef.current = isVidLink; }, [isVidLink]);

    const vidLinkParts = isVidLink ? ytId.split(':') : [];
    const vidLinkType = vidLinkParts[1] || 'movie';
    const vidLinkId = vidLinkParts[2];
    const vidLinkSeason = vidLinkParts[3] ? parseInt(vidLinkParts[3], 10) : 1;
    const vidLinkEpisode = vidLinkParts[4] ? parseInt(vidLinkParts[4], 10) : 1;

    const overlayTouchRef = useRef(false);
    const overlayAnim = useRef(new Animated.Value(1)).current;
    const vidLinkOverlayTimer = useRef(null);

    const [isGifPickerVisible, setIsGifPickerVisible] = useState(false);
    const [gifSearchQuery, setGifSearchQuery] = useState('');
    const [gifs, setGifs] = useState([]);
    const [isFetchingGifs, setIsFetchingGifs] = useState(false);

    const fetchGiphy = async (query = '') => {
        setIsFetchingGifs(true);
        const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
        const url = query.trim()
            ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
            : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=pg-13`;

        try {
            const response = await axios.get(url);
            setGifs(response.data.data);
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Failed to load GIFs' });
        } finally {
            setIsFetchingGifs(false);
        }
    };

    useEffect(() => { if (isGifPickerVisible) fetchGiphy(); }, [isGifPickerVisible]);

    const wakeVidLinkOverlay = useCallback(() => {
        if (!isVidLinkRef.current) return;
        setOverlayVisible(true);
        Animated.timing(overlayAnim, { toValue: 1, duration: OVERLAY_FADE_IN_MS, useNativeDriver: true }).start();
        if (vidLinkOverlayTimer.current) clearTimeout(vidLinkOverlayTimer.current);
        vidLinkOverlayTimer.current = setTimeout(() => {
            Animated.timing(overlayAnim, { toValue: 0, duration: OVERLAY_FADE_OUT_MS, useNativeDriver: true }).start(({ finished }) => {
                if (finished) setOverlayVisible(false);
            });
        }, VIDLINK_OVERLAY_HIDE_MS);
    }, [overlayAnim]);

    const extendOverlay = useCallback(() => {
        overlayTouchRef.current = true;
        if (isVidLinkRef.current) wakeVidLinkOverlay();
        else playerRef.current?.extendControls?.();
    }, [wakeVidLinkOverlay]);

    const handleVidLinkPlayerEvent = useCallback((eventData) => {
        if (!eventData) return;
        const { event: evt, currentTime } = eventData;
        if (typeof currentTime === 'number') vidLinkTimeRef.current = currentTime;

        if (!isHostRef.current || !socket) return;

        if (evt === 'play') {
            setIsPlaying(true);
            socket.emit('sync_action', { roomId, action: 'play', timestamp: currentTime });
        } else if (evt === 'pause') {
            setIsPlaying(false);
            socket.emit('sync_action', { roomId, action: 'pause', timestamp: currentTime });
        } else if (evt === 'seeked') {
            socket.emit('sync_action', { roomId, action: isPlayingRef.current ? 'play' : 'pause', timestamp: currentTime });
        } else if (evt === 'timeupdate') {
            const now = Date.now();
            if (now - lastVidLinkEmitRef.current > 1000) {
                lastVidLinkEmitRef.current = now;
                socket.emit('sync_action', { roomId, action: isPlayingRef.current ? 'play' : 'pause', timestamp: currentTime });
            }
        }
    }, [socket, roomId]);

    const applyVidLinkRemoteSync = useCallback((data) => {
        if (!webViewRef.current) return;
        const t = typeof data.timestamp === 'number' ? data.timestamp : 0;
        const shouldPlay = data.action !== 'pause';
        const js = `
            (function() {
                var v = document.querySelector('video');
                if (!v) {
                    var iframes = document.querySelectorAll('iframe');
                    for (var i = 0; i < iframes.length; i++) {
                        try { v = iframes[i].contentDocument.querySelector('video'); if (v) break; } catch(e) {}
                    }
                }
                if (v) {
                    if (Math.abs(v.currentTime - ${t}) > 2) { v.currentTime = ${t}; }
                    if (${shouldPlay}) {
                        var playPromise = v.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(function(e) { console.log("Autoplay blocked, waiting for interaction"); });
                        }
                    } else { v.pause(); }
                }
            })();
            true;
        `;
        webViewRef.current.injectJavaScript(js);
    }, []);

    useEffect(() => {
        if (ytId) {
            if (isVidLink) wakeVidLinkOverlay();
            else {
                overlayAnim.setValue(1);
                setOverlayVisible(true);
            }
        }
        return () => { if (vidLinkOverlayTimer.current) clearTimeout(vidLinkOverlayTimer.current); };
    }, [ytId, isVidLink, wakeVidLinkOverlay]);

    useEffect(() => {
        if (isVidLink && vidLinkType === 'tv' && vidLinkId) {
            tmdbService.getDetails(vidLinkId, 'tv')
                .then(details => { if (details) setTvDetails(details); })
                .catch(() => { });
        } else {
            setTvDetails(null);
        }
    }, [isVidLink, vidLinkType, vidLinkId]);

    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    useEffect(() => {
        if (Platform.OS !== 'web') {
            const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
            const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
            return () => { keyboardDidShowListener.remove(); keyboardDidHideListener.remove(); };
        }
    }, []);

    useEffect(() => {
        const assignedUsername = user?.name ? user.name : `Guest-${Math.floor(1000 + Math.random() * 9000)}`;
        setUsername(assignedUsername);

        if (Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);

        const newSocket = io(SOCKET_URL, { auth: { token } });
        setSocket(newSocket);

        newSocket.on('connect', () => {
            newSocket.emit('join_room', { roomId, username: assignedUsername, isHost: isHostRef.current });
            if (isHostRef.current && ytIdRef.current) {
                newSocket.emit('change_video', { roomId, ytId: ytIdRef.current, title: videoTitleRef.current || initialTitle || '' });
            }
        });

        newSocket.on('require_pin', () => { setIsJoining(false); setIsPinModalVisible(true); });
        newSocket.on('room_users', (userList) => { setIsJoining(false); setRoomUsers(userList); });

        newSocket.on('role_assigned', ({ isHost: assignedHost }) => {
            const nowHost = !!assignedHost;
            if (isHostRef.current === nowHost) return;
            isHostRef.current = nowHost;
            setIsHostLocal(nowHost);
            if (!nowHost) webViewRef.current?.injectJavaScript('window.__demoteToJoinee && window.__demoteToJoinee(); true;');
        });

        newSocket.on('host_migrated', () => {
            isHostRef.current = true;
            setIsHostLocal(true);
            setIsMuted(false);
            webViewRef.current?.injectJavaScript('window.__promoteToHost && window.__promoteToHost(); true;');
            Toast.show({ type: 'hotstarSuccess', text1: 'You are the new Host!', text2: 'The previous host left. You now control the theatre.' });
        });

        newSocket.on('kicked_from_room', (data) => {
            Toast.show({ type: 'hotstarError', text1: 'Removed', text2: data.reason, position: 'top' });
            if (router.canGoBack()) router.back(); else router.replace('/');
        });

        newSocket.on('new_video', (data) => {
            if (isHostRef.current) return;
            setYtId(data.ytId);
            setVideoTitle(data.title);
            setIsPlaying(true);
            setIsMuted(false);
        });

        newSocket.on('room_not_found', () => {
            Toast.show({ type: 'hotstarError', text1: 'Room Not Found', text2: 'This room does not exist or has been closed.', position: 'top' });
            if (router.canGoBack()) router.back(); else router.replace('/');
        });

        newSocket.on('waiting_for_host', () => { setIsJoining(false); setIsWaitingForHost(true); });
        newSocket.on('entry_approved', () => { setIsWaitingForHost(false); Toast.show({ type: 'hotstarSuccess', text1: 'Host let you in!', position: 'top' }); });
        newSocket.on('entry_denied', (data) => {
            Toast.show({ type: 'hotstarError', text1: 'Entry Denied', text2: data.reason, position: 'top' });
            if (router.canGoBack()) router.back(); else router.replace('/');
        });

        newSocket.on('request_host_permission', (data) => {
            if (isHostRef.current) setPendingRequests(prev => [...prev, data]);
        });

        newSocket.on('remote_sync', (data) => {
            if (isHostRef.current) return;
            if (isVidLinkRef.current) {
                setIsPlaying(data.action !== 'pause');
                applyVidLinkRemoteSync(data);
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
                const newFloatMsg = { id: data.id, sender: data.sender, text: data.text, gifUrl: data.gifUrl };
                setActiveFloatingMessages(prev => [...prev, newFloatMsg]);
            }
            setMessages(prev => [...prev, data]);
            setTimeout(() => { chatListRef.current?.scrollToEnd({ animated: true }); }, 100);
        });

        newSocket.on('room_closed', () => {
            if (!isHostRef.current) {
                Toast.show({ type: 'hotstarError', text1: 'Room Closed', text2: 'The host has ended the watch party.', position: 'top' });
                if (router.canGoBack()) router.back(); else router.replace('/');
            }
        });

        return () => {
            newSocket.disconnect();
            if (Platform.OS !== 'web') ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        };
    }, [roomId, user?._id, token, initialYtId, initialTitle, applyVidLinkRemoteSync]);

    useEffect(() => {
        if (!isHostLocal || !socket || !ytId || isVidLink) return;
        let lastTime = 0;
        const interval = setInterval(() => {
            playerRef.current?.getCurrentTime().then(currentTime => {
                const currentIsPlaying = isPlayingRef.current;
                if (currentIsPlaying && Math.abs(currentTime - lastTime - 1) > 2 && lastTime !== 0) {
                    socket?.emit('sync_action', { roomId, action: 'play', timestamp: currentTime });
                }
                lastTime = currentTime;
                socket?.emit('sync_action', { roomId, action: currentIsPlaying ? 'play' : 'pause', timestamp: currentTime });
            }).catch(() => { });
        }, 1000);
        return () => clearInterval(interval);
    }, [isHostLocal, socket, ytId, roomId, isVidLink]);

    const onPlayerStateChange = (state) => {
        if (!isHostLocal) return;
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
        if (!socket) return;
        const msgData = { id: Date.now().toString(), roomId, sender: username, text: emoji, isReaction: true };
        setActiveReactions(prev => [...prev, { id: msgData.id, emoji, sender: username }]);
        setMessages(prev => [...prev, msgData]);
        socket.emit('send_chat', msgData);
    };

    const removeReaction = (id) => setActiveReactions(prev => prev.filter(r => r.id !== id));
    const removeFloatingMessage = (id) => setActiveFloatingMessages(prev => prev.filter(m => m.id !== id));
    const toggleDistractionFree = () => setShowFloatingEmojis(prev => !prev);
    const handleVideoTap = () => { if (!isCustomVideo && !isVidLink) playerRef.current?.toggleControls?.(); };

    const sendChatText = (raw) => {
        const text = (raw || '').trim();
        if (!text || !socket) return;
        const msgData = { id: Date.now().toString(), roomId, sender: username, text, isReaction: false };
        setMessages(prev => [...prev, msgData]);
        setActiveFloatingMessages(prev => [...prev, { id: msgData.id, sender: username, text }]);
        socket.emit('send_chat', msgData);
    };

    const sendGif = (gifUrl) => {
        if (!socket) return;
        const msgData = { id: Date.now().toString(), roomId, sender: username, text: '', gifUrl: gifUrl, isReaction: false };
        setMessages(prev => [...prev, msgData]);
        socket.emit('send_chat', msgData);
        setIsGifPickerVisible(false);
        setGifSearchQuery('');
    };

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;
        sendChatText(chatInput);
        setChatInput('');
    };

    const [chatPanelRendered, setChatPanelRendered] = useState(isDesktop); // Auto-open on desktop
    const chatAnim = useRef(new Animated.Value(isDesktop ? 1 : 0)).current;

    const openChatPanel = () => {
        setActiveFloatingMessages([]);
        setChatPanelRendered(true);
        Animated.timing(chatAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    };

    const closeChatPanel = () => {
        if (isDesktop) return; // Never close on desktop
        Keyboard.dismiss();
        setActiveFloatingMessages([]);
        Animated.timing(chatAnim, { toValue: 0, duration: 300, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
            setChatPanelRendered(false);
        });
    };

    const handleChatButtonTap = () => setShowFloatingMessages(prev => !prev);

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
        Keyboard.dismiss();
    };

    const handleSeasonChange = (seasonNum) => {
        if (!isHostLocal) return Toast.show({ type: 'hotstarInfo', text1: 'Only the host can change seasons' });
        const newYtId = `VIDLINK:tv:${vidLinkId}:${seasonNum}:1`;
        setYtId(newYtId);
        socket?.emit('change_video', { roomId, ytId: newYtId, title: videoTitle });
    };

    const handleEpisodeChange = (epNum) => {
        if (!isHostLocal) return Toast.show({ type: 'hotstarInfo', text1: 'Only the host can change episodes' });
        const newYtId = `VIDLINK:tv:${vidLinkId}:${vidLinkSeason}:${epNum}`;
        setYtId(newYtId);
        socket?.emit('change_video', { roomId, ytId: newYtId, title: videoTitle });
    };

    const toggleFullScreen = async () => {
        if (isFullScreen) {
            Keyboard.dismiss();
            if (Platform.OS !== 'web') {
                setChatPanelRendered(false);
                chatAnim.setValue(0);
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            }
            setIsFullScreen(false);
        } else {
            if (Platform.OS !== 'web') {
                await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
            }
            setIsFullScreen(true);
        }
    };

    const handleBackPress = async () => {
        if (isFullScreen) await toggleFullScreen();
        else router.back();
    };

    const handlePinSubmit = () => {
        if (!roomPinInput) return Toast.show({ type: 'hotstarError', text1: 'PIN is required' });
        setIsPinModalVisible(false);
        setIsJoining(true);
        socket.emit('join_room', { roomId, username, isHost: isHostRef.current, pin: roomPinInput });
    };

    const handleHostDecision = (decision, request) => {
        socket.emit('host_decision', { ...request, decision, roomId, hostUserId: user?._id });
        setPendingRequests(prev => prev.filter(req => req.joinerSocketId !== request.joinerSocketId));
    };

    const handleKick = () => {
        if (!selectedUserToMod) return;
        socket.emit('kick_user', { roomId, targetSocketId: selectedUserToMod.socketId });
        Toast.show({ type: 'hotstarSuccess', text1: `${selectedUserToMod.username} was kicked.` });
        setSelectedUserToMod(null);
    };

    const handleKickAndBlock = () => {
        if (!selectedUserToMod) return;
        socket.emit('kick_and_block_user', { roomId, targetSocketId: selectedUserToMod.socketId, hostUserId: user?._id });
        Toast.show({ type: 'hotstarSuccess', text1: `${selectedUserToMod.username} was blocked.` });
        setSelectedUserToMod(null);
    };

    const openShareModal = async () => {
        if (!user) return Toast.show({ type: 'hotstarInfo', text1: 'Log in to invite friends!' });
        setIsShareModalVisible(true);
        setSelectedFriends([]);
        setIsFetchingFriends(true);
        try {
            const res = await axios.get(`${BACKEND_URL}/buddies/list`, { headers: { Authorization: `Bearer ${token}` } });
            setFriendsList(res.data);
        } catch (error) { Toast.show({ type: 'hotstarError', text1: 'Failed to load friends.' }); }
        finally { setIsFetchingFriends(false); }
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
        } catch (error) { Toast.show({ type: 'hotstarError', text1: 'Failed to send some invites.' }); }
    };

    return {
        router, roomId, isHostLocal, isJoining, isWaitingForHost, roomUsers,
        selectedUserToMod, setSelectedUserToMod, ytId, videoTitle, isPlaying,
        isMuted, isFullScreen, isPinModalVisible, roomPinInput, setRoomPinInput,
        searchType, setSearchType, searchInput, setSearchInput, searchResults, setSearchResults,
        isSearching, activeTab, setActiveTab, messages, chatInput, setChatInput,
        chatListRef, isKeyboardVisible, isShareModalVisible, setIsShareModalVisible,
        friendsList, isFetchingFriends, selectedFriends, pendingRequests,
        showFloatingEmojis, activeReactions, showFloatingMessages, activeFloatingMessages,
        overlayVisible, setOverlayVisible, tvDetails, isCustomVideo, isVidLink, vidLinkType, vidLinkId,
        vidLinkSeason, vidLinkEpisode, overlayTouchRef, overlayAnim, chatAnim,
        isGifPickerVisible, setIsGifPickerVisible, gifSearchQuery, setGifSearchQuery,
        gifs, isFetchingGifs, username, webViewRef, playerRef,
        wakeVidLinkOverlay, extendOverlay, handleVidLinkPlayerEvent, applyVidLinkRemoteSync,
        onPlayerStateChange, sendReaction, removeReaction, removeFloatingMessage,
        toggleDistractionFree, handleVideoTap, sendChatText, sendGif, handleSendMessage,
        openChatPanel, closeChatPanel, handleChatButtonTap, handleSearch, handleSelectVideo,
        handleSeasonChange, handleEpisodeChange, toggleFullScreen, handleBackPress,
        handlePinSubmit, handleHostDecision, handleKick, handleKickAndBlock, openShareModal,
        toggleFriendSelection, sendBulkTheatreInvites
    };
};