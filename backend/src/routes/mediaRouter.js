const express = require('express');
const {
    S3Client,
    ListObjectsV2Command,
    DeleteObjectCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
    PutObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const crypto = require('crypto');
const Media = require('../models/Media');

const mediaRouter = express.Router();

const s3Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE;
const MAX_STORAGE_BYTES = 9.5 * 1024 * 1024 * 1024; // 9.5 GB

// -------------------------------------------------------------------
// MULTIPART UPLOAD ENDPOINTS (For Background / Chunked Uploads)
// -------------------------------------------------------------------

// 1. Initialize Multipart Upload (Includes your storage check)
mediaRouter.post('/multipart/init', async (req, res) => {
    try {
        const { filename, mimeType, fileSize } = req.body;
        if (!filename || !fileSize) {
            return res.status(400).json({ error: 'filename and fileSize are required' });
        }
        const incomingFileSize = Number(fileSize) || 0;

        // Calculate current R2 bucket size to enforce 9.5GB limit
        let totalSize = 0;
        let isTruncated = true;
        let continuationToken = undefined;

        while (isTruncated) {
            const listCommand = new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                ContinuationToken: continuationToken,
            });
            const response = await s3Client.send(listCommand);

            if (response.Contents) {
                response.Contents.forEach(item => totalSize += item.Size);
            }
            isTruncated = response.IsTruncated;
            continuationToken = response.NextContinuationToken;
        }

        if (totalSize + incomingFileSize > MAX_STORAGE_BYTES) {
            return res.status(403).json({
                error: "Storage limit exceeded. Your R2 bucket is near the 10GB capacity."
            });
        }

        // Generate a unique key
        const extension = filename.split('.').pop();
        const key = `videos/${Date.now()}_${crypto.randomUUID()}.${extension}`;

        // Start the multipart upload on R2
        const command = new CreateMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: mimeType || 'video/mp4',
        });

        const multipart = await s3Client.send(command);

        // Split into 8MB chunks
        const PART_SIZE = 8 * 1024 * 1024;
        const partCount = Math.ceil(incomingFileSize / PART_SIZE);

        res.json({
            uploadId: multipart.UploadId,
            key,
            partSize: PART_SIZE,
            partCount,
            publicUrl: `${R2_PUBLIC_BASE}/${key}`
        });
    } catch (err) {
        console.error('Init multipart error:', err);
        res.status(500).json({ error: 'Failed to init multipart upload' });
    }
});

// 2. Get Presigned URL for an INDIVIDUAL chunk (part)
mediaRouter.post('/multipart/part-url', async (req, res) => {
    try {
        const { key, uploadId, partNumber } = req.body;

        const command = new UploadPartCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            PartNumber: Number(partNumber),
        });

        // URL valid for 1 hour (plenty of time for one 8MB chunk)
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ url });
    } catch (err) {
        console.error('Part url error:', err);
        res.status(500).json({ error: 'Failed to get part presigned url' });
    }
});

// 3. Tell R2 to combine the chunks into the final video
mediaRouter.post('/multipart/complete', async (req, res) => {
    try {
        const { key, uploadId, parts } = req.body;

        // Parts must be sorted exactly by PartNumber for R2 to stitch them correctly
        const sortedParts = parts.sort((a, b) => a.PartNumber - b.PartNumber);

        const command = new CompleteMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: { Parts: sortedParts },
        });

        await s3Client.send(command);
        res.json({ success: true, key });
    } catch (err) {
        console.error('Complete multipart error:', err);
        res.status(500).json({ error: 'Failed to complete multipart upload' });
    }
});

// 4. Cancel the upload and delete the partial chunks from R2
mediaRouter.post('/multipart/abort', async (req, res) => {
    try {
        const { key, uploadId } = req.body;
        const command = new AbortMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
        });

        await s3Client.send(command);
        res.json({ success: true });
    } catch (err) {
        console.error('Abort multipart error:', err);
        res.status(500).json({ error: 'Failed to abort multipart upload' });
    }
});

// -------------------------------------------------------------------
// DATABASE ENDPOINTS (Your existing code)
// -------------------------------------------------------------------

// Save Video to DB after R2 upload completes
mediaRouter.post('/confirm-upload', async (req, res) => {
    try {
        const { title, url, r2Key, thumbnailUrl, thumbnailKey, userId, duration } = req.body;

        const newMedia = new Media({
            title,
            url,
            r2Key,
            thumbnailUrl,
            thumbnailKey,
            duration,
            user: userId
        });

        await newMedia.save();
        res.status(200).json(newMedia);
    } catch (error) {
        console.error("Confirm upload error:", error);
        res.status(500).json({ error: "Failed to save video to database" });
    }
});

// Fetch User's Videos
mediaRouter.get('/my-videos/:userId', async (req, res) => {
    try {
        const videos = await Media.find({ user: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json(videos);
    } catch (error) {
        console.error("Fetch videos error:", error);
        res.status(500).json({ error: "Failed to fetch videos" });
    }
});

// Delete Video from R2 and DB
mediaRouter.delete('/delete/:videoId', async (req, res) => {
    try {
        const media = await Media.findById(req.params.videoId);
        if (!media) return res.status(404).json({ error: "Video not found" });

        const keysToDelete = [media.r2Key, media.thumbnailKey].filter(Boolean);
        await Promise.all(keysToDelete.map(Key =>
            s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key }))
        ));

        await Media.findByIdAndDelete(req.params.videoId);
        res.status(200).json({ message: "Video deleted successfully" });
    } catch (error) {
        console.error("Delete video error:", error);
        res.status(500).json({ error: "Failed to delete video" });
    }
});


// Get Total Storage Usage
mediaRouter.get('/storage-usage', async (req, res) => {
    try {
        let totalSize = 0;
        let isTruncated = true;
        let continuationToken = undefined;

        while (isTruncated) {
            const listCommand = new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                ContinuationToken: continuationToken,
            });
            const response = await s3Client.send(listCommand);

            if (response.Contents) {
                response.Contents.forEach(item => totalSize += item.Size);
            }
            isTruncated = response.IsTruncated;
            continuationToken = response.NextContinuationToken;
        }

        res.status(200).json({ usedBytes: totalSize });
    } catch (error) {
        console.error("Storage fetch error:", error);
        res.status(500).json({ error: "Failed to fetch storage usage" });
    }
});

mediaRouter.post('/thumbnail-upload-url', async (req, res) => {
    try {
        const { filename, type } = req.body;
        const key = `thumbnails/${Date.now()}_${crypto.randomUUID()}.jpg`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: type || 'image/jpeg',
        });

        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        res.json({
            uploadUrl,
            publicUrl: `${R2_PUBLIC_BASE}/${key}`,
            key, // <-- NEW: return the key so it can be threaded through and saved
        });
    } catch (err) {
        console.error('Thumbnail upload url error:', err);
        res.status(500).json({ error: 'Failed to get thumbnail upload url' });
    }
});

module.exports = mediaRouter;