const express = require('express');
const { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
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
const MAX_STORAGE_BYTES = 9.5 * 1024 * 1024 * 1024; // 9.5 GB

// 1. Get Presigned Upload URL
mediaRouter.post('/get-upload-url', async (req, res) => {
    try {
        const { filename, type, size } = req.body;
        const incomingFileSize = Number(size) || 0;

        // Calculate current R2 bucket size
        let totalSize = 0;
        let isTruncated = true;
        let continuationToken = undefined;

        while (isTruncated) {
            const command = new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                ContinuationToken: continuationToken,
            });
            const response = await s3Client.send(command);

            if (response.Contents) {
                response.Contents.forEach(item => totalSize += item.Size);
            }

            isTruncated = response.IsTruncated;
            continuationToken = response.NextContinuationToken;
        }

        // THE CATCH: Enforce the 9.5GB Limit
        if (totalSize + incomingFileSize > MAX_STORAGE_BYTES) {
            return res.status(403).json({
                error: "Storage limit exceeded. Your R2 bucket is near the 10GB capacity."
            });
        }

        // Generate Presigned PUT URL
        const key = `videos/${Date.now()}_${filename.replace(/\s+/g, '_')}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: type,
        });

        // URL valid for 30 minutes
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 1800 });

        // The final public URL where the video will live
        const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE;
        const publicUrl = `${R2_PUBLIC_BASE}/${key}`;

        res.status(200).json({
            uploadUrl: signedUrl,
            publicUrl: publicUrl,
            key: key // IMPORTANT: Returning the key so the frontend can send it back in /confirm-upload
        });

    } catch (error) {
        console.error("Presigned URL error:", error);
        res.status(500).json({ error: "Failed to generate upload URL" });
    }
});

// 2. Save Video to DB after successful R2 upload
mediaRouter.post('/confirm-upload', async (req, res) => {
    try {
        // --- ADDED duration TO DESTRUCTURING ---
        const { title, url, r2Key, userId, duration } = req.body;

        const newMedia = new Media({
            title,
            url,
            r2Key,
            duration, // --- ADDED TO DATABASE SAVE ---
            user: userId
        });

        await newMedia.save();
        res.status(200).json(newMedia);
    } catch (error) {
        console.error("Confirm upload error:", error);
        res.status(500).json({ error: "Failed to save video to database" });
    }
});

// 3. Fetch User's Videos
mediaRouter.get('/my-videos/:userId', async (req, res) => {
    try {
        const videos = await Media.find({ user: req.params.userId }).sort({ createdAt: -1 });
        res.status(200).json(videos);
    } catch (error) {
        console.error("Fetch videos error:", error);
        res.status(500).json({ error: "Failed to fetch videos" });
    }
});

// 4. Delete Video from R2 and DB
mediaRouter.delete('/delete/:videoId', async (req, res) => {
    try {
        const media = await Media.findById(req.params.videoId);
        if (!media) return res.status(404).json({ error: "Video not found" });

        // Delete from Cloudflare R2
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: media.r2Key,
        });
        await s3Client.send(command);

        // Delete from MongoDB
        await Media.findByIdAndDelete(req.params.videoId);

        res.status(200).json({ message: "Video deleted successfully" });
    } catch (error) {
        console.error("Delete video error:", error);
        res.status(500).json({ error: "Failed to delete video" });
    }
});

module.exports = mediaRouter;