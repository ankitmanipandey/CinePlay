import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    ScrollView,
    KeyboardAvoidingView,
    PanResponder,
    StyleSheet,
    useWindowDimensions,
    Image,
    Modal,
    ActivityIndicator,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BackHandler } from 'react-native';

export const QUICK_PHRASES = [
    'Dekha maine kaha tha!',
    'Bhai dar lag raha hai 😅',
    'Aage kya hoga?',
    'Maza aa gaya',
    'Bahut badhiya 👏',
    'Oh no!!!',
];

const LONG_PRESS_MS = 250;
const DOUBLE_TAP_MS = 260;
const COLS = 2;
const CELL_H = 36;
const PAD = 6;
const BTN = 44;

export const QuickChatButton = ({ showFloatingMessages, onTap, onDoubleTap, onSend, onInteract, isFullScreen }) => {
    const { width: winWidth, height: winHeight } = useWindowDimensions();
    const cellW = Math.min(150, Math.floor((Math.max(winWidth, winHeight) - 15 - BTN - 10 - 16) / COLS));
    const rows = Math.ceil(QUICK_PHRASES.length / COLS);

    const [pickerVisible, setPickerVisible] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState(-1);

    const latest = useRef({});
    latest.current = { onTap, onDoubleTap, onSend, onInteract, cellW, rows, isFullScreen, winWidth, winHeight };

    const timerRef = useRef(null);
    const openRef = useRef(false);
    const cancelledRef = useRef(false);
    const hoverRef = useRef(-1);
    const lastTapRef = useRef(0);
    const tapTimerRef = useRef(null);

    const pickerRef = useRef(null);
    const pickerRectRef = useRef(null);

    const measurePicker = () => {
        requestAnimationFrame(() => {
            pickerRef.current?.measureInWindow((x, y, width, height) => {
                pickerRectRef.current = { x, y, width, height };
            });
        });
    };

    useEffect(() => () => {
        clearTimeout(timerRef.current);
        clearTimeout(tapTimerRef.current);
    }, []);

    const setHover = (i) => {
        if (hoverRef.current !== i) {
            hoverRef.current = i;
            setHoveredIndex(i);
        }
    };

    const closePicker = () => {
        openRef.current = false;
        setPickerVisible(false);
        setHover(-1);
        pickerRectRef.current = null;
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,

            onPanResponderGrant: () => {
                openRef.current = false;
                cancelledRef.current = false;
                pickerRectRef.current = null;
                setHover(-1);
                latest.current.onInteract?.();

                if (!latest.current.isFullScreen) return;

                timerRef.current = setTimeout(() => {
                    openRef.current = true;
                    setPickerVisible(true);
                    latest.current.onInteract?.();
                    measurePicker();
                }, LONG_PRESS_MS);
            },

            onPanResponderMove: (_e, g) => {
                latest.current.onInteract?.();

                if (!openRef.current) {
                    if (Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10) {
                        clearTimeout(timerRef.current);
                        cancelledRef.current = true;
                    }
                    return;
                }

                const { cellW, rows, winWidth, winHeight } = latest.current;
                const pickerW = cellW * COLS + PAD * 2;
                const pickerH = CELL_H * rows + PAD * 2;

                let localX, localY;
                const rect = pickerRectRef.current;

                if (rect) {
                    localX = g.moveX - rect.x - PAD;
                    localY = g.moveY - rect.y - PAD;
                } else {
                    const screenW = Math.max(winWidth, winHeight);
                    const screenH = Math.min(winWidth, winHeight);
                    const pickerLeft = screenW - 69 - pickerW;
                    const pickerTop = screenH - 27 - pickerH;
                    localX = g.moveX - pickerLeft - PAD;
                    localY = g.moveY - pickerTop - PAD;
                }

                const SLACK = 35;
                if (localX < -SLACK || localX > pickerW + SLACK || localY < -SLACK || localY > pickerH + SLACK) {
                    setHover(-1);
                    return;
                }

                const col = Math.max(0, Math.min(COLS - 1, Math.floor(localX / cellW)));
                const row = Math.max(0, Math.min(rows - 1, Math.floor(localY / CELL_H)));
                const idx = row * COLS + col;

                setHover(idx < QUICK_PHRASES.length ? idx : -1);
            },

            onPanResponderRelease: () => {
                clearTimeout(timerRef.current);
                if (openRef.current) {
                    const idx = hoverRef.current;
                    if (idx !== -1) latest.current.onSend?.(QUICK_PHRASES[idx]);
                    closePicker();
                } else if (!cancelledRef.current) {
                    const { onTap: tap, onDoubleTap: doubleTap } = latest.current;
                    if (!doubleTap) {
                        tap?.();
                    } else {
                        const now = Date.now();
                        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
                            clearTimeout(tapTimerRef.current);
                            tapTimerRef.current = null;
                            lastTapRef.current = 0;
                            doubleTap();
                        } else {
                            lastTapRef.current = now;
                            tapTimerRef.current = setTimeout(() => {
                                tapTimerRef.current = null;
                                lastTapRef.current = 0;
                                latest.current.onTap?.();
                            }, DOUBLE_TAP_MS);
                        }
                    }
                }
                latest.current.onInteract?.();
            },

            onPanResponderTerminate: () => {
                clearTimeout(timerRef.current);
                closePicker();
            },
        })
    ).current;

    return (
        <View style={styles.qcRoot} pointerEvents="box-none">
            <View {...panResponder.panHandlers} style={styles.qcBtn}>
                <Ionicons
                    name={showFloatingMessages ? 'chatbubble' : 'chatbubble-outline'}
                    size={22}
                    color={showFloatingMessages ? '#FFFFFF' : '#E53935'}
                />
            </View>

            {pickerVisible && (
                <View
                    ref={pickerRef}
                    pointerEvents="none"
                    onLayout={measurePicker}
                    style={[styles.qcPicker, { width: cellW * COLS + PAD * 2 }]}
                >
                    {QUICK_PHRASES.map((phrase, i) => (
                        <View
                            key={phrase}
                            style={[styles.qcCell, { width: cellW }, i === hoveredIndex && styles.qcCellHovered]}
                        >
                            <Text
                                style={[styles.qcCellText, i === hoveredIndex && styles.qcCellTextHovered]}
                                numberOfLines={2}
                            >
                                {phrase}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

export const TheatreChatPanel = ({ messages, username, onSend, onSendGif, onClose, width, height, isKeyboardVisible }) => {
    const [text, setText] = useState('');
    const listRef = useRef(null);

    // Giphy States
    const [isGifPickerVisible, setIsGifPickerVisible] = useState(false);
    const [gifSearchQuery, setGifSearchQuery] = useState('');
    const [gifs, setGifs] = useState([]);
    const [isFetchingGifs, setIsFetchingGifs] = useState(false);

    const scrollToEnd = () => listRef.current?.scrollToEnd({ animated: true });

    const fetchGiphy = async (query = '') => {
        setIsFetchingGifs(true);
        const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
        const url = query.trim()
            ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
            : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=pg-13`;

        try {
            const response = await fetch(url);
            const data = await response.json();
            setGifs(data.data);
        } catch (error) {
            console.error('Failed to load GIFs', error);
        } finally {
            setIsFetchingGifs(false);
        }
    };

    useEffect(() => {
        if (isGifPickerVisible) {
            fetchGiphy();
        }
    }, [isGifPickerVisible]);

    useEffect(() => {
        if (!isGifPickerVisible) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            setIsGifPickerVisible(false);
            return true;
        });
        return () => sub.remove();
    }, [isGifPickerVisible]);

    const submit = () => {
        const t = text.trim();
        if (!t) return;
        onSend(t);
        setText('');
    };

    const handleSendGif = (gifUrl) => {
        setIsGifPickerVisible(false);
        setGifSearchQuery('');
        if (onSendGif) {
            onSendGif(gifUrl);
        }
    };

    const renderItem = ({ item }) => {
        const isMe = item.sender === username;
        const name = isMe ? 'You' : item.sender;
        const hasGif = !!item.gifUrl;

        if (item.isReaction) {
            return <Text style={styles.cpReaction}>{name} reacted {item.text}</Text>;
        }

        return (
            <View style={{ marginBottom: 6 }}>
                {!hasGif || item.text ? (
                    <Text style={styles.cpLine}>
                        <Text style={[styles.cpName, isMe && styles.cpNameMe]}>{name}  </Text>
                        {item.text}
                    </Text>
                ) : (
                    <Text style={styles.cpLine}>
                        <Text style={[styles.cpName, isMe && styles.cpNameMe]}>{name}  </Text>
                    </Text>
                )}
                {hasGif && (
                    <Image
                        source={{ uri: item.gifUrl }}
                        style={{ width: 140, height: 140, borderRadius: 8, marginTop: 4, backgroundColor: '#2A2A30' }}
                        resizeMode="cover"
                    />
                )}
            </View>
        );
    };

    return (
        <KeyboardAvoidingView behavior="padding" style={[styles.cpPanel, { width, height }]}>
            <View style={styles.cpHeader}>
                <View style={styles.cpHeaderLeft}>
                    <Ionicons name="chatbubbles" size={15} color="#00E5FF" />
                    <Text style={styles.cpTitle}>Chat</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={20} color="#8F98A0" />
                </TouchableOpacity>
            </View>

            <FlatList
                ref={listRef}
                style={{ flex: 1 }}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.cpListContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={scrollToEnd}
                onLayout={scrollToEnd}
                ListEmptyComponent={<Text style={styles.cpEmpty}>No messages yet.</Text>}
            />

            {!isKeyboardVisible && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={{ flexGrow: 0 }}
                    contentContainerStyle={styles.cpChips}
                >
                    {QUICK_PHRASES.map((p) => (
                        <TouchableOpacity key={p} style={styles.cpChip} activeOpacity={0.7} onPress={() => onSend(p)}>
                            <Text style={styles.cpChipText}>{p}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            <View style={styles.cpInputRow}>
                <TouchableOpacity onPress={() => setIsGifPickerVisible(true)} style={styles.gifToggleBtn}>
                    <View style={styles.gifIconWrapper}>
                        <Text style={styles.gifIconText}>GIF</Text>
                    </View>
                </TouchableOpacity>

                <TextInput
                    style={styles.cpInput}
                    placeholder="Say something..."
                    placeholderTextColor="#8F98A0"
                    value={text}
                    onChangeText={setText}
                    onSubmitEditing={submit}
                    returnKeyType="send"
                    blurOnSubmit={false}
                    disableFullscreenUI
                    selectionColor="#9B51E0"
                />
                <TouchableOpacity
                    style={[styles.cpSend, !text.trim() && { opacity: 0.5 }]}
                    onPress={submit}
                    disabled={!text.trim()}
                >
                    <LinearGradient
                        colors={['#00E5FF', '#9B51E0', '#FF007A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.cpSendGradient}
                    >
                        <Ionicons name="send" size={15} color="#FFF" style={{ marginLeft: 2 }} />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            {/* GIF PICKER: overlay limited to this panel (right half) */}
            {isGifPickerVisible && (
                <View style={styles.gifOverlay}>
                    <View style={styles.gifSheet}>
                        <View style={styles.gifSheetHeader}>
                            <Text style={styles.gifSheetTitle}>Send a GIF</Text>
                            <TouchableOpacity onPress={() => setIsGifPickerVisible(false)}>
                                <Ionicons name="close-circle" size={24} color="#8F98A0" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.gifSearchRow}>
                            <Ionicons name="search" size={18} color="#8F98A0" style={{ marginLeft: 10 }} />
                            <TextInput
                                style={styles.gifSearchInput}
                                placeholder="Search Giphy..."
                                placeholderTextColor="#8F98A0"
                                value={gifSearchQuery}
                                onChangeText={(val) => {
                                    setGifSearchQuery(val);
                                    if (val === '') fetchGiphy('');
                                }}
                                onSubmitEditing={() => fetchGiphy(gifSearchQuery)}
                                returnKeyType="search"
                            />
                        </View>

                        {isFetchingGifs ? (
                            <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 30 }} />
                        ) : (
                            <FlatList
                                data={gifs}
                                keyExtractor={(item) => item.id}
                                numColumns={2}
                                columnWrapperStyle={{ gap: 8, marginBottom: 8 }}
                                contentContainerStyle={{ paddingBottom: 12 }}
                                keyboardShouldPersistTaps="handled"
                                {...(Platform.OS === 'web' ? { dataSet: { hideScrollbar: 'true' } } : {})}
                                ListEmptyComponent={<Text style={{ color: '#8F98A0', textAlign: 'center', marginTop: 20 }}>No GIFs found.</Text>}
                                renderItem={({ item }) => (
                                    <TouchableOpacity style={{ flex: 1 }} onPress={() => handleSendGif(item.images.fixed_height.url)}>
                                        <Image
                                            source={{ uri: item.images.fixed_height.url }}
                                            style={{ width: '100%', height: 90, borderRadius: 8, backgroundColor: '#2A2A30' }}
                                        />
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            )}
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    qcRoot: { marginBottom: 12, alignItems: 'flex-end' },
    qcBtn: {
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 20,
        width: BTN,
        height: BTN,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qcPicker: {
        position: 'absolute',
        right: BTN + 10,
        bottom: 0,
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: PAD,
        backgroundColor: 'rgba(0,0,0,0.88)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    qcCell: {
        height: CELL_H,
        paddingHorizontal: 8,
        justifyContent: 'center',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    qcCellHovered: {
        backgroundColor: 'rgba(0,229,255,0.2)',
        borderColor: '#00E5FF',
        transform: [{ scale: 1.05 }],
    },
    qcCellText: { color: '#D0D0D5', fontSize: 12, fontWeight: '600', lineHeight: 15 },
    qcCellTextHovered: { color: '#FFFFFF' },

    cpPanel: {
        backgroundColor: '#14141A',
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(255,255,255,0.08)',
    },
    cpHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    cpHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    cpTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
    cpListContent: { paddingHorizontal: 12, paddingVertical: 8 },
    cpLine: { color: '#E6E6EA', fontSize: 12.5, lineHeight: 18 },
    cpName: { color: '#9B51E0', fontWeight: 'bold' },
    cpNameMe: { color: '#00E5FF' },
    cpReaction: { color: '#8F98A0', fontSize: 11, marginBottom: 4 },
    cpEmpty: { color: '#8F98A0', fontSize: 12, textAlign: 'center', marginTop: 16 },
    cpChips: { paddingHorizontal: 10, paddingVertical: 6, gap: 6 },
    cpChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cpChipText: { color: '#D0D0D5', fontSize: 11.5, fontWeight: '600' },
    cpInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: '#17171C',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    cpInput: {
        flex: 1,
        height: 34,
        paddingVertical: 0,
        paddingHorizontal: 12,
        borderRadius: 17,
        backgroundColor: '#0A0A0C',
        color: '#FFFFFF',
        fontSize: 13,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cpSend: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden' },
    cpSendGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // GIF Button & Modal Styles
    gifToggleBtn: {
        justifyContent: 'center',
        alignItems: 'center',
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
    },
    gifOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        zIndex: 10,
    },
    gifSheet: {
        height: '88%',
        backgroundColor: '#17171C',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 12,
    },
    gifSheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    gifSheetTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
});