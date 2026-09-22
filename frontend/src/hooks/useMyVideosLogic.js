import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import axios from 'axios';
import { useVideoPlayer } from 'expo-video';

import { useAuthStore } from '../store/useAuthStore';
import { useUploadStore } from '../store/useUploadStore';
import { uploadFileInBackground, cancelActiveUpload } from '../services/uploadManager';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.x.x:5000/api';
export const MAX_STORAGE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB

export const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const formatBytes = (bytes) => {
    if (bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
};

export const useMyVideosLogic = () => {
    const router = useRouter();
    const { user, token } = useAuthStore();

    const activeUpload = useUploadStore((state) => state.activeUpload);
    const setActiveUpload = useUploadStore((state) => state.setActiveUpload);
    const updateProgress = useUploadStore((state) => state.updateProgress);
    const clearActiveUpload = useUploadStore((state) => state.clearActiveUpload);

    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
    const [videoTitle, setVideoTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);

    const uploadDurationRef = useRef(0);

    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [videoToDelete, setVideoToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [myVideos, setMyVideos] = useState([]);
    const [storageUsed, setStorageUsed] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async (silent = false) => {
        if (!user?._id || !token) return;
        if (!silent) setIsLoading(true);
        try {
            // 🚨 ADDED: Authorization headers to both GET requests
            const [videosRes, storageRes] = await Promise.all([
                axios.get(`${BACKEND_URL}/media/my-videos/${user._id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${BACKEND_URL}/media/storage-usage`, {
                    headers: { Authorization: `Bearer ${token}` }
                }).catch(() => ({ data: { usedBytes: 0 } }))
            ]);
            setMyVideos(videosRes.data);
            setStorageUsed(storageRes.data.usedBytes || 0);
        } catch (error) {
            console.log("Error fetching data:", error);
            if (!silent) Toast.show({ type: 'hotstarError', text1: 'Failed to load your videos' });
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [user, token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleBrowseFiles = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'video/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                setSelectedFile(file);
                if (!videoTitle) setVideoTitle(file.name.split('.')[0]);
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
            const { publicUrl, key, thumbnailUrl, thumbnailKey } = await uploadFileInBackground({
                localFileUri: fileToUpload.uri,
                filename: fileToUpload.name,
                fileObject: fileToUpload.file,
                mimeType: fileToUpload.mimeType || 'video/mp4',
                fileSize: fileToUpload.size,
                title: titleToUpload,
                token: token, // Pass token just in case the upload manager needs it
                onProgress: (progress) => updateProgress(progress)
            });

            const formattedDuration = formatDuration(uploadDurationRef.current);

            // 🚨 ADDED: Authorization header to POST request
            await axios.post(`${BACKEND_URL}/media/confirm-upload`, {
                title: titleToUpload,
                url: publicUrl,
                r2Key: key,
                thumbnailUrl,
                thumbnailKey,
                userId: user._id,
                duration: formattedDuration
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            Toast.show({ type: 'hotstarInfo', text1: 'Video uploaded successfully!' });
            fetchData(true);
        } catch (error) {
            if (error.message === 'CANCELLED') {
                Toast.show({ type: 'hotstarInfo', text1: 'Upload cancelled' });
            } else {
                console.error("Upload error:", error);
                Toast.show({ type: 'hotstarError', text1: 'Upload failed', text2: 'Please try again.' });
            }
        } finally {
            clearActiveUpload();
            uploadDurationRef.current = 0;
        }
    };

    const cancelUpload = () => {
        cancelActiveUpload();
        clearActiveUpload();
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
            // 🚨 ADDED: Authorization header to DELETE request
            await axios.delete(`${BACKEND_URL}/media/delete/${videoToDelete}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Toast.show({ type: 'hotstarInfo', text1: 'Video deleted successfully' });
            setDeleteModalVisible(false);
            fetchData(true);
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

    // Calculate Storage Bar Color and Width
    const storagePercentRaw = (storageUsed / MAX_STORAGE_BYTES) * 100;
    const storagePercent = Math.min(storagePercentRaw, 100);
    let progressColor = '#00E5FF';
    if (storagePercent > 90) progressColor = '#E53935';
    else if (storagePercent > 75) progressColor = '#F2C94C';

    return {
        router, myVideos, storageUsed, isLoading, storagePercent, progressColor,
        isUploadModalVisible, setIsUploadModalVisible, videoTitle, setVideoTitle, selectedFile,
        deleteModalVisible, setDeleteModalVisible, isDeleting,
        handleBrowseFiles, handleUpload, cancelUpload, requestDelete, confirmDelete, playVideoInTheatre,
        activeUpload, ghostPlayer
    };
};