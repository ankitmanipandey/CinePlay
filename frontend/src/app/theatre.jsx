import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView,
    Platform, FlatList, Image, ActivityIndicator, Keyboard, StatusBar, ScrollView,
    useWindowDimensions, Modal, Animated, PanResponder, Easing
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';

import TheatrePlayer from '../screens/TheatrePlayer';
import { QuickChatButton, TheatreChatPanel } from '../components/home/TheatreChatUI';
import { getImageUrl } from '../constants/config';
import { useTheatreLogic } from '../hooks/useTheatreLogic';

const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const adBlockScript = `
    (function() {
        try {
            var fakeUA = '${DESKTOP_USER_AGENT}';
            Object.defineProperty(navigator, 'userAgent', { get: function() { return fakeUA; } });
            Object.defineProperty(navigator, 'appVersion', { get: function() { return fakeUA; } });
            Object.defineProperty(navigator, 'platform', { get: function() { return 'Win32'; } });
            Object.defineProperty(navigator, 'webdriver', { get: function() { return false; } });
        } catch (e) {}

        if (window.ReactNativeWebView) {
            window.__rn_send = window.ReactNativeWebView.postMessage.bind(window.ReactNativeWebView);
            try { delete window.ReactNativeWebView; } catch(e) {}
        }
        window.open = function() { return null; };
        try { Object.defineProperty(window, 'open', { configurable: false, writable: false, value: function() { return null; } }); } catch(e) {}
        
        var killAdOverlays = function() {
            var divs = document.querySelectorAll('div');
            for (var i = 0; i < divs.length; i++) {
                var el = divs[i];
                var z = window.getComputedStyle(el).zIndex;
                if (z && parseInt(z) > 9999) {
                    var className = el.className || '';
                    if (typeof className === 'string' && className.indexOf('jw-') === -1 && className.indexOf('vjs-') === -1) {
                        el.style.display = 'none';
                        el.style.pointerEvents = 'none';
                    }
                }
            }
        };
        setInterval(killAdOverlays, 500);
        true;
    })();
`;

const EMOJIS = ['😂', '🔥', '😱', '😍', '👏', '😢'];

const ReactionButtonUI = ({ isFullScreen, showFloatingEmojis, toggleDistractionFree, sendReaction, extendOverlayTimer, isDesktop }) => {
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

    // 👇 --- DESKTOP HOVER UI BRANCH --- 👇
    if (isDesktop) {
        return (
            <View
                style={{ flexDirection: 'column-reverse', alignItems: 'flex-end' }}
                onMouseEnter={() => setPickerVisible(true)}
                onMouseLeave={() => { setPickerVisible(false); setUIHoveredIndex(-1); }}
            >
                <TouchableOpacity style={styles.reactionMainBtn} onPress={toggleDistractionFree} activeOpacity={0.8}>
                    <Ionicons name={showFloatingEmojis ? "happy-outline" : "eye-off-outline"} size={24} color={showFloatingEmojis ? "#FFFFFF" : "#E53935"} />
                </TouchableOpacity>
                {pickerVisible && (
                    <View style={[styles.emojiPickerMenuVertical, { marginBottom: 10 }]}>
                        {EMOJIS.map((emoji, idx) => (
                            <TouchableOpacity
                                key={emoji}
                                style={[styles.emojiOption, uiHoveredIndex === idx && styles.emojiOptionHovered]}
                                onMouseEnter={() => setUIHoveredIndex(idx)}
                                onMouseLeave={() => setUIHoveredIndex(-1)}
                                onPress={() => { sendReaction(emoji); setPickerVisible(false); }}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.emojiOptionText}>{emoji}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
        );
    }
    // 👆 --- END DESKTOP BRANCH --- 👆

    // 👇 --- MOBILE TOUCH UI BRANCH (PanResponder) --- 👇
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                if (extendOverlayTimer) extendOverlayTimer();
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
                    if (Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10) clearTimeout(timerRef.current);
                    return;
                }
                const { dx, dy } = gestureState;
                let index = -1;
                const EMOJI_SIZE = 44;
                if (isFullScreen || isDesktop) {
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
                    if (hoveredIndexRef.current !== -1) sendReaction(EMOJIS[hoveredIndexRef.current]);
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

    return (
        <View style={[{ pointerEvents: 'box-none', flexDirection: isFullScreen || isDesktop ? 'column-reverse' : 'row-reverse', alignItems: 'flex-end' }]}>
            <View {...panResponder.panHandlers} style={styles.reactionMainBtn}>
                <Ionicons name={showFloatingEmojis ? "happy-outline" : "eye-off-outline"} size={24} color={showFloatingEmojis ? "#FFFFFF" : "#E53935"} />
            </View>
            {pickerVisible && (
                <View style={[isFullScreen || isDesktop ? styles.emojiPickerMenuVertical : styles.emojiPickerMenuHorizontal, isFullScreen || isDesktop ? { marginBottom: 10 } : { marginRight: 10 }]}>
                    {EMOJIS.map((emoji, idx) => {
                        const isHovered = uiHoveredIndex === idx;
                        return (
                            <View key={emoji} style={[styles.emojiOption, isHovered && styles.emojiOptionHovered]}>
                                <Text style={styles.emojiOptionText}>{emoji}</Text>
                            </View>
                        );
                    })}
                </View>
            )}
        </View>
    );
};

const FloatingEmoji = ({ emoji, sender, onComplete }) => {
    const animValue = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(animValue, { toValue: 1, duration: 2500, useNativeDriver: true }).start(() => { if (onComplete) onComplete(); });
    }, [animValue, onComplete]);

    const translateY = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -150] });
    const opacity = animValue.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });

    return (
        <Animated.View style={[styles.floatingEmojiContainer, { opacity, transform: [{ translateY }] }]}>
            <Text style={styles.floatingEmojiSender} numberOfLines={1}>{sender}</Text>
            <Text style={styles.floatingEmoji}>{emoji}</Text>
        </Animated.View>
    );
};

const FloatingMessage = ({ msg, onComplete }) => {
    const animValue = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.timing(animValue, { toValue: 1, duration: 4000, useNativeDriver: true }).start(() => { if (onComplete) onComplete(); });
    }, [animValue, onComplete]);

    const translateY = animValue.interpolate({ inputRange: [0, 1], outputRange: [0, -100] });
    const opacity = animValue.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] });

    return (
        <Animated.View style={[styles.floatingMessageContainer, { opacity, transform: [{ translateY }] }]}>
            <Text style={styles.floatingMessageSender}>{msg.sender}:</Text>
            {msg.gifUrl ? (
                <Image source={{ uri: msg.gifUrl }} style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: '#2A2A30' }} />
            ) : (
                <Text style={styles.floatingMessageText}>{msg.text}</Text>
            )}
        </Animated.View>
    );
};

const CHAT_PANEL_RATIO = 0.3;

export default function TheatreScreen() {
    const { width, height } = useWindowDimensions();
    const isDesktop = width >= 1024;

    const logic = useTheatreLogic(width, height, isDesktop);
    const [desktopPlayerWidth, setDesktopPlayerWidth] = useState(0);
    const [isPlayerHovered, setIsPlayerHovered] = useState(false);

    useEffect(() => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            const styleId = 'hide-scrollbar-style';
            if (!document.getElementById(styleId)) {
                const style = document.createElement('style');
                style.id = styleId;
                style.innerHTML = `
                [data-hide-scrollbar] { scrollbar-width: none; -ms-overflow-style: none; }
                [data-hide-scrollbar]::-webkit-scrollbar { display: none; width: 0; height: 0; }
            `;
                document.head.appendChild(style);
            }
        }
    }, []);

    const renderSearchResult = ({ item }) => {
        const cardStyle = isDesktop ? styles.desktopResultCard : styles.resultCard;
        const imageStyle = isDesktop ? styles.desktopResultImage : styles.resultImage;
        const titleStyle = isDesktop ? styles.desktopResultTitle : styles.resultTitle;
        const playIconSize = isDesktop ? 40 : 32;

        const PlayOverlay = () => (
            <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]} pointerEvents="none">
                <Ionicons name="play-circle" size={playIconSize} color="rgba(255,255,255,0.85)" />
            </View>
        );

        if (logic.searchType === 'youtube') {
            return (
                <TouchableOpacity style={cardStyle} activeOpacity={0.8} onPress={() => logic.handleSelectVideo(item.id.videoId, item.snippet?.title)}>
                    <View style={{ position: 'relative' }}>
                        <Image source={{ uri: item.snippet?.thumbnails?.medium?.url }} style={imageStyle} />
                        <PlayOverlay />
                    </View>
                    <Text style={titleStyle} numberOfLines={2}>{item.snippet?.title}</Text>
                </TouchableOpacity>
            );
        } else {
            const title = item.title || item.name;
            const mediaType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
            const vidId = mediaType === 'tv' ? `VIDLINK:tv:${item.id}:1:1` : `VIDLINK:movie:${item.id}`;
            return (
                <TouchableOpacity style={cardStyle} activeOpacity={0.8} onPress={() => logic.handleSelectVideo(vidId, title)}>
                    <View style={{ position: 'relative' }}>
                        <Image source={{ uri: getImageUrl(item.backdrop_path || item.poster_path, 'w500') }} style={[imageStyle, { backgroundColor: '#25252A' }]} />
                        <PlayOverlay />
                    </View>
                    <Text style={titleStyle} numberOfLines={2}>{title}</Text>
                </TouchableOpacity>
            );
        }
    };

    const renderChatMessage = ({ item }) => {
        if (item.isReaction) {
            return (
                <View style={styles.reactionMessageWrapper}>
                    <Text style={styles.reactionMessageText}>
                        {item.sender === logic.username ? 'You' : item.sender} reacted with <Text style={{ fontSize: 16 }}>{item.text}</Text>
                    </Text>
                </View>
            );
        }

        const isMe = item.sender === logic.username;
        const hasGif = !!item.gifUrl;

        return (
            <View style={[styles.chatMsgWrapper, isMe ? styles.chatMsgRight : styles.chatMsgLeft]}>
                {!isMe && <Text style={styles.chatSenderName}>{item.sender}</Text>}
                {hasGif ? (
                    <View style={[styles.chatBubble, isMe ? styles.chatBubbleMe : styles.chatBubbleThem, { paddingHorizontal: 4, paddingVertical: 4, backgroundColor: 'transparent' }]}>
                        <Image source={{ uri: item.gifUrl }} style={{ width: 160, height: 160, borderRadius: 12, backgroundColor: '#2A2A30' }} resizeMode="cover" />
                    </View>
                ) : isMe ? (
                    <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.chatBubble, styles.chatBubbleMe]}>
                        <Text style={styles.chatText}>{item.text}</Text>
                    </LinearGradient>
                ) : (
                    <View style={[styles.chatBubble, styles.chatBubbleThem]}><Text style={styles.chatText}>{item.text}</Text></View>
                )}
            </View>
        );
    };

    // Shared calculations
    const actualWidth = Math.max(width, height);
    const actualHeight = Math.min(width, height);
    const containerWidth = logic.isFullScreen ? actualWidth : width;
    const containerHeight = logic.isFullScreen ? actualHeight : width * (9 / 16);
    const panelWidth = Math.round(actualWidth * CHAT_PANEL_RATIO);
    const chatTranslateX = logic.chatAnim.interpolate({ inputRange: [0, 1], outputRange: [panelWidth, 0] });
    const videoTranslateX = logic.chatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -panelWidth / 2] });
    const innerVideoWidth = Math.min(containerWidth, containerHeight * (16 / 9));
    const innerVideoHeight = innerVideoWidth * (9 / 16);

    let episodesArray = [];
    let tvSeasons = [];
    if (logic.tvDetails && logic.tvDetails.seasons) {
        tvSeasons = logic.tvDetails.seasons.filter(s => s.season_number > 0);
        const currentSeasonData = tvSeasons.find(s => s.season_number === logic.vidLinkSeason) || tvSeasons[0];
        const episodeCount = currentSeasonData?.episode_count || 1;
        episodesArray = Array.from({ length: episodeCount }, (_, i) => i + 1);
    }

    if (logic.isJoining) {
        return (
            <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar hidden={false} barStyle="light-content" backgroundColor="#000" />
                <ActivityIndicator size="large" color="#00E5FF" />
                <Text style={{ color: '#8F98A0', marginTop: 16, fontSize: 16, fontWeight: '500' }}>Connecting to Room...</Text>
            </SafeAreaView>
        );
    }

    if (logic.isWaitingForHost) {
        return (
            <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
                <StatusBar hidden={false} barStyle="light-content" backgroundColor="#000" />
                <ActivityIndicator size="large" color="#FF007A" />
                <Text style={{ color: '#FFF', marginTop: 16, fontSize: 18, fontWeight: 'bold' }}>Asking to enter...</Text>
                <Text style={{ color: '#8F98A0', marginTop: 8, fontSize: 14 }}>Waiting for the Host to let you in.</Text>
                <TouchableOpacity onPress={logic.handleBackPress} style={{ marginTop: 24, padding: 12 }}>
                    <Text style={{ color: '#00E5FF', fontWeight: 'bold' }}>Cancel</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const showOverlayUI = logic.ytId && logic.overlayVisible;

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Split Screen Widescreen Watch Party)
    // --------------------------------------------------------
    if (isDesktop) {
        const desktopVideoHeight = logic.isFullScreen ? height : height * 0.65;
        const desktopChatHeight = logic.isFullScreen ? height : height - 48;
        const desktopInnerWidth = desktopPlayerWidth > 0
            ? Math.min(desktopPlayerWidth, desktopVideoHeight * (16 / 9))
            : 0;
        const desktopInnerHeight = desktopInnerWidth * (9 / 16);

        return (
            <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
                <View style={[styles.desktopContainer, logic.isFullScreen && styles.desktopContainerFullScreen]}>

                    {/* LEFT COLUMN: Player & Host Controls */}
                    <View style={styles.desktopLeftColumn}>

                        {!logic.isFullScreen && (
                            <View style={styles.desktopHeaderRow}>
                                <TouchableOpacity onPress={logic.handleBackPress} style={styles.desktopBackBtn}>
                                    <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
                                    <Text style={styles.desktopBackText}>Leave</Text>
                                </TouchableOpacity>
                                <View style={styles.desktopHeaderRight}>
                                    <TouchableOpacity onPress={logic.openShareModal} style={[styles.externalBtn, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
                                        <Ionicons name="paper-plane" size={16} color="#00E5FF" />
                                        <Text style={[styles.externalBtnText, { color: '#00E5FF' }]}>Invite Friends</Text>
                                    </TouchableOpacity>
                                    <View style={[styles.externalBtn, { backgroundColor: 'rgba(155, 81, 224, 0.15)' }]}>
                                        <Ionicons name="key" size={16} color="#9B51E0" />
                                        <Text style={[styles.externalBtnText, { color: '#9B51E0', letterSpacing: 1 }]}>Room: {logic.roomId}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Video Player Area */}
                        <View
                            style={[styles.desktopPlayerContainer, { height: desktopVideoHeight }, logic.isFullScreen && styles.desktopPlayerContainerFullScreen]}
                            onLayout={(e) => setDesktopPlayerWidth(e.nativeEvent.layout.width)}
                            onMouseEnter={() => setIsPlayerHovered(true)}
                            onMouseLeave={() => {
                                setIsPlayerHovered(false);
                                if (!logic.isVidLink) logic.playerRef.current?.toggleControls?.();
                            }}
                        >
                            {logic.isVidLink ? (
                                <View style={{ width: '100%', height: '100%', backgroundColor: '#000', borderRadius: logic.isFullScreen ? 0 : 16, overflow: 'hidden' }}>
                                    <iframe
                                        ref={logic.webViewRef}
                                        src={logic.vidLinkType === 'tv' ? `https://vidlink.pro/tv/${logic.vidLinkId}/${logic.vidLinkSeason}/${logic.vidLinkEpisode}?autoplay=1` : `https://vidlink.pro/movie/${logic.vidLinkId}?autoplay=1`}
                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                        allow="autoplay; encrypted-media; fullscreen"
                                        allowFullScreen
                                        title="Player"
                                    />
                                </View>
                            ) : (
                                <View style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                                    <TheatrePlayer
                                        ref={logic.playerRef}
                                        ytId={logic.ytId}
                                        isPlaying={logic.isPlaying}
                                        isMuted={logic.isMuted}
                                        isHostBool={logic.isHostLocal}
                                        onPlayerStateChange={logic.onPlayerStateChange}
                                        width={desktopInnerWidth || '100%'}
                                        height={desktopInnerHeight || '100%'}
                                        isFullScreen={false}
                                        onExit={logic.handleBackPress}
                                        fadeAnim={logic.overlayAnim}
                                        onControlsToggle={(visible) => logic.setOverlayVisible(visible)}
                                    />
                                </View>
                            )}

                            {/* Floating emoji reactions — same behavior as native */}
                            {logic.showFloatingEmojis && (
                                <View style={styles.floatingAnimationZone} pointerEvents="none">
                                    {logic.activeReactions.map((reaction) => (
                                        <FloatingEmoji key={reaction.id} emoji={reaction.emoji} sender={reaction.sender} onComplete={() => logic.removeReaction(reaction.id)} />
                                    ))}
                                </View>
                            )}

                            {/* Floating YouTube-style chat messages over the video — same behavior as native */}
                            <View style={styles.floatingMessagesZoneDesktop} pointerEvents="none">
                                {logic.showFloatingMessages && logic.activeFloatingMessages.map(msg => (
                                    <FloatingMessage key={msg.id} msg={msg} onComplete={() => logic.removeFloatingMessage(msg.id)} />
                                ))}
                            </View>

                            {/* Exit-fullscreen affordance */}
                            {logic.isFullScreen && (
                                <TouchableOpacity
                                    style={[
                                        styles.fullscreenExitBtn,
                                        {
                                            opacity: isPlayerHovered ? 1 : 0,
                                            pointerEvents: isPlayerHovered ? 'auto' : 'none',
                                            transition: 'opacity 0.2s ease',
                                        },
                                    ]}
                                    onPress={logic.toggleFullScreen}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="close" size={26} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}

                            {/* Floating chat + emoji + fullscreen toggle buttons — always visible over video */}
                            <View style={{
                                position: 'absolute', bottom: 70, right: 20, zIndex: 100000,
                                flexDirection: 'column', alignItems: 'flex-end', gap: 10,
                                opacity: isPlayerHovered ? 1 : 0,
                                pointerEvents: isPlayerHovered ? 'auto' : 'none',
                                transition: 'opacity 0.2s ease',
                            }}>
                                <TouchableOpacity style={styles.reactionMainBtn} onPress={logic.toggleFullScreen} activeOpacity={0.8}>
                                    <Ionicons name={logic.isFullScreen ? "contract" : "expand"} size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                                <QuickChatButton
                                    showFloatingMessages={logic.showFloatingMessages}
                                    onTap={logic.handleChatButtonTap}
                                    onSend={logic.sendChatText}
                                    onInteract={() => { }}
                                    isFullScreen={logic.isFullScreen}
                                />
                                <ReactionButtonUI
                                    isFullScreen={false}
                                    isDesktop={true}
                                    showFloatingEmojis={logic.showFloatingEmojis}
                                    toggleDistractionFree={logic.toggleDistractionFree}
                                    sendReaction={logic.sendReaction}
                                />
                            </View>
                        </View>

                        {/* Under Player: Metadata and Host Panel — hidden while in theater/fullscreen mode */}
                        {!logic.isFullScreen && (
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingTop: 20 }}>
                                {logic.videoTitle !== '' && (
                                    <View style={styles.desktopMetadataBox}>
                                        <Ionicons name={logic.isVidLink ? "film" : "play"} size={20} color={logic.isVidLink ? "#FF007A" : "#00E5FF"} />
                                        <Text style={styles.desktopMetadataTitle} numberOfLines={1}>
                                            <Text style={{ color: '#8F98A0', fontWeight: 'normal' }}>Now Playing: </Text>
                                            {logic.videoTitle}
                                            {logic.isVidLink && logic.vidLinkType === 'tv' ? ` (Season ${logic.vidLinkSeason} Episode ${logic.vidLinkEpisode})` : ''}
                                        </Text>
                                    </View>
                                )}

                                {logic.isVidLink && logic.vidLinkType === 'tv' && tvSeasons.length > 0 && (
                                    <View style={styles.theatreTvBar}>
                                        <View style={styles.theatreTvHeader}>
                                            <Text style={styles.theatreTvTitle}>Select Episodes</Text>
                                            {!logic.isHostLocal && <Text style={styles.theatreTvHostOnly}>(Controlled by Host)</Text>}
                                        </View>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.theatreTvRow}>
                                            {tvSeasons.map((season) => (
                                                <TouchableOpacity key={`theatre-s-${season.season_number}`} style={[styles.tvChip, logic.vidLinkSeason === season.season_number && styles.tvChipActive]} onPress={() => logic.handleSeasonChange(season.season_number)}>
                                                    <Text style={[styles.tvChipText, logic.vidLinkSeason === season.season_number && styles.tvChipTextActive]}>S{season.season_number}</Text>
                                                </TouchableOpacity>
                                            ))}
                                            <View style={styles.tvChipDivider} />
                                            {episodesArray.map((ep) => (
                                                <TouchableOpacity key={`theatre-ep-${ep}`} style={[styles.tvChip, logic.vidLinkEpisode === ep && styles.tvChipActive]} onPress={() => logic.handleEpisodeChange(ep)}>
                                                    <Text style={[styles.tvChipText, logic.vidLinkEpisode === ep && styles.tvChipTextActive]}>Ep {ep}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                {logic.roomUsers.length > 0 && (
                                    <View style={styles.desktopViewersBar}>
                                        <Text style={styles.desktopViewersBarTitle}>In the room ({logic.roomUsers.length})</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.desktopViewersScroll}>
                                            <View style={styles.desktopViewerChip}>
                                                <View style={[styles.desktopViewerAvatar, { backgroundColor: '#FF007A' }]}>
                                                    <Text style={styles.desktopViewerAvatarText}>{logic.username.charAt(0).toUpperCase()}</Text>
                                                </View>
                                                <Text style={styles.desktopViewerChipText}>{logic.username} (You)</Text>
                                            </View>
                                            {logic.roomUsers.map((u, idx) => {
                                                if (u.username === logic.username) return null;
                                                return (
                                                    <TouchableOpacity key={idx} style={styles.desktopViewerChip} activeOpacity={0.7} onPress={() => logic.isHostLocal ? logic.setSelectedUserToMod(u) : null}>
                                                        <View style={styles.desktopViewerAvatar}>
                                                            <Text style={styles.desktopViewerAvatarText}>{u.username.charAt(0).toUpperCase()}</Text>
                                                        </View>
                                                        <Text style={styles.desktopViewerChipText}>{u.username}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                )}

                                {logic.isHostLocal && (
                                    <View style={styles.desktopHostPanel}>
                                        <Text style={styles.desktopHostPanelTitle}>Host Controls: Change Video</Text>
                                        <View style={styles.desktopSearchToggleRow}>
                                            <TouchableOpacity style={[styles.desktopSearchToggleBtn, logic.searchType === 'youtube' && styles.desktopSearchToggleBtnActiveYt]} onPress={() => { logic.setSearchType('youtube'); }}>
                                                <Ionicons name="logo-youtube" size={18} color={logic.searchType === 'youtube' ? "#FF007A" : "#8F98A0"} />
                                                <Text style={[styles.desktopSearchToggleText, logic.searchType === 'youtube' && { color: '#FF007A' }]}>YouTube</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.desktopSearchToggleBtn, logic.searchType === 'movie' && styles.desktopSearchToggleBtnActiveMovie]} onPress={() => { logic.setSearchType('movie'); }}>
                                                <Ionicons name="film" size={18} color={logic.searchType === 'movie' ? "#00E5FF" : "#8F98A0"} />
                                                <Text style={[styles.desktopSearchToggleText, logic.searchType === 'movie' && { color: '#00E5FF' }]}>Movies / Shows</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={styles.desktopSearchRow}>
                                            <View style={styles.desktopSearchInputWrapper}>
                                                <Ionicons name="search" size={18} color="#8F98A0" />
                                                <TextInput
                                                    style={styles.desktopSearchInput}
                                                    placeholder={logic.searchType === 'youtube' ? "Search YouTube..." : "Search TMDB Movies / Shows..."}
                                                    placeholderTextColor="#8F98A0"
                                                    value={logic.searchInput}
                                                    onChangeText={logic.setSearchInput}
                                                    onSubmitEditing={logic.handleSearch}
                                                    returnKeyType="search"
                                                    selectionColor={logic.searchType === 'youtube' ? "#FF007A" : "#00E5FF"}
                                                />
                                            </View>
                                            <TouchableOpacity style={styles.desktopPushBtnContainer} onPress={logic.handleSearch}>
                                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pushBtnGradient}>
                                                    {logic.isSearching ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="search" size={22} color="#FFF" />}
                                                </LinearGradient>
                                            </TouchableOpacity>
                                        </View>
                                        {logic.searchResults.length > 0 && (
                                            <View>
                                                <Text style={styles.desktopResultsHeader}>Select a video to play</Text>
                                                <FlatList
                                                    data={logic.searchResults}
                                                    horizontal
                                                    showsHorizontalScrollIndicator={false}
                                                    keyExtractor={(item, index) => item.id?.videoId || String(item.id) || String(index)}
                                                    renderItem={renderSearchResult}
                                                    contentContainerStyle={{ gap: 16, paddingVertical: 4 }}
                                                />
                                            </View>
                                        )}
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>

                    {/* RIGHT COLUMN: Permanent Chat Panel — reuses TheatreChatPanel (same as mobile fullscreen) */}
                    <View style={[styles.desktopRightColumn, logic.isFullScreen && { width: 400 }]}>
                        <TheatreChatPanel
                            messages={logic.messages}
                            username={logic.username}
                            onSend={logic.sendChatText}
                            onSendGif={logic.sendGif}
                            onClose={() => { }}
                            width={logic.isFullScreen ? 400 : 380}
                            height={desktopChatHeight}
                            isKeyboardVisible={false}
                        />
                    </View>
                </View>

                {/* MODALS */}
                <Modal visible={!!logic.selectedUserToMod} transparent={true} animationType="fade" onRequestClose={() => logic.setSelectedUserToMod(null)}>
                    <View style={styles.modalOverlayCenter}>
                        <View style={styles.permissionModal}>
                            <Ionicons name="warning" size={40} color="#E53935" style={{ alignSelf: 'center', marginBottom: 12 }} />
                            <Text style={styles.permissionTitle}>Manage User</Text>
                            <Text style={styles.permissionDesc}>What would you like to do with <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{logic.selectedUserToMod?.username}</Text>?</Text>
                            <View style={styles.permissionActions}>
                                <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => logic.setSelectedUserToMod(null)}><Text style={styles.permBtnText}>Cancel</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(229, 57, 53, 0.15)' }]} onPress={logic.handleKick}><Text style={[styles.permBtnText, { color: '#E53935' }]}>Kick from Room</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.permBtn, { backgroundColor: '#E53935' }]} onPress={logic.handleKickAndBlock}><Text style={[styles.permBtnText, { color: '#FFF' }]}>Kick & Block Permanently</Text></TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <Modal visible={logic.isShareModalVisible} transparent={true} animationType="slide" onRequestClose={() => logic.setIsShareModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={[styles.bottomSheet, { maxWidth: 600, alignSelf: 'center', width: '100%' }]}>
                            <View style={styles.sheetHeader}>
                                <Text style={styles.sheetTitle}>Invite CineBuddies</Text>
                                <TouchableOpacity onPress={() => logic.setIsShareModalVisible(false)}><Ionicons name="close-circle" size={28} color="#8F98A0" /></TouchableOpacity>
                            </View>
                            {logic.isFetchingFriends ? (
                                <ActivityIndicator size="large" color="#00E5FF" style={{ marginVertical: 40 }} />
                            ) : (
                                <View style={{ flex: 1 }}>
                                    <FlatList
                                        data={logic.friendsList}
                                        keyExtractor={item => item._id}
                                        numColumns={4}
                                        columnWrapperStyle={{ justifyContent: 'flex-start', marginBottom: 20 }}
                                        showsVerticalScrollIndicator={false}
                                        {...(Platform.OS === 'web' ? { dataSet: { hideScrollbar: 'true' } } : {})}
                                        contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
                                        ListEmptyComponent={<Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 20 }}>No CineBuddies found.</Text>}
                                        renderItem={({ item }) => {
                                            const isSelected = logic.selectedFriends.includes(item._id);
                                            return (
                                                <TouchableOpacity style={styles.gridFriendItem} onPress={() => logic.toggleFriendSelection(item._id)} activeOpacity={0.8}>
                                                    <View style={[styles.gridFriendAvatar, isSelected && styles.gridFriendAvatarSelected]}>
                                                        <Text style={styles.gridFriendAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                                                        {isSelected && <View style={styles.checkBadge}><Ionicons name="checkmark-circle" size={24} color="#00E5FF" /></View>}
                                                    </View>
                                                    <Text style={styles.gridFriendName} numberOfLines={1}>{item.name.split(' ')[0]}</Text>
                                                </TouchableOpacity>
                                            );
                                        }}
                                    />
                                    <TouchableOpacity style={[styles.bulkSendBtn, logic.selectedFriends.length === 0 && styles.bulkSendBtnDisabled]} disabled={logic.selectedFriends.length === 0} onPress={logic.sendBulkTheatreInvites}>
                                        <Text style={[styles.bulkSendBtnText, logic.selectedFriends.length === 0 && { color: '#8F98A0' }]}>Send {logic.selectedFriends.length > 0 ? `(${logic.selectedFriends.length})` : ''}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>

                <Modal visible={logic.pendingRequests.length > 0} transparent={true} animationType="fade">
                    <View style={styles.modalOverlayCenter}>
                        <View style={styles.permissionModal}>
                            <Ionicons name="shield-checkmark" size={40} color="#00E5FF" style={{ alignSelf: 'center', marginBottom: 12 }} />
                            <Text style={styles.permissionTitle}>Someone wants to join</Text>
                            <Text style={styles.permissionDesc}>
                                <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{logic.pendingRequests[0]?.joinerName}</Text> is asking to enter your room.
                            </Text>
                            <View style={styles.permissionActions}>
                                <TouchableOpacity style={[styles.permBtn, { backgroundColor: '#00E5FF' }]} onPress={() => logic.handleHostDecision('ALLOW', logic.pendingRequests[0])}><Text style={[styles.permBtnText, { color: '#000' }]}>Allow</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => logic.handleHostDecision('REJECT', logic.pendingRequests[0])}><Text style={styles.permBtnText}>Decline</Text></TouchableOpacity>
                                <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(229, 57, 53, 0.15)' }]} onPress={() => logic.handleHostDecision('BLOCK', logic.pendingRequests[0])}><Text style={[styles.permBtnText, { color: '#E53935' }]}>Block</Text></TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

            </SafeAreaView>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <SafeAreaView style={styles.safeArea} edges={logic.isFullScreen ? [] : ['top', 'left', 'right']}>
            <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
                <StatusBar hidden={logic.isFullScreen} showHideTransition="slide" barStyle="light-content" backgroundColor="#000" translucent={false} />

                <View
                    style={[
                        styles.playerContainer,
                        { width: containerWidth, height: containerHeight },
                        logic.isFullScreen && { position: 'absolute', top: 0, left: 0, zIndex: 9999, elevation: 9999, backgroundColor: '#000', overflow: 'hidden' }
                    ]}
                >
                    <Animated.View
                        style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
                            justifyContent: 'center', alignItems: 'center',
                            transform: logic.isFullScreen ? [{ translateX: videoTranslateX }] : []
                        }}
                        onStartShouldSetResponderCapture={() => {
                            logic.overlayTouchRef.current = false;
                            if (logic.ytId && !logic.isVidLink) {
                                setTimeout(() => {
                                    if (!logic.overlayTouchRef.current) logic.handleVideoTap();
                                }, 0);
                            }
                            return false;
                        }}
                    >
                        {logic.isVidLink ? (
                            <View style={{ width: innerVideoWidth, height: innerVideoHeight, backgroundColor: '#000', position: 'relative' }}>
                                {Platform.OS === 'web' ? (
                                    <iframe
                                        ref={logic.webViewRef}
                                        key={`vidlink-mobile-${logic.vidLinkId}-${logic.vidLinkSeason}-${logic.vidLinkEpisode}`}
                                        src={logic.vidLinkType === 'tv'
                                            ? `https://vidlink.pro/tv/${logic.vidLinkId}/${logic.vidLinkSeason}/${logic.vidLinkEpisode}?autoplay=1`
                                            : `https://vidlink.pro/movie/${logic.vidLinkId}?autoplay=1`}
                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                        allow="autoplay; encrypted-media; fullscreen"
                                        allowFullScreen
                                        title="Player"
                                    />
                                ) : (
                                    <WebView
                                        ref={logic.webViewRef}
                                        key={`vidlink-theatre-${logic.vidLinkId}-${logic.vidLinkSeason}-${logic.vidLinkEpisode}`}
                                        source={{
                                            uri: logic.vidLinkType === 'tv'
                                                ? `https://vidlink.pro/tv/${logic.vidLinkId}/${logic.vidLinkSeason}/${logic.vidLinkEpisode}?autoplay=1`
                                                : `https://vidlink.pro/movie/${logic.vidLinkId}?autoplay=1`,
                                            headers: {
                                                'Referer': 'https://vidlink.pro/',
                                                'User-Agent': DESKTOP_USER_AGENT,
                                            }
                                        }}
                                        userAgent={DESKTOP_USER_AGENT}
                                        style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
                                        javaScriptEnabled={true}
                                        domStorageEnabled={true}
                                        databaseEnabled={true}
                                        allowsFullscreenVideo={false}
                                        mediaPlaybackRequiresUserAction={false}
                                        allowsInlineMediaPlayback={true}
                                        setSupportMultipleWindows={false}
                                        sharedCookiesEnabled={true}
                                        thirdPartyCookiesEnabled={true}
                                        androidLayerType="hardware"
                                        injectedJavaScriptBeforeContentLoaded={adBlockScript}
                                        onMessage={(event) => {
                                            try {
                                                const data = JSON.parse(event.nativeEvent.data);
                                                if (data.type === 'USER_TOUCH') {
                                                    logic.wakeVidLinkOverlay();
                                                } else if (data.type === 'PLAYER_EVENT') {
                                                    logic.handleVidLinkPlayerEvent(data.data);
                                                }
                                            } catch (e) { }
                                        }}
                                        onShouldStartLoadWithRequest={(request) => {
                                            return request.url.includes('vidlink.pro') || request.url.includes('about:blank');
                                        }}
                                        injectedJavaScript={`
                                        (function() {
                                            var style = document.createElement('style');
                                            var css = 'iframe[src*="ads"], .ad-overlay { display: none !important; }';
                                            css += '.pjs-fullscreen, .pjs-icon-fullscreen, [aria-label="Fullscreen"], [title="Fullscreen"], .fullscreen-btn { display: none !important; }';
                                            style.innerHTML = css;
                                            document.head.appendChild(style);

                                            window.__isJoinee = ${!logic.isHostLocal};

                                            var lockCss = '.pjs-play, .pjs-pause, .pjs-icon-play, .pjs-icon-pause, .pjs-slider, .pjs-progress, .pjs-time, .pjs-rewind, .pjs-forward, .pjs-skip, .pjs-next, .pjs-previous, .pjs-servers, .pjs-playlist, .server-wrapper, .server-list, .servers, .list-server { pointer-events: none !important; opacity: 0.5 !important; } .pjs-video-wrapper, video { pointer-events: none !important; }';

                                            function applyLock() {
                                                if (document.getElementById('joinee-lock')) return;
                                                var lock = document.createElement('style');
                                                lock.id = 'joinee-lock';
                                                lock.innerHTML = lockCss;
                                                document.head.appendChild(lock);
                                            }
                                            function removeLock() {
                                                var lock = document.getElementById('joinee-lock');
                                                if (lock) lock.remove();
                                            }

                                            window.__promoteToHost = function() { window.__isJoinee = false; removeLock(); };
                                            window.__demoteToJoinee = function() { window.__isJoinee = true; applyLock(); };
                                            if (window.__isJoinee) applyLock();

                                            var sendMsg = window.__rn_send || (window.ReactNativeWebView ? window.ReactNativeWebView.postMessage.bind(window.ReactNativeWebView) : null);

                                            if (!window.__syncStarted) {
                                                window.__syncStarted = true;
                                                var lastState = { playing: false, time: 0 };
                                                setInterval(function() {
                                                    var v = document.querySelector('video');
                                                    if (!v) {
                                                        var iframes = document.querySelectorAll('iframe');
                                                        for (var i=0; i<iframes.length; i++) {
                                                            try { v = iframes[i].contentDocument.querySelector('video'); if (v) break; } catch(e) {}
                                                        }
                                                    }

                                                    if (window.__isJoinee) return;

                                                    if (v && sendMsg) {
                                                        var isPlaying = !v.paused && !v.ended && v.readyState > 2;
                                                        var time = v.currentTime;
                                                        if (isPlaying !== lastState.playing) {
                                                            lastState.playing = isPlaying;
                                                            sendMsg(JSON.stringify({ type: 'PLAYER_EVENT', data: { event: isPlaying ? 'play' : 'pause', currentTime: time } }));
                                                        }
                                                        if (Math.abs(time - lastState.time) > 1.5 && lastState.playing === isPlaying) {
                                                            sendMsg(JSON.stringify({ type: 'PLAYER_EVENT', data: { event: 'seeked', currentTime: time } }));
                                                        }
                                                        lastState.time = time;
                                                        sendMsg(JSON.stringify({ type: 'PLAYER_EVENT', data: { event: 'timeupdate', currentTime: time } }));
                                                    }
                                                }, 1000);
                                            }

                                            ['click', 'touchstart'].forEach(function(evt) {
                                                document.addEventListener(evt, function(e) {
                                                    if (e.isTrusted && sendMsg) {
                                                        sendMsg(JSON.stringify({ type: 'USER_TOUCH' }));
                                                    }
                                                }, { passive: true });
                                            });
                                            true;
                                        })();
                                    `}
                                    />
                                )}
                                {!logic.overlayVisible && (
                                    <TouchableOpacity style={styles.fsWakeHotspot} onPress={logic.wakeVidLinkOverlay} activeOpacity={1} />
                                )}
                            </View>
                        ) : (
                            <TheatrePlayer
                                ref={logic.playerRef}
                                ytId={logic.ytId}
                                isPlaying={logic.isPlaying}
                                isMuted={logic.isMuted}
                                isHostBool={logic.isHostLocal}
                                onPlayerStateChange={logic.onPlayerStateChange}
                                width={innerVideoWidth}
                                height={innerVideoHeight}
                                isFullScreen={logic.isFullScreen}
                                onExit={logic.handleBackPress}
                                fadeAnim={logic.overlayAnim}
                                onToggleOrientation={async () => {
                                    const current = await ScreenOrientation.getOrientationAsync();
                                    if (current === ScreenOrientation.Orientation.PORTRAIT_UP) {
                                        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
                                    } else {
                                        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
                                    }
                                }}
                                onControlsToggle={(visible) => {
                                    logic.setOverlayVisible(visible);
                                }}
                            />
                        )}
                    </Animated.View>

                    {showOverlayUI && (
                        <Animated.View
                            style={[StyleSheet.absoluteFill, { zIndex: 100000, elevation: 100, opacity: logic.overlayAnim }]}
                            pointerEvents="box-none"
                            renderToHardwareTextureAndroid={true}
                        >
                            {logic.isFullScreen && (
                                <>
                                    <TouchableOpacity style={[styles.fullscreenExitBtn, { zIndex: 100001, elevation: 101 }]} onPress={logic.toggleFullScreen} activeOpacity={0.7}>
                                        <Ionicons name="close" size={26} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </>
                            )}

                            {logic.roomUsers.length > 0 && (
                                <View style={[styles.liveViewerBadge, { zIndex: 100001, elevation: 101 }]} pointerEvents="none">
                                    <Ionicons name="eye" size={14} color="#FFF" />
                                    <Text style={styles.liveViewerText}>{logic.roomUsers.length}</Text>
                                </View>
                            )}

                            <View style={[styles.rightOverlayWrapper, { zIndex: 100001, elevation: 101 }]} pointerEvents="box-none">
                                <View style={styles.rightActionButtons} pointerEvents="box-none">
                                    {!logic.chatPanelRendered && (
                                        <QuickChatButton
                                            showFloatingMessages={logic.showFloatingMessages}
                                            onTap={logic.handleChatButtonTap}
                                            onDoubleTap={logic.isFullScreen ? logic.openChatPanel : undefined}
                                            onSend={logic.sendChatText}
                                            onInteract={logic.extendOverlay}
                                            isFullScreen={logic.isFullScreen}
                                        />
                                    )}

                                    {!logic.chatPanelRendered && (
                                        <ReactionButtonUI
                                            isFullScreen={logic.isFullScreen}
                                            showFloatingEmojis={logic.showFloatingEmojis}
                                            toggleDistractionFree={logic.toggleDistractionFree}
                                            sendReaction={logic.sendReaction}
                                            extendOverlayTimer={logic.extendOverlay}
                                        />
                                    )}
                                </View>
                            </View>
                        </Animated.View>
                    )}

                    {logic.chatPanelRendered && logic.isFullScreen && (
                        <Animated.View
                            style={{
                                position: 'absolute',
                                right: 0, top: 0, bottom: 0,
                                width: panelWidth,
                                zIndex: 100002,
                                elevation: 102,
                                transform: [{ translateX: chatTranslateX }]
                            }}
                            renderToHardwareTextureAndroid={true}
                        >
                            <TheatreChatPanel
                                messages={logic.messages}
                                username={logic.username}
                                onSend={logic.sendChatText}
                                onClose={logic.closeChatPanel}
                                width={panelWidth}
                                onSendGif={logic.sendGif}
                                height={containerHeight}
                                isKeyboardVisible={logic.isKeyboardVisible}
                            />
                        </Animated.View>
                    )}

                    <View style={styles.floatingMessagesZone} pointerEvents="none">
                        {logic.showFloatingMessages && !logic.chatPanelRendered && logic.activeFloatingMessages.map(msg => (
                            <FloatingMessage key={msg.id} msg={msg} onComplete={() => logic.removeFloatingMessage(msg.id)} />
                        ))}
                    </View>

                    {logic.showFloatingEmojis && !logic.chatPanelRendered && (
                        <View style={styles.floatingAnimationZone} pointerEvents="none">
                            {logic.activeReactions.map((reaction) => (
                                <FloatingEmoji key={reaction.id} emoji={reaction.emoji} sender={reaction.sender} onComplete={() => logic.removeReaction(reaction.id)} />
                            ))}
                        </View>
                    )}
                </View>

                <View style={{ display: logic.isFullScreen ? 'none' : 'flex', flex: 1 }}>
                    <>
                        {logic.videoTitle !== '' && (
                            <View style={styles.nowPlayingBar}>
                                <Ionicons name={logic.isVidLink ? "film" : "play"} size={14} color={logic.isVidLink ? "#FF007A" : "#00E5FF"} />
                                <Text style={styles.nowPlayingText} numberOfLines={1}>
                                    <Text style={{ color: '#8F98A0', fontWeight: 'bold' }}>Now Playing: </Text>
                                    {logic.videoTitle}
                                    {logic.isVidLink && logic.vidLinkType === 'tv' ? ` (S${logic.vidLinkSeason} E${logic.vidLinkEpisode})` : ''}
                                </Text>
                            </View>
                        )}

                        <View style={styles.externalControlBar}>
                            <View style={styles.externalLeftControls}>
                                <TouchableOpacity onPress={logic.handleBackPress} style={styles.externalBtn}>
                                    <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={logic.toggleFullScreen} style={styles.externalBtn}>
                                    <Ionicons name="expand" size={22} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>

                            <View style={{ flex: 1, minWidth: 16 }} />

                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.externalRightControls} bounces={false}>
                                <TouchableOpacity onPress={logic.openShareModal} style={[styles.externalBtn, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
                                    <Ionicons name="paper-plane" size={16} color="#00E5FF" />
                                    <Text style={[styles.externalBtnText, { color: '#00E5FF' }]}>Share</Text>
                                </TouchableOpacity>
                                <View style={[styles.externalBtn, { backgroundColor: 'rgba(155, 81, 224, 0.15)' }]}>
                                    <Ionicons name="key" size={16} color="#9B51E0" />
                                    <Text style={[styles.externalBtnText, { color: '#9B51E0', letterSpacing: 1 }]}>{logic.roomId}</Text>
                                </View>
                            </ScrollView>
                        </View>

                        {logic.isVidLink && logic.vidLinkType === 'tv' && tvSeasons.length > 0 && (
                            <View style={styles.theatreTvBar}>
                                <View style={styles.theatreTvHeader}>
                                    <Text style={styles.theatreTvTitle}>
                                        Season {logic.vidLinkSeason} • Episode {logic.vidLinkEpisode}
                                    </Text>
                                    {!logic.isHostLocal && (
                                        <Text style={styles.theatreTvHostOnly}>(Controlled by Host)</Text>
                                    )}
                                </View>

                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.theatreTvRow}>
                                    {tvSeasons.map((season) => (
                                        <TouchableOpacity
                                            key={`theatre-s-${season.season_number}`}
                                            style={[styles.tvChip, logic.vidLinkSeason === season.season_number && styles.tvChipActive]}
                                            onPress={() => logic.handleSeasonChange(season.season_number)}
                                        >
                                            <Text style={[styles.tvChipText, logic.vidLinkSeason === season.season_number && styles.tvChipTextActive]}>
                                                S{season.season_number}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}

                                    <View style={styles.tvChipDivider} />

                                    {episodesArray.map((ep) => (
                                        <TouchableOpacity
                                            key={`theatre-ep-${ep}`}
                                            style={[styles.tvChip, logic.vidLinkEpisode === ep && styles.tvChipActive]}
                                            onPress={() => logic.handleEpisodeChange(ep)}
                                        >
                                            <Text style={[styles.tvChipText, logic.vidLinkEpisode === ep && styles.tvChipTextActive]}>
                                                Ep {ep}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {logic.isHostLocal && logic.roomUsers.filter(u => u.username !== logic.username).length > 0 && (
                            <View style={styles.viewersBar}>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewersScroll} bounces={true}>
                                    {logic.roomUsers.map((u, idx) => {
                                        if (u.username === logic.username) return null;
                                        return (
                                            <TouchableOpacity key={idx} style={styles.viewerChip} activeOpacity={0.7} onPress={() => logic.setSelectedUserToMod(u)}>
                                                <Ionicons name="person" size={12} color="#00E5FF" />
                                                <Text style={styles.viewerChipText}>{u.username}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}
                    </>

                    <View style={styles.controlsContainer}>
                        {logic.isHostLocal && !logic.isKeyboardVisible && (
                            <View style={styles.tabContainer}>
                                <TouchableOpacity style={[styles.tabBtn, logic.activeTab === 'search' && styles.tabBtnActive]} onPress={() => logic.setActiveTab('search')}>
                                    <Ionicons name="search" size={18} color={logic.activeTab === 'search' ? '#FFF' : '#8F98A0'} />
                                    <Text style={[styles.tabText, logic.activeTab === 'search' && styles.tabTextActive]}>Search</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.tabBtn, logic.activeTab === 'chat' && styles.tabBtnActive]} onPress={() => logic.setActiveTab('chat')}>
                                    <Ionicons name="chatbubbles" size={18} color={logic.activeTab === 'chat' ? '#FFF' : '#8F98A0'} />
                                    <Text style={[styles.tabText, logic.activeTab === 'chat' && styles.tabTextActive]}>Chat</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {logic.isHostLocal && logic.activeTab === 'search' ? (
                            <ScrollView style={styles.hostPanel} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}>
                                <View style={styles.searchToggleRow}>
                                    <TouchableOpacity style={[styles.searchToggleBtn, logic.searchType === 'youtube' && styles.searchToggleBtnActiveYt]} onPress={() => { logic.setSearchType('youtube'); logic.setSearchResults([]); logic.setSearchInput(''); }}>
                                        <Ionicons name="logo-youtube" size={16} color={logic.searchType === 'youtube' ? "#FF007A" : "#8F98A0"} />
                                        <Text style={[styles.searchToggleText, logic.searchType === 'youtube' && { color: '#FF007A' }]}>YouTube</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.searchToggleBtn, logic.searchType === 'movie' && styles.searchToggleBtnActiveMovie]} onPress={() => { logic.setSearchType('movie'); logic.setSearchResults([]); logic.setSearchInput(''); }}>
                                        <Ionicons name="film" size={16} color={logic.searchType === 'movie' ? "#00E5FF" : "#8F98A0"} />
                                        <Text style={[styles.searchToggleText, logic.searchType === 'movie' && { color: '#00E5FF' }]}>Movies / Shows</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.searchRow}>
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder={logic.searchType === 'youtube' ? "Search YouTube..." : "Search TMDB Movies / Shows..."}
                                        placeholderTextColor="#8F98A0"
                                        value={logic.searchInput}
                                        onChangeText={logic.setSearchInput}
                                        onSubmitEditing={logic.handleSearch}
                                        returnKeyType="search"
                                        selectionColor={logic.searchType === 'youtube' ? "#FF007A" : "#00E5FF"}
                                    />
                                    <TouchableOpacity style={styles.pushBtnContainer} onPress={logic.handleSearch}>
                                        <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pushBtnGradient}>
                                            {logic.isSearching ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="search" size={24} color="#FFF" />}
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>

                                {logic.searchResults.length > 0 ? (
                                    <View style={styles.resultsContainer}>
                                        <Text style={styles.resultsHeader}>Select a video to play:</Text>
                                        <FlatList
                                            data={logic.searchResults}
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
                            </ScrollView>
                        ) : (
                            <View style={styles.chatPanel}>
                                {!logic.isHostLocal && !logic.isKeyboardVisible && (
                                    <View style={styles.viewerHeader}>
                                        <Ionicons name="lock-closed" size={16} color="#FF007A" />
                                        <Text style={styles.viewerHeaderText}>Viewer Mode: Sit back & enjoy</Text>
                                    </View>
                                )}
                                <FlatList
                                    ref={logic.chatListRef}
                                    data={logic.messages}
                                    keyExtractor={(item) => item.id}
                                    renderItem={renderChatMessage}
                                    contentContainerStyle={styles.chatListContent}
                                    showsVerticalScrollIndicator={false}
                                    onContentSizeChange={() => logic.chatListRef.current?.scrollToEnd({ animated: true })}
                                    onLayout={() => logic.chatListRef.current?.scrollToEnd({ animated: true })}
                                    ListEmptyComponent={<Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>}
                                />
                                <View style={styles.chatInputRow}>
                                    <TouchableOpacity onPress={() => logic.setIsGifPickerVisible(true)} style={styles.gifToggleBtn}>
                                        <View style={styles.gifIconWrapper}>
                                            <Text style={styles.gifIconText}>GIF</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TextInput
                                        style={styles.chatInput}
                                        placeholder="Type a message..."
                                        placeholderTextColor="#8F98A0"
                                        value={logic.chatInput}
                                        onChangeText={logic.setChatInput}
                                        onSubmitEditing={logic.handleSendMessage}
                                        returnKeyType="send"
                                        selectionColor="#9B51E0"
                                    />
                                    <TouchableOpacity style={[styles.sendBtnContainer, !logic.chatInput.trim() && { opacity: 0.5 }]} onPress={logic.handleSendMessage} disabled={!logic.chatInput.trim()}>
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

            <Modal visible={logic.isShareModalVisible} transparent={true} animationType="slide" onRequestClose={() => logic.setIsShareModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Invite CineBuddies</Text>
                            <TouchableOpacity onPress={() => logic.setIsShareModalVisible(false)}><Ionicons name="close-circle" size={28} color="#8F98A0" /></TouchableOpacity>
                        </View>
                        {logic.isFetchingFriends ? (
                            <ActivityIndicator size="large" color="#00E5FF" style={{ marginVertical: 40 }} />
                        ) : (
                            <View style={{ flex: 1 }}>
                                <FlatList
                                    data={logic.friendsList}
                                    keyExtractor={item => item._id}
                                    numColumns={4}
                                    columnWrapperStyle={{ justifyContent: 'flex-start', marginBottom: 20 }}
                                    showsVerticalScrollIndicator={false}
                                    contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
                                    ListEmptyComponent={<Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 20 }}>No CineBuddies found.</Text>}
                                    renderItem={({ item }) => {
                                        const isSelected = logic.selectedFriends.includes(item._id);
                                        return (
                                            <TouchableOpacity style={styles.gridFriendItem} onPress={() => logic.toggleFriendSelection(item._id)} activeOpacity={0.8}>
                                                <View style={[styles.gridFriendAvatar, isSelected && styles.gridFriendAvatarSelected]}>
                                                    <Text style={styles.gridFriendAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                                                    {isSelected && <View style={styles.checkBadge}><Ionicons name="checkmark-circle" size={24} color="#00E5FF" /></View>}
                                                </View>
                                                <Text style={styles.gridFriendName} numberOfLines={1}>{item.name.split(' ')[0]}</Text>
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                                <TouchableOpacity style={[styles.bulkSendBtn, logic.selectedFriends.length === 0 && styles.bulkSendBtnDisabled]} disabled={logic.selectedFriends.length === 0} onPress={logic.sendBulkTheatreInvites}>
                                    <Text style={[styles.bulkSendBtnText, logic.selectedFriends.length === 0 && { color: '#8F98A0' }]}>Send {logic.selectedFriends.length > 0 ? `(${logic.selectedFriends.length})` : ''}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal visible={logic.pendingRequests.length > 0} transparent={true} animationType="fade">
                <View style={styles.modalOverlayCenter}>
                    <View style={styles.permissionModal}>
                        <Ionicons name="shield-checkmark" size={40} color="#00E5FF" style={{ alignSelf: 'center', marginBottom: 12 }} />
                        <Text style={styles.permissionTitle}>Someone wants to join</Text>
                        <Text style={styles.permissionDesc}>
                            <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{logic.pendingRequests[0]?.joinerName}</Text> is asking to enter your room.
                        </Text>
                        <View style={styles.permissionActions}>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: '#00E5FF' }]} onPress={() => logic.handleHostDecision('ALLOW', logic.pendingRequests[0])}><Text style={[styles.permBtnText, { color: '#000' }]}>Allow</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => logic.handleHostDecision('REJECT', logic.pendingRequests[0])}><Text style={styles.permBtnText}>Decline</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(229, 57, 53, 0.15)' }]} onPress={() => logic.handleHostDecision('BLOCK', logic.pendingRequests[0])}><Text style={[styles.permBtnText, { color: '#E53935' }]}>Block</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!logic.selectedUserToMod} transparent={true} animationType="fade" onRequestClose={() => logic.setSelectedUserToMod(null)}>
                <View style={styles.modalOverlayCenter}>
                    <View style={styles.permissionModal}>
                        <Ionicons name="warning" size={40} color="#E53935" style={{ alignSelf: 'center', marginBottom: 12 }} />
                        <Text style={styles.permissionTitle}>Manage User</Text>
                        <Text style={styles.permissionDesc}>What would you like to do with <Text style={{ fontWeight: 'bold', color: '#FFF' }}>{logic.selectedUserToMod?.username}</Text>?</Text>
                        <View style={styles.permissionActions}>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={() => logic.setSelectedUserToMod(null)}><Text style={styles.permBtnText}>Cancel</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(229, 57, 53, 0.15)' }]} onPress={logic.handleKick}><Text style={[styles.permBtnText, { color: '#E53935' }]}>Kick from Room</Text></TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: '#E53935' }]} onPress={logic.handleKickAndBlock}><Text style={[styles.permBtnText, { color: '#FFF' }]}>Kick & Block Permanently</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* GIPHY PICKER MODAL */}
            <Modal visible={logic.isGifPickerVisible} transparent={true} animationType="slide" onRequestClose={() => logic.setIsGifPickerVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.bottomSheet, { height: '70%' }]}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Send a GIF</Text>
                            <TouchableOpacity onPress={() => logic.setIsGifPickerVisible(false)}>
                                <Ionicons name="close-circle" size={28} color="#8F98A0" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.gifSearchRow}>
                            <Ionicons name="search" size={20} color="#8F98A0" style={{ marginLeft: 12 }} />
                            <TextInput
                                style={styles.gifSearchInput}
                                placeholder="Search Giphy..."
                                placeholderTextColor="#8F98A0"
                                value={logic.gifSearchQuery}
                                onChangeText={(text) => {
                                    logic.setGifSearchQuery(text);
                                    if (text === '') logic.fetchGiphy('');
                                }}
                                onSubmitEditing={() => logic.fetchGiphy(logic.gifSearchQuery)}
                                returnKeyType="search"
                            />
                        </View>

                        {logic.isFetchingGifs ? (
                            <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 40 }} />
                        ) : (
                            <FlatList
                                data={logic.gifs}
                                keyExtractor={(item) => item.id}
                                numColumns={2}
                                columnWrapperStyle={{ gap: 10, marginBottom: 10 }}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                {...(Platform.OS === 'web' ? { dataSet: { hideScrollbar: 'true' } } : {})}
                                ListEmptyComponent={<Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 20 }}>No GIFs found.</Text>}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={{ flex: 1 }} onPress={() => logic.sendGif(item.images.fixed_height.url)}>
                                        <Image
                                            source={{ uri: item.images.fixed_height.url }}
                                            style={{ width: '100%', height: 120, borderRadius: 8, backgroundColor: '#2A2A30' }}
                                        />
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* NEW PIN REQUIRED MODAL */}
            <Modal visible={logic.isPinModalVisible} transparent={true} animationType="fade">
                <KeyboardAvoidingView style={styles.modalOverlayCenter} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View style={styles.permissionModal}>
                        <Ionicons name="lock-closed" size={40} color="#00E5FF" style={{ alignSelf: 'center', marginBottom: 12 }} />
                        <Text style={styles.permissionTitle}>Private Room</Text>
                        <Text style={styles.permissionDesc}>This theatre is protected. Please enter the PIN.</Text>

                        <TextInput
                            style={{ backgroundColor: '#0A0A0C', color: '#FFF', borderRadius: 10, height: 50, fontSize: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20, textAlign: 'center', letterSpacing: 4 }}
                            placeholder="****"
                            placeholderTextColor="#8F98A0"
                            keyboardType="numeric"
                            maxLength={4}
                            secureTextEntry
                            value={logic.roomPinInput}
                            onChangeText={logic.setRoomPinInput}
                        />

                        <View style={styles.permissionActions}>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: '#00E5FF' }]} onPress={logic.handlePinSubmit}>
                                <Text style={[styles.permBtnText, { color: '#000' }]}>Submit PIN</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.permBtn, { backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 8 }]} onPress={logic.handleBackPress}>
                                <Text style={styles.permBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#000' },
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    playerContainer: { position: 'relative', backgroundColor: '#000' },

    // --- DESKTOP STYLES ---
    desktopContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#0A0A0C', padding: 24, gap: 24 },
    desktopLeftColumn: { flex: 1, height: '100%' },
    desktopRightColumn: { width: 380, height: '100%', flexShrink: 0 },
    desktopHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    desktopHeaderRight: { flexDirection: 'row', gap: 12 },
    desktopBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', cursor: 'pointer' },
    desktopBackText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    desktopPlayerContainer: { width: '100%', backgroundColor: '#000', borderRadius: 16, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    desktopMetadataBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: '#17171C', borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    desktopMetadataTitle: { color: '#FFF', fontSize: 18, fontWeight: '600' },
    desktopHostPanel: { backgroundColor: '#14141A', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginTop: 20 },

    // --- MOBILE & SHARED STYLES ---
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
    externalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, cursor: 'pointer' },
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
        borderColor: 'rgba(255,255,255,0.1)',
        cursor: 'pointer'
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
    searchToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#17171C', paddingVertical: 10, borderRadius: 10, gap: 6, borderWidth: 1, borderColor: 'transparent', cursor: 'pointer' },
    searchToggleBtnActiveYt: { backgroundColor: 'rgba(255, 0, 122, 0.1)', borderColor: '#FF007A' },
    searchToggleBtnActiveMovie: { backgroundColor: 'rgba(0, 229, 255, 0.1)', borderColor: '#00E5FF' },
    searchToggleText: { color: '#8F98A0', fontSize: 13, fontWeight: '600' },

    searchRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
    searchInput: { flex: 1, backgroundColor: '#17171C', color: '#FFF', borderRadius: 10, paddingHorizontal: 16, height: 56, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },

    pushBtnContainer: { width: 56, height: 56, borderRadius: 10, overflow: 'hidden', cursor: 'pointer' },
    pushBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    resultsContainer: { flex: 1, marginTop: 6 },
    resultsHeader: { color: '#FFF', fontSize: 15, fontWeight: '600', marginBottom: 8 },
    resultCard: { width: 160, cursor: 'pointer' },
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

    sendBtnContainer: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', cursor: 'pointer' },
    sendBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    bottomSheet: { backgroundColor: '#17171C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: '60%' },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    sheetTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },

    gridFriendItem: { width: '25%', alignItems: 'center', cursor: 'pointer' },
    gridFriendAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#9B51E0', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent', position: 'relative' },
    gridFriendAvatarSelected: { borderColor: '#00E5FF' },
    gridFriendAvatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 20 },
    checkBadge: { position: 'absolute', bottom: -4, right: -4, backgroundColor: '#17171C', borderRadius: 12 },
    gridFriendName: { color: '#FFF', fontSize: 12, fontWeight: '500', marginTop: 8, textAlign: 'center', paddingHorizontal: 4 },

    bulkSendBtn: { backgroundColor: '#00E5FF', paddingVertical: 14, borderRadius: 16, alignItems: 'center', marginTop: 10, cursor: 'pointer' },
    bulkSendBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)', cursor: 'default' },
    bulkSendBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

    modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    permissionModal: { backgroundColor: '#1E1E24', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
    permissionTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
    permissionDesc: { color: '#8F98A0', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    permissionActions: { gap: 12 },
    permBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', cursor: 'pointer' },
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
        gap: 6,
        cursor: 'pointer'
    },
    viewerChipText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600'
    },
    gifToggleBtn: {
        marginRight: 6,
        justifyContent: 'center',
        alignItems: 'center',
        cursor: 'pointer'
    },
    gifIconWrapper: {
        borderWidth: 1.5,
        borderColor: '#8F98A0',
        borderRadius: 6,
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    gifIconText: {
        color: '#8F98A0',
        fontSize: 10,
        fontWeight: 'bold',
    },
    gifSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0A0A0C',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 16,
    },
    gifSearchInput: {
        flex: 1,
        height: 44,
        color: '#FFF',
        paddingHorizontal: 10,
        fontSize: 15,
        outlineStyle: 'none'
    },
    floatingMessagesZoneDesktop: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        width: 340,
        maxHeight: '60%',
        pointerEvents: 'none',
        justifyContent: 'flex-end',
        zIndex: 99998
    }, desktopContainerFullScreen: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 999999,
        elevation: 999,
        padding: 0,
        gap: 0,
        backgroundColor: '#000',
    },
    desktopPlayerContainerFullScreen: {
        borderRadius: 0,
        borderWidth: 0,
    },

    desktopViewersBar: { backgroundColor: '#14141A', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', paddingVertical: 16, paddingHorizontal: 20, marginBottom: 20 },
    desktopViewersBarTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
    desktopViewersScroll: { gap: 12, alignItems: 'center' },
    desktopViewerChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, gap: 8, cursor: 'pointer' },
    desktopViewerAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#9B51E0', justifyContent: 'center', alignItems: 'center' },
    desktopViewerAvatarText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    desktopViewerChipText: { color: '#E6E6EA', fontSize: 14, fontWeight: '600' },

    desktopHostPanelTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', marginBottom: 16 },
    desktopSearchToggleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    desktopSearchToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C1C22', paddingVertical: 14, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', cursor: 'pointer' },
    desktopSearchToggleBtnActiveYt: { backgroundColor: 'rgba(255, 0, 122, 0.12)', borderColor: '#FF007A' },
    desktopSearchToggleBtnActiveMovie: { backgroundColor: 'rgba(0, 229, 255, 0.12)', borderColor: '#00E5FF' },
    desktopSearchToggleText: { color: '#8F98A0', fontSize: 14, fontWeight: '700' },
    desktopSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    desktopSearchInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1C1C22', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, height: 52 },
    desktopSearchInput: { flex: 1, color: '#FFF', fontSize: 15, height: '100%', outlineStyle: 'none' },
    desktopPushBtnContainer: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden', cursor: 'pointer' },
    desktopResultsHeader: { color: '#D0D0D5', fontSize: 13, fontWeight: '600', marginBottom: 12 },
    desktopResultCard: { width: 200, cursor: 'pointer' },
    desktopResultImage: { width: '100%', height: 112, borderRadius: 10, backgroundColor: '#25252A' },
    desktopResultTitle: { color: '#E6E6EA', fontSize: 13, marginTop: 10, fontWeight: '600' },
});