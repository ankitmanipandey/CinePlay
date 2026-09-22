import React from 'react';
import {
    StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
    KeyboardAvoidingView, Platform, ActivityIndicator, useWindowDimensions, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';

import { useMyVideosLogic, formatBytes } from '../hooks/useMyVideosLogic';

// Reusable item component to isolate the useVideoPlayer hook per item
const VideoCard = ({ item, onDeleteRequest, onPlayRequest, isDesktop }) => {
    const player = useVideoPlayer(item.url, (player) => {
        player.muted = true;
        player.pause();
    });

    const cardStyle = isDesktop ? styles.videoItemDesktop : styles.videoItemMobile;
    const thumbContainerStyle = isDesktop ? styles.thumbContainerDesktop : styles.thumbContainerMobile;
    const infoStyle = isDesktop ? styles.videoInfoDesktop : styles.videoInfoMobile;

    return (
        <View style={cardStyle}>
            <TouchableOpacity style={thumbContainerStyle} activeOpacity={0.8} onPress={() => onPlayRequest(item)}>
                <VideoView player={player} style={styles.thumbnailVideo} contentFit="cover" nativeControls={false} />
                <View style={styles.playOverlay}>
                    <Ionicons name="play" size={isDesktop ? 36 : 24} color="#00E5FF" style={{ marginLeft: 3 }} />
                </View>
                <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{item.duration || "0:00"}</Text>
                </View>
            </TouchableOpacity>

            <View style={infoStyle}>
                <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
            </View>

            <View style={styles.actionButtonsRow}>
                <TouchableOpacity style={styles.playButtonWrapper} activeOpacity={0.8} onPress={() => onPlayRequest(item)}>
                    <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.playButtonGradient}>
                        <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 3 }} />
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => onDeleteRequest(item._id)} style={styles.trashBtn} activeOpacity={0.7}>
                    <Ionicons name="trash" size={18} color="#E53935" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default function MyVideosScreenWeb() {
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1024;

    const {
        router, myVideos, storageUsed, isLoading, storagePercent, progressColor,
        isUploadModalVisible, setIsUploadModalVisible, videoTitle, setVideoTitle, selectedFile,
        deleteModalVisible, setDeleteModalVisible, isDeleting,
        handleBrowseFiles, handleUpload, cancelUpload, requestDelete, confirmDelete, playVideoInTheatre,
        activeUpload, ghostPlayer
    } = useMyVideosLogic();

    const renderStorageBar = () => (
        <View style={isDesktop ? styles.storageCardDesktop : styles.storageCardMobile}>
            <View style={styles.storageHeaderRow}>
                <View style={styles.storageLabelWrap}>
                    <Ionicons name="cloud-done" size={16} color="#8F98A0" />
                    <Text style={styles.storageLabel}>Cloud Storage</Text>
                </View>
                <Text style={styles.storageText}>{formatBytes(storageUsed)} <Text style={{ color: '#8F98A0' }}>/ 10 GB</Text></Text>
            </View>
            <View style={styles.storageBarContainer}>
                <View style={[styles.storageBarFill, { width: `${storagePercent}%`, backgroundColor: progressColor }]} />
            </View>
        </View>
    );

    const renderUploadModals = () => (
        <>
            {/* UPLOAD MODAL */}
            {isUploadModalVisible && (
                <View style={styles.modalOverlay}>
                    <View style={isDesktop ? styles.modalContainerDesktop : styles.modalContainerMobile}>
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
                </View>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteModalVisible && (
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
            )}
        </>
    );

    const renderActiveUploadGhost = () => {
        if (!activeUpload) return null;
        return (
            <View style={isDesktop ? styles.ghostCardDesktop : styles.ghostCardMobile}>
                <View style={styles.ghostThumbnailContainer}>
                    <VideoView player={ghostPlayer} style={styles.thumbnailVideo} contentFit="cover" nativeControls={false} />
                    <View style={[styles.thumbnailOverlay, { opacity: 1 - (activeUpload.progress / 100) }]} />
                    <TouchableOpacity style={styles.cancelUploadBtn} onPress={cancelUpload}>
                        <View style={styles.cancelUploadBg}><Ionicons name="close" size={16} color="#FFF" /></View>
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
        );
    };

    // --------------------------------------------------------
    // DESKTOP LAYOUT (Grid Widescreen)
    // --------------------------------------------------------
    if (isDesktop) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.desktopWrapper}>
                    <View style={styles.headerDesktop}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButtonDesktop}>
                                <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={styles.headerTitleDesktop}>My Videos</Text>
                        </View>

                        <View style={styles.headerRightDesktop}>
                            {renderStorageBar()}
                            <TouchableOpacity style={styles.uploadHeaderBtnDesktop} onPress={() => setIsUploadModalVisible(true)}>
                                <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.uploadHeaderGradientDesktop}>
                                    <Ionicons name="add" size={20} color="#FFF" />
                                    <Text style={styles.uploadHeaderTextDesktop}>Upload</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {renderActiveUploadGhost()}

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#00E5FF" style={{ marginTop: 100 }} />
                    ) : myVideos.length === 0 && !activeUpload ? (
                        <View style={styles.emptyContainerDesktop}>
                            <Ionicons name="cloud-offline-outline" size={64} color="#2A2A30" />
                            <Text style={styles.emptyText}>No videos uploaded yet.</Text>
                            <Text style={styles.emptySubText}>Click the Upload button to add your first video.</Text>
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={styles.desktopGrid}>
                            {myVideos.map(item => (
                                <VideoCard key={item._id} item={item} onDeleteRequest={requestDelete} onPlayRequest={playVideoInTheatre} isDesktop={true} />
                            ))}
                        </ScrollView>
                    )}
                </View>
                {renderUploadModals()}
            </SafeAreaView>
        );
    }

    // --------------------------------------------------------
    // MOBILE & TABLET LAYOUT (Exact Native Clone)
    // --------------------------------------------------------
    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.headerMobile}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButtonMobile}>
                        <Ionicons name="chevron-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitleMobile}>My Videos</Text>
                    <View style={{ width: 24 }} />
                </View>

                {renderStorageBar()}

                {!isLoading && myVideos.length === 0 && !activeUpload ? (
                    <View style={styles.emptyContainerMobile}>
                        <Ionicons name="cloud-offline-outline" size={64} color="#2A2A30" />
                        <Text style={styles.emptyText}>No videos uploaded yet.</Text>
                        <Text style={styles.emptySubText}>Tap the + button to upload your first video.</Text>
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        {renderActiveUploadGhost()}
                        <FlatList
                            data={myVideos}
                            keyExtractor={(item, index) => item._id || index.toString()}
                            contentContainerStyle={styles.listContentMobile}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item }) => (
                                <VideoCard item={item} onDeleteRequest={requestDelete} onPlayRequest={playVideoInTheatre} isDesktop={false} />
                            )}
                        />
                    </View>
                )}

                <TouchableOpacity style={styles.fabMobile} activeOpacity={0.8} onPress={() => setIsUploadModalVisible(true)}>
                    <LinearGradient colors={['#00E5FF', '#9B51E0', '#FF007A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradientMobile}>
                        <Ionicons name="add" size={32} color="#FFF" />
                    </LinearGradient>
                </TouchableOpacity>
            </SafeAreaView>
            {renderUploadModals()}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0A0C' },

    // --- DESKTOP STYLES (>= 1024px) ---
    desktopWrapper: { flex: 1, width: '100%', maxWidth: 1200, alignSelf: 'center', padding: 32 },
    headerDesktop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 },
    backButtonDesktop: { marginRight: 24, cursor: 'pointer' },
    headerTitleDesktop: { color: '#FFFFFF', fontSize: 32, fontWeight: 'bold' },
    headerRightDesktop: { flexDirection: 'row', alignItems: 'center', gap: 24 },

    storageCardDesktop: { width: 300, backgroundColor: '#16161A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    uploadHeaderBtnDesktop: { borderRadius: 12, overflow: 'hidden', cursor: 'pointer' },
    uploadHeaderGradientDesktop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
    uploadHeaderTextDesktop: { color: '#FFF', fontWeight: 'bold', fontSize: 16 },

    desktopGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, paddingBottom: 60 },
    videoItemDesktop: { width: 320, backgroundColor: '#16161A', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    thumbContainerDesktop: { width: '100%', height: 180, backgroundColor: '#0A0A0C', position: 'relative', cursor: 'pointer' },
    videoInfoDesktop: { padding: 16, paddingBottom: 0 },

    ghostCardDesktop: { flexDirection: 'row', backgroundColor: '#121216', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)', marginBottom: 32 },
    emptyContainerDesktop: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 },
    modalContainerDesktop: { backgroundColor: '#1E1E24', borderRadius: 20, width: 500, padding: 32, position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

    // --- MOBILE & TABLET STYLES (< 1024px) ---
    safeArea: { flex: 1 },
    headerMobile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    backButtonMobile: { padding: 4, cursor: 'pointer' },
    headerTitleMobile: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },

    storageCardMobile: { marginHorizontal: 20, marginTop: 16, backgroundColor: '#16161A', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    listContentMobile: { padding: 20, paddingBottom: 100 },

    videoItemMobile: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#16161A', padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    thumbContainerMobile: { width: 100, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: '#0A0A0C', position: 'relative', cursor: 'pointer' },
    videoInfoMobile: { flex: 1, marginLeft: 16, marginRight: 12, justifyContent: 'center' },

    ghostCardMobile: { flexDirection: 'row', backgroundColor: '#121216', marginHorizontal: 20, marginTop: 20, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)' },
    emptyContainerMobile: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    modalContainerMobile: { backgroundColor: '#1E1E24', borderRadius: 20, width: '100%', padding: 24, position: 'relative', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

    fabMobile: { position: 'absolute', bottom: 30, right: 30, shadowColor: '#9B51E0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8, cursor: 'pointer' },
    fabGradientMobile: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },

    // --- SHARED STYLES ---
    storageHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    storageLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    storageLabel: { color: '#8F98A0', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    storageText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
    storageBarContainer: { height: 6, backgroundColor: '#2A2A30', borderRadius: 3, overflow: 'hidden' },
    storageBarFill: { height: '100%', borderRadius: 3 },

    thumbnailVideo: { width: '100%', height: '100%' },
    playOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
    durationBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 4 },
    durationText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },

    videoTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', lineHeight: 22 },
    actionButtonsRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    playButtonWrapper: { width: 44, height: 44, borderRadius: 22, elevation: 8, shadowColor: '#FF007A', shadowOpacity: 0.4, shadowRadius: 8, marginRight: 12, cursor: 'pointer' },
    playButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
    trashBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(229, 57, 53, 0.1)', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' },

    ghostThumbnailContainer: { width: 100, height: 70, borderRadius: 8, overflow: 'hidden', position: 'relative' },
    thumbnailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
    cancelUploadBtn: { position: 'absolute', top: 4, right: 4, cursor: 'pointer' },
    cancelUploadBg: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 2 },
    ghostCardInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
    ghostCardTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
    ghostCardSubtitle: { color: '#8F98A0', fontSize: 12 },
    ghostCardProgressBarBg: { height: 4, backgroundColor: '#2A2A30', borderRadius: 2, overflow: 'hidden' },
    ghostCardProgressBarFill: { height: '100%', backgroundColor: '#00E5FF' },

    emptyText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
    emptySubText: { color: '#8F98A0', fontSize: 14, textAlign: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCloseBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 4, cursor: 'pointer' },
    modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 24 },
    inputLabel: { color: '#8F98A0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
    input: { backgroundColor: '#0A0A0C', color: '#FFFFFF', borderRadius: 10, height: 50, paddingHorizontal: 16, fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20, outlineStyle: 'none' },
    browseButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 229, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(0, 229, 255, 0.3)', borderRadius: 10, height: 50, marginBottom: 24, gap: 8, paddingHorizontal: 12, cursor: 'pointer' },
    browseButtonText: { color: '#00E5FF', fontSize: 16, fontWeight: '600' },
    uploadBtnContainer: { borderRadius: 10, overflow: 'hidden', cursor: 'pointer' },
    btnDisabled: { opacity: 0.9, cursor: 'not-allowed' },
    uploadGradient: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    uploadText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },

    deleteModalContainer: { backgroundColor: '#1E1E24', borderRadius: 24, width: '100%', maxWidth: 360, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(229, 57, 53, 0.2)' },
    warningIconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(229, 57, 53, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    deleteModalTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
    deleteModalSub: { color: '#8F98A0', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    deleteModalBtnRow: { flexDirection: 'row', width: '100%', gap: 12 },
    deleteCancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', cursor: 'pointer' },
    deleteCancelBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
    deleteConfirmBtn: { flex: 1, backgroundColor: '#E53935', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    deleteConfirmBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
});