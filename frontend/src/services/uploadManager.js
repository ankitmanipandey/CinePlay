// services/uploadManager.js
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import axios from 'axios';
import { router } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.x.x:5000/api';
const CHANNEL_ID = 'cineplay-video-upload';

// Keep notification icon payload well under Android's ~1MB Binder transaction limit
const MAX_ICON_BASE64_BYTES = 150 * 1024;
const ICON_TARGET_WIDTH = 200;

const MAX_PART_RETRIES = 3;
const PART_UPLOAD_TIMEOUT_MS = 60 * 1000;

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
                // Tap body to navigate to the screen
                if (type === EventType.PRESS) {
                    router.push('/my-videos');
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
// `thumbnailUri` should already be a small base64 data URI (or undefined) — see
// getNotificationSafeThumbnail(). Never pass a raw/full-res thumbnail here.
async function updateNotification({ title, progress, thumbnailUri }) {
    await notifee.displayNotification({
        id: 'active-upload',
        title: `Uploading: ${title}`,
        body: `${progress}% completed`,
        android: {
            channelId: CHANNEL_ID,
            smallIcon: 'ic_launcher',
            asForegroundService: true,
            ongoing: true,
            progress: {
                max: 100,
                current: progress,
                indeterminate: false,
            },
            pressAction: { id: 'default' },
            actions: [
                { title: 'Cancel', pressAction: { id: 'cancel-upload' } },
            ],
            ...(thumbnailUri ? { largeIcon: thumbnailUri } : {}),
        },
    });
}

// Generates a small, notification-safe icon (resized + compressed) from a video
// thumbnail. Returns null on any failure — a missing icon is fine, a crashed
// upload from an oversized Binder transaction is not.
async function getNotificationSafeThumbnail(sourceUri) {
    try {
        const manipulated = await ImageManipulator.manipulateAsync(
            sourceUri,
            [{ resize: { width: ICON_TARGET_WIDTH } }],
            { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (!manipulated.base64) return null;

        // Defensive guard: never let an oversized icon reach notifee/Binder,
        // even if resize somehow didn't bring it down enough.
        if (manipulated.base64.length > MAX_ICON_BASE64_BYTES) {
            console.log('Thumbnail still too large after resize, skipping icon');
            return null;
        }

        return `data:image/jpeg;base64,${manipulated.base64}`;
    } catch (e) {
        console.log('Notification thumbnail resize failed:', e.message);
        return null;
    }
}

// Uploads a single part with retry + timeout, resolving the ETag on success.
function uploadPartWithRetry(presignedUrl, binaryBuffer, isCancelledFn) {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const attempt = () => {
            if (isCancelledFn()) {
                reject(new Error('CANCELLED'));
                return;
            }
            attempts++;

            const xhr = new XMLHttpRequest();
            xhr.timeout = PART_UPLOAD_TIMEOUT_MS;
            xhr.open('PUT', presignedUrl);
            xhr.setRequestHeader('Content-Type', 'application/octet-stream');

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag');
                    if (!etag) {
                        // R2/S3 always returns an ETag on a successful PUT part.
                        // Treat a missing one as a failure rather than silently
                        // completing the multipart upload with a bad part later.
                        retryOrFail(new Error('Missing ETag in part upload response'));
                        return;
                    }
                    resolve(etag);
                } else {
                    retryOrFail(new Error(`Part upload failed with status ${xhr.status}`));
                }
            };

            xhr.onerror = () => retryOrFail(new Error('Network request failed'));
            xhr.ontimeout = () => retryOrFail(new Error('Network request timed out'));

            const retryOrFail = (err) => {
                if (isCancelledFn()) {
                    reject(new Error('CANCELLED'));
                    return;
                }
                if (attempts >= MAX_PART_RETRIES) {
                    reject(err);
                    return;
                }
                setTimeout(attempt, 2000 * attempts); // linear backoff
            };

            xhr.send(binaryBuffer);
        };

        attempt();
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

    if (!localFileUri || !fileSize || fileSize <= 0) {
        throw new Error('Invalid file: missing URI or size');
    }

    await notifee.requestPermission();
    await ensureChannel();

    let notificationThumbnailUri = null; // small, notification-safe icon
    let finalThumbnailPublicUrl = null;  // full-res thumbnail uploaded to R2
    let finalThumbnailKey = null;

    // Declared here (not inside the try below) so the catch block can always
    // reach them for abort cleanup, regardless of which step failed.
    let key;
    let uploadId;

    try {
        const thumb = await VideoThumbnails.getThumbnailAsync(localFileUri, { time: 1000 });
        notificationThumbnailUri = await getNotificationSafeThumbnail(thumb.uri);

        const thumbInitRes = await axios.post(`${BACKEND_URL}/media/thumbnail-upload-url`, {
            filename: `thumb_${Date.now()}.jpg`,
            type: 'image/jpeg'
        });

        const { uploadUrl: thumbUploadUrl, publicUrl: thumbPublicUrl, key: thumbKey } = thumbInitRes.data;

        await FileSystem.uploadAsync(thumbUploadUrl, thumb.uri, {
            httpMethod: 'PUT',
            headers: { 'Content-Type': 'image/jpeg' }
        });

        finalThumbnailPublicUrl = thumbPublicUrl;
        finalThumbnailKey = thumbKey;
    } catch (e) {
        console.log('Thumbnail generation/upload skipped:', e.message);
        notificationThumbnailUri = null;
        finalThumbnailPublicUrl = null;
        finalThumbnailKey = null;
    }

    // Start the foreground service immediately. Only the FIRST call carries the
    // icon — notifee/Android keeps the previously-set largeIcon on subsequent
    // updates to the same notification id, so re-sending it every chunk (every
    // 8MB) would just be unnecessary Binder IPC traffic.
    await updateNotification({ title, progress: 0, thumbnailUri: notificationThumbnailUri });

    try {
        // 1. Initialize Multipart Upload on Backend
        const initRes = await axios.post(`${BACKEND_URL}/media/multipart/init`, {
            filename,
            mimeType,
            fileSize,
        });

        ({ uploadId, key } = initRes.data);
        const { partSize, partCount: rawPartCount, publicUrl } = initRes.data;
        const partCount = Math.max(1, rawPartCount);
        const completedParts = [];

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
                length,
            });

            const binaryBuffer = decode(base64Chunk);

            // Fetch presigned URL for this part
            const partUrlRes = await axios.post(`${BACKEND_URL}/media/multipart/part-url`, {
                key,
                uploadId,
                partNumber,
            });

            const { url: presignedPartUrl } = partUrlRes.data;

            // Upload part with retry + timeout, get back its ETag
            const etag = await uploadPartWithRetry(presignedPartUrl, binaryBuffer, () => isCancelled);

            completedParts.push({
                ETag: etag,
                PartNumber: partNumber,
            });

            const currentProgress = Math.round((partNumber / partCount) * 100);
            if (onProgress) onProgress(currentProgress);

            // No thumbnailUri here — icon was already set on the first call above.
            await updateNotification({ title, progress: currentProgress });
        }

        // 2. Complete Multipart Upload
        await axios.post(`${BACKEND_URL}/media/multipart/complete`, {
            key,
            uploadId,
            parts: completedParts,
        });

        // 3. Stop the foreground service and remove the progress bar
        await notifee.stopForegroundService();
        await notifee.cancelNotification('active-upload');

        // 4. Show a final "Success" notification that stays in the tray
        await notifee.displayNotification({
            id: `upload-success-${Date.now()}`,
            title: 'Upload Complete ✅',
            body: `"${title}" has been successfully uploaded!`,
            android: {
                channelId: CHANNEL_ID,
                smallIcon: 'ic_launcher',
                autoCancel: true,
                pressAction: { id: 'default' },
                ...(notificationThumbnailUri ? { largeIcon: notificationThumbnailUri } : {}),
            },
        });

        return { publicUrl, key, thumbnailUrl: finalThumbnailPublicUrl, thumbnailKey: finalThumbnailKey };
    } catch (error) {
        await notifee.stopForegroundService();
        await notifee.cancelNotification('active-upload');

        // `key`/`uploadId` come from the successful init call (declared in the
        // outer scope above), not from the error response — the part-url,
        // complete, etc. endpoints never echo those back on failure, so relying
        // on error.response.data here meant abort silently never fired.
        if (key && uploadId) {
            try {
                await axios.post(`${BACKEND_URL}/media/multipart/abort`, { key, uploadId });
            } catch (abortErr) {
                console.log('Abort error:', abortErr.message);
            }
        }

        throw isCancelled || error.message === 'CANCELLED' ? new Error('CANCELLED') : error;
    } finally {
        unsubscribeForegroundEvent?.();
        resolveServiceTask?.();
        resolveServiceTask = null;
        unsubscribeForegroundEvent = null;
    }
};