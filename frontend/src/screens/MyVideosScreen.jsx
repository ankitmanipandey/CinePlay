import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuthStore } from '../store/useAuthStore';
import { registerUploadForegroundService, uploadFileInBackground, cancelActiveUpload } from '../services/uploadManager';

registerUploadForegroundService();

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.x.x:5000/api';

const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const VideoListItem = ({ item, onDeleteRequest, onPlayRequest }) => {
    const player = useVideoPlayer(item.url, (player) => {
        player.muted = true;
        player.pause();
    });

    return (
        <View style={styles.videoItem}>
            {/* Thumbnail */}
            <TouchableOpacity
                style={styles.listThumbnailContainer}
                activeOpacity={0.8}
                onPress={() => onPlayRequest(item)}
                renderToHardwareTextureAndroid={true}
            >
                <VideoView
                    player={player}
                    style={styles.listThumbnailVideo}
                    contentFit="cover"
                    nativeControls={false}
                />
                <View style={styles.playOverlay}>
                    <Ionicons name="play" size={24} color="#00E5FF" style={{ marginLeft: 3 }} />
                </View>
                <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{item.duration || "0:00"}</Text>
                </View>
            </TouchableOpacity>

            {/* Video Info */}
            <View style={styles.videoInfo}>
                <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
            </View>

            {/* Action Buttons Container */}
            <View style={styles.actionButtonsRow}>
                {/* Play Button */}
                <TouchableOpacity
                    style={styles.playButtonWrapper}
                    activeOpacity={0.8}
                    onPress={() => onPlayRequest(item)}
                >
                    <LinearGradient
                        colors={['#00E5FF', '#9B51E0', '#FF007A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.playButtonGradient}
                    >
                        <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 3 }} />
                    </LinearGradient>
                </TouchableOpacity>

                {/* Trash Button */}
                <TouchableOpacity
                    onPress={() => onDeleteRequest(item._id)}
                    style={styles.trashBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons name="trash" size={18} color="#E53935" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const MyVideosScreen = () => {
    const router = useRouter();
    const { user } = useAuthStore();

    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
    const [videoTitle, setVideoTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);

    const [activeUpload, setActiveUpload] = useState(null);
    const uploadTaskRef = useRef(null);
    const uploadDurationRef = useRef(0);

    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [videoToDelete, setVideoToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [myVideos, setMyVideos] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchMyVideos = useCallback(async () => {
        if (!user?._id) return;
        try {
            const res = await axios.get(`${BACKEND_URL}/media/my-videos/${user._id}`);
            setMyVideos(res.data);
        } catch (error) {
            console.log("Error fetching videos:", error);
            Toast.show({ type: 'hotstarError', text1: 'Failed to load your videos' });
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchMyVideos();
    }, [fetchMyVideos]);

    const handleBrowseFiles = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'video/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                setSelectedFile(file);
                if (!videoTitle) {
                    setVideoTitle(file.name.split('.')[0]);
                }
            }
        } catch (err) {
            console.log("Document picker error:", err);
        }
    };

    const ghostPlayer = useVideoPlayer(activeUpload?.uri, (player) => {
        player.loop = true;
        player.muted = true;
        player.play();
    });

    useEffect(() => {
        if (!ghostPlayer) return;
        const sub = ghostPlayer.addListener('statusChange', (status) => {
            if (status.status === 'readyToPlay' && ghostPlayer.duration) {
                uploadDurationRef.current = ghostPlayer.duration;
            }
        });
        if (ghostPlayer.duration) uploadDurationRef.current = ghostPlayer.duration;
        return () => sub.remove();
    }, [ghostPlayer]);

    const handleUpload = async () => {
        if (!selectedFile || !user) return;
        const fileToUpload = selectedFile;
        const titleToUpload = videoTitle;

        setIsUploadModalVisible(false);
        setVideoTitle('');
        setSelectedFile(null);
        setActiveUpload({ uri: fileToUpload.uri, title: titleToUpload, progress: 0 });

        try {
            const { publicUrl, key } = await uploadFileInBackground({
                localFileUri: fileToUpload.uri,
                filename: fileToUpload.name,
                mimeType: fileToUpload.mimeType || 'video/mp4',
                fileSize: fileToUpload.size,
                title: titleToUpload,
                onProgress: (progress) => {
                    setActiveUpload(prev => prev ? { ...prev, progress } : null);
                }
            });

            const durationSec = uploadDurationRef.current;
            const formattedDuration = formatDuration(durationSec);

            const saveRes = await axios.post(`${BACKEND_URL}/media/confirm-upload`, {
                title: titleToUpload,
                url: publicUrl,
                r2Key: key,
                userId: user._id,
                duration: formattedDuration
            });

            Toast.show({ type: 'hotstarInfo', text1: 'Video uploaded successfully!' });
            setMyVideos(prev => [saveRes.data, ...prev]);
        } catch (error) {
            if (error.message === 'CANCELLED') {
                Toast.show({ type: 'hotstarInfo', text1: 'Upload cancelled' });
            } else {
                console.error("Upload error:", error);
                Toast.show({ type: 'hotstarError', text1: 'Upload failed', text2: 'Please try again.' });
            }
        } finally {
            setActiveUpload(null);
            uploadDurationRef.current = 0;
        }
    };

    const cancelUpload = () => {
        cancelActiveUpload();
        Toast.show({ type: 'hotstarInfo', text1: 'Cancelling upload…' });
    }; 

    const requestDelete = (videoId) => {
        setVideoToDelete(videoId);
        setDeleteModalVisible(true);
    };

    const confirmDelete = async () => {
        if (!videoToDelete) return;
        setIsDeleting(true);
        try {
            await axios.delete(`${BACKEND_URL}/media/delete/${videoToDelete}`);
            setMyVideos(prev => prev.filter(vid => vid._id !== videoToDelete));
            Toast.show({ type: 'hotstarInfo', text1: 'Video deleted successfully' });
            setDeleteModalVisible(false);
        } catch (error) {
            Toast.show({ type: 'hotstarError', text1: 'Failed to delete video' });
        } finally {
            setIsDeleting(false);
            setVideoToDelete(null);
        }
    };

    const playVideoInTheatre = (video) => {
        const newRoomId = Math.floor(10000 + Math.random() * 90000).toString();
        router.push({
            pathname: '/theatre',
            params: {
                roomId: newRoomId,
                isHost: 'true',
                initialYtId: `CUSTOM:${video.url}`,
                initialTitle: video.title
            }
        });
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Videos</Text>
                    <View style={{ width: 24 }} />
                </View>

                {!isLoading && myVideos.length === 0 && !activeUpload ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="cloud-offline-outline" size={64} color="#2A2A30" />
                        <Text style={styles.emptyText}>No videos uploaded yet.</Text>
                        <Text style={styles.emptySubText}>Tap the + button to upload your first video.</Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        {activeUpload && (
                            <View style={styles.ghostCard}>
                                <View style={styles.thumbnailContainer}>
                                    <VideoView player={ghostPlayer} style={styles.thumbnailVideo} contentFit="cover" nativeControls={false} />
                                    <View style={[styles.thumbnailOverlay, { opacity: 1 - (activeUpload.progress / 100) }]} />
                                    <TouchableOpacity style={styles.cancelUploadBtn} onPress={cancelUpload}>
                                        <View style={styles.cancelUploadBg}>
                                            <Ionicons name="close" size={16} color="#FFF" />
                                        </View>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.ghostCardInfo}>
                                    <Text style={styles.ghostCardTitle} numberOfLines={2}>{activeUpload.title}</Text>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={styles.ghostCardSubtitle}>Uploading to Cloudflare...</Text>
                                        <Text style={{ color: '#00E5FF', fontSize: 13, fontWeight: 'bold' }}>{activeUpload.progress}%</Text>
                                    </View>
                                    <View style={styles.ghostCardProgressBarBg}>
                                        <View style={[styles.ghostCardProgressBarFill, { width: `${activeUpload.progress}%` }]} />
                                    </View>
                                </View>
                            </View>
                        )}

                        <FlatList
                            data={myVideos}
                            keyExtractor={(item, index) => item._id || index.toString()}
                            contentContainerStyle={styles.listContent}
                            renderItem={({ item }) => (
                                <VideoListItem
                                    item={item}
                                    onDeleteRequest={requestDelete}
                                    onPlayRequest={playVideoInTheatre}
                                />
                            )}
                        />
                    </View>
                )}

                <TouchableOpacity style={styles.fab} activeOpacity={0.8} onPress={() => setIsUploadModalVisible(true)}>
                    <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
                        <Ionicons name="add" size={32} color="#FFF" />
                    </LinearGradient>
                </TouchableOpacity>
            </SafeAreaView>

            {/* --- UPLOAD MODAL --- */}
            <Modal visible={isUploadModalVisible} transparent={true} animationType="fade" onRequestClose={() => setIsUploadModalVisible(false)}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <View style={styles.modalContainer}>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsUploadModalVisible(false)}>
                            <Ionicons name="close" size={24} color="#8F98A0" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Upload Video</Text>
                        <Text style={styles.inputLabel}>Video Title</Text>
                        <TextInput style={styles.input} placeholder="Enter a catchy title..." placeholderTextColor="#8F98A0" value={videoTitle} onChangeText={setVideoTitle} selectionColor="#00E5FF" />
                        <TouchableOpacity style={[styles.browseButton, selectedFile && { borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.15)' }]} activeOpacity={0.8} onPress={handleBrowseFiles}>
                            <Ionicons name={selectedFile ? "checkmark-circle" : "folder-open-outline"} size={20} color="#00E5FF" />
                            <Text style={styles.browseButtonText} numberOfLines={1}>{selectedFile ? selectedFile.name : "Browse Files"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.uploadBtnContainer, (!videoTitle || !selectedFile) && styles.btnDisabled]} activeOpacity={0.8} onPress={handleUpload} disabled={!videoTitle || !selectedFile}>
                            <LinearGradient colors={videoTitle && selectedFile ? ['#00E5FF', '#9B51E0', '#FF007A'] : ['#2A2A30', '#2A2A30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.uploadGradient}>
                                <Text style={[styles.uploadText, (!videoTitle || !selectedFile) && { color: '#8F98A0' }]}>Start Upload</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* --- CUSTOM DELETE MODAL --- */}
            <Modal visible={deleteModalVisible} transparent={true} animationType="fade" onRequestClose={() => !isDeleting && setDeleteModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.deleteModalContainer}>
                        <View style={styles.warningIconBg}>
                            <Ionicons name="trash" size={32} color="#E53935" />
                        </View>
                        <Text style={styles.deleteModalTitle}>Delete Video?</Text>
                        <Text style={styles.deleteModalSub}>This video will be permanently removed from your storage. This action cannot be undone.</Text>
                        <View style={styles.deleteModalBtnRow}>
                            <TouchableOpacity style={styles.deleteCancelBtn} activeOpacity={0.7} onPress={() => setDeleteModalVisible(false)} disabled={isDeleting}>
                                <Text style={styles.deleteCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteConfirmBtn} activeOpacity={0.8} onPress={confirmDelete} disabled={isDeleting}>
                                {isDeleting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.deleteConfirmBtnText}>Delete</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default MyVideosScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A0C' },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    backButton: { padding: 4 },
    headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
    emptySubText: { color: '#8F98A0', fontSize: 14, textAlign: 'center' },
    listContent: { padding: 20, paddingBottom: 100 },

    // --- IMPROVED VIDEO ITEM STYLES ---
    videoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#16161A', // Slightly lifted background
        padding: 16, // Increased padding
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4
    },
    listThumbnailContainer: {
        width: 100, // Slightly wider
        height: 64,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#0A0A0C',
        position: 'relative'
    },
    listThumbnailVideo: { width: '100%', height: '100%' },

    playOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    durationBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 4 },
    durationText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },

    videoInfo: {
        flex: 1,
        marginLeft: 16,
        marginRight: 12, // Prevents text from touching buttons
        justifyContent: 'center'
    },
    videoTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 22 // Better readability for multiline titles
    },

    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    playButtonWrapper: {
        width: 44, // Generous touch target
        height: 44,
        borderRadius: 22,
        elevation: 8,
        shadowColor: '#FF007A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        marginRight: 12
    },
    playButtonGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22
    },
    trashBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(229, 57, 53, 0.1)', // Subtle red background
        justifyContent: 'center',
        alignItems: 'center',
    },

    ghostCard: { flexDirection: 'row', backgroundColor: '#121216', marginHorizontal: 20, marginTop: 20, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
    thumbnailContainer: { width: 100, height: 70, borderRadius: 8, overflow: 'hidden', position: 'relative' },
    thumbnailVideo: { width: '100%', height: '100%' },
    thumbnailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
    cancelUploadBtn: { position: 'absolute', top: 4, right: 4 },
    cancelUploadBg: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 2 },
    ghostCardInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
    ghostCardTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
    ghostCardSubtitle: { color: '#8F98A0', fontSize: 12 },
    ghostCardProgressBarBg: { height: 4, backgroundColor: '#2A2A30', borderRadius: 2, overflow: 'hidden' },
    ghostCardProgressBarFill: { height: '100%', backgroundColor: '#00E5FF' },

    fab: { position: 'absolute', bottom: 30, right: 30, shadowColor: '#9B51E0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
    fabGradient: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContainer: { backgroundColor: '#1E1E24', borderRadius: 20, width: '100%', padding: 24, position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    modalCloseBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 4 },
    modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 24 },
    inputLabel: { color: '#8F98A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
    input: { backgroundColor: '#0A0A0C', color: '#FFFFFF', borderRadius: 10, height: 50, paddingHorizontal: 16, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20 },
    browseButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 229, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)', borderRadius: 10, height: 50, marginBottom: 24, gap: 8, paddingHorizontal: 12 },
    browseButtonText: { color: '#00E5FF', fontSize: 16, fontWeight: '600' },
    uploadBtnContainer: { borderRadius: 10, overflow: 'hidden' },
    btnDisabled: { opacity: 0.9 },
    uploadGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    uploadText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

    deleteModalContainer: { backgroundColor: '#1E1E24', borderRadius: 24, width: '85%', padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(229, 57, 53, 0.2)' },
    warningIconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(229, 57, 53, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    deleteModalTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
    deleteModalSub: { color: '#8F98A0', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    deleteModalBtnRow: { flexDirection: 'row', width: '100%', gap: 12 },
    deleteCancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    deleteCancelBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
    deleteConfirmBtn: { flex: 1, backgroundColor: '#E53935', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    deleteConfirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
});