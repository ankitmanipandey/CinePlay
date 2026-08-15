import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';

// Ensure this matches your network setup
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.x.x:5000/api';

const MyVideosScreen = () => {
    const router = useRouter();
    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
    const [videoTitle, setVideoTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const [myVideos, setMyVideos] = useState([]);

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
                    setVideoTitle(file.name.split('.')[0]); // Auto-fill title
                }
            }
        } catch (err) {
            console.log("Document picker error:", err);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setIsUploading(true);
        setUploadProgress(0);

        try {
            // 1. Ask Backend for the URL (and pass the 9.5GB check)
            const initRes = await axios.post(`${BACKEND_URL}/media/get-upload-url`, {
                filename: selectedFile.name,
                type: selectedFile.mimeType || 'video/mp4',
                size: selectedFile.size
            });

            const { uploadUrl, publicUrl } = initRes.data;

            // 2. Create the Expo File System Upload Task
            const uploadTask = FileSystem.createUploadTask(
                uploadUrl,
                selectedFile.uri,
                {
                    httpMethod: 'PUT',
                    headers: {
                        'Content-Type': selectedFile.mimeType || 'video/mp4',
                    },
                },
                (data) => {
                    // 3. Calculate and set progress
                    const progress = Math.round((data.totalBytesSent / data.totalBytesExpectedToSend) * 100);
                    setUploadProgress(progress);
                }
            );

            // 4. Execute the upload using native threads
            const uploadResult = await uploadTask.uploadAsync();

            if (uploadResult.status === 200) {
                Toast.show({ type: 'success', text1: 'Video uploaded successfully!' });
                setMyVideos(prev => [...prev, { title: videoTitle, url: publicUrl }]);
                closeAndResetModal();
            } else {
                throw new Error('Upload failed on the server side');
            }

        } catch (error) {
            if (error.response?.status === 403) {
                Toast.show({ type: 'error', text1: 'Storage Full', text2: error.response.data.error });
            } else {
                Toast.show({ type: 'error', text1: 'Upload failed', text2: 'Please try again.' });
                console.error(error);
            }
        } finally {
            setIsUploading(false);
        }
    };

    const closeAndResetModal = () => {
        if (isUploading) return; // Prevent closing while uploading
        setIsUploadModalVisible(false);
        setVideoTitle('');
        setSelectedFile(null);
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

                {myVideos.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="cloud-offline-outline" size={64} color="#2A2A30" />
                        <Text style={styles.emptyText}>No videos uploaded yet.</Text>
                        <Text style={styles.emptySubText}>Tap the + button to upload your first video.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={myVideos}
                        keyExtractor={(item, index) => index.toString()}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => (
                            <View style={styles.videoItem}>
                                <Ionicons name="videocam" size={24} color="#00E5FF" style={{ marginRight: 12 }} />
                                <Text style={styles.videoTitle}>{item.title}</Text>
                            </View>
                        )}
                    />
                )}

                <TouchableOpacity
                    style={styles.fab}
                    activeOpacity={0.8}
                    onPress={() => setIsUploadModalVisible(true)}
                >
                    <LinearGradient
                        colors={['#00E5FF', '#9B51E0', '#FF007A']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={styles.fabGradient}
                    >
                        <Ionicons name="add" size={32} color="#FFF" />
                    </LinearGradient>
                </TouchableOpacity>
            </SafeAreaView>

            <Modal visible={isUploadModalVisible} transparent={true} animationType="fade" onRequestClose={closeAndResetModal}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <View style={styles.modalContainer}>
                        {!isUploading && (
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={closeAndResetModal}>
                                <Ionicons name="close" size={24} color="#8F98A0" />
                            </TouchableOpacity>
                        )}

                        <Text style={styles.modalTitle}>Upload Video</Text>

                        <Text style={styles.inputLabel}>Video Title</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter a catchy title..."
                            placeholderTextColor="#8F98A0"
                            value={videoTitle}
                            onChangeText={setVideoTitle}
                            selectionColor="#00E5FF"
                            editable={!isUploading}
                        />

                        <TouchableOpacity
                            style={[styles.browseButton, selectedFile && { borderColor: '#00E5FF', backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}
                            activeOpacity={0.8}
                            onPress={handleBrowseFiles}
                            disabled={isUploading}
                        >
                            <Ionicons name={selectedFile ? "checkmark-circle" : "folder-open-outline"} size={20} color="#00E5FF" />
                            <Text style={styles.browseButtonText} numberOfLines={1}>
                                {selectedFile ? selectedFile.name : "Browse Files"}
                            </Text>
                        </TouchableOpacity>

                        {isUploading ? (
                            <View style={styles.progressContainer}>
                                <Text style={styles.progressText}>Uploading... {uploadProgress}%</Text>
                                <View style={styles.progressBarBackground}>
                                    <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.uploadBtnContainer, (!videoTitle || !selectedFile) && styles.btnDisabled]}
                                activeOpacity={0.8}
                                onPress={handleUpload}
                                disabled={!videoTitle || !selectedFile}
                            >
                                <LinearGradient
                                    colors={videoTitle && selectedFile ? ['#00E5FF', '#9B51E0', '#FF007A'] : ['#2A2A30', '#2A2A30']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={styles.uploadGradient}
                                >
                                    <Text style={[styles.uploadText, (!videoTitle || !selectedFile) && { color: '#8F98A0' }]}>Upload</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>
                </KeyboardAvoidingView>
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

    listContent: { padding: 20 },
    videoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#17171C', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    videoTitle: { color: '#FFF', fontSize: 16, fontWeight: '500', flex: 1 },

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

    progressContainer: { marginTop: 10 },
    progressText: { color: '#00E5FF', fontSize: 14, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
    progressBarBackground: { height: 8, backgroundColor: '#2A2A30', borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#00E5FF' }
});