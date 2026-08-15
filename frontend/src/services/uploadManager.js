// services/uploadManager.js
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { decode } from 'base64-arraybuffer';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.x.x:5000/api';
const CHANNEL_ID = 'cineplay-video-upload';

let isCancelled = false;
let resolveServiceTask = null;
let unsubscribeForegroundEvent = null;

// Register Foreground Service handler once at app startup
export const registerUploadForegroundService = () => {
    notifee.registerForegroundService((notification) => {
        return new Promise((resolve) => {
            resolveServiceTask = resolve;
            unsubscribeForegroundEvent = notifee.onForegroundEvent(({ type, detail }) => {
                if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'cancel-upload') {
                    isCancelled = true;
                }
            });
        });
    });
};

// Called by the Cancel button in MyVideosScreen
export const cancelActiveUpload = () => {
    isCancelled = true;
};

// Helper: Setup Notification Channel
async function ensureChannel() {
    await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Video Uploads',
        importance: AndroidImportance.LOW,
        vibration: false,
    });
}

// Helper: Update Foreground Notification
async function updateNotification({ title, progress, thumbnailUri }) {
    await notifee.displayNotification({
        id: 'active-upload',
        title: `Uploading: ${title}`,
        body: `${progress}% completed`,
        android: {
            channelId: CHANNEL_ID,
            smallIcon: 'ic_launcher', // <--- CHANGED THIS LINE
            asForegroundService: true,
            ongoing: true,
            progress: {
                max: 100,
                current: progress,
                indeterminate: false,
            },
            largeIcon: thumbnailUri || undefined,
            actions: [
                {
                    title: 'Cancel',
                    pressAction: { id: 'cancel-upload' },
                },
            ],
        },
    });
}

// Main Upload Function
export const uploadFileInBackground = async ({
    localFileUri,
    filename,
    mimeType,
    fileSize,
    title,
    onProgress
}) => {
    isCancelled = false;
    await notifee.requestPermission();
    await ensureChannel();

    // Generate thumbnail for the notification
    let thumbnailUri = null;
    try {
        const thumb = await VideoThumbnails.getThumbnailAsync(localFileUri, { time: 1000 });
        thumbnailUri = thumb.uri;
    } catch (e) {
        console.log('Thumbnail generation skipped:', e.message);
    }

    // 1. Initialize Multipart Upload on Backend
    const initRes = await axios.post(`${BACKEND_URL}/media/multipart/init`, {
        filename,
        mimeType,
        fileSize,
    });

    const { uploadId, key, partSize, partCount, publicUrl } = initRes.data;
    const completedParts = [];

    await updateNotification({ title, progress: 0, thumbnailUri });

    try {
        for (let partNumber = 1; partNumber <= partCount; partNumber++) {
            if (isCancelled) {
                throw new Error('CANCELLED');
            }

            const offset = (partNumber - 1) * partSize;
            const length = Math.min(partSize, fileSize - offset);

            // Read chunk from local file
            const base64Chunk = await FileSystem.readAsStringAsync(localFileUri, {
                encoding: FileSystem.EncodingType.Base64,
                position: offset,
                length: length,
            });

            const binaryBuffer = decode(base64Chunk);

            // Fetch presigned URL for this part
            const partUrlRes = await axios.post(`${BACKEND_URL}/media/multipart/part-url`, {
                key,
                uploadId,
                partNumber,
            });

            const { url: presignedPartUrl } = partUrlRes.data;

            // Upload part with retry mechanism (3 attempts per chunk)
            let uploaded = false;
            let attempts = 0;
            let etag = null;

            while (!uploaded && attempts < 3) {
                if (isCancelled) throw new Error('CANCELLED');
                attempts++;
                try {
                    await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('PUT', presignedPartUrl);
                        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

                        xhr.onload = () => {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                // Extract ETag from headers
                                etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag');
                                uploaded = true;
                                resolve();
                            } else {
                                reject(new Error(`Part upload failed with status ${xhr.status}`));
                            }
                        };

                        xhr.onerror = () => reject(new Error('Network request failed'));
                        xhr.ontimeout = () => reject(new Error('Network request timed out'));

                        // XHR natively supports sending the ArrayBuffer without a Blob
                        xhr.send(binaryBuffer);
                    });
                } catch (err) {
                    if (attempts >= 3) throw err;
                    await new Promise((r) => setTimeout(r, 2000 * attempts)); // Backoff
                }
            }

            completedParts.push({
                ETag: etag,
                PartNumber: partNumber,
            });

            const currentProgress = Math.round((partNumber / partCount) * 100);
            if (onProgress) onProgress(currentProgress);
            await updateNotification({ title, progress: currentProgress, thumbnailUri });
        }

        // 2. Complete Multipart Upload
        await axios.post(`${BACKEND_URL}/media/multipart/complete`, {
            key,
            uploadId,
            parts: completedParts,
        });

        // Remove notification on success
        await notifee.stopForegroundService();
        await notifee.cancelNotification('active-upload');

        return { publicUrl, key };
    } catch (error) {
        await notifee.stopForegroundService();
        await notifee.cancelNotification('active-upload');

        // Abort R2 upload to clean up storage — skip if the user just
        // cancelled a not-yet-started upload (no key/uploadId yet)
        if (key && uploadId) {
            try {
                await axios.post(`${BACKEND_URL}/media/multipart/abort`, { key, uploadId });
            } catch (abortErr) {
                console.log('Abort error:', abortErr.message);
            }
        }

        throw isCancelled ? new Error('CANCELLED') : error;
    } finally {
        unsubscribeForegroundEvent?.();
        resolveServiceTask?.();
        resolveServiceTask = null;
        unsubscribeForegroundEvent = null;
    }
};