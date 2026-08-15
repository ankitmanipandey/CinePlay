const express = require('express');
const { S3Client, ListObjectsV2Command, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

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

mediaRouter.post('/get-upload-url', async (req, res) => {
    try {
        const { filename, type, size } = req.body;
        const incomingFileSize = Number(size) || 0;

        // 1. Calculate current R2 bucket size
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

        // 2. THE CATCH: Enforce the 9.5GB Limit
        if (totalSize + incomingFileSize > MAX_STORAGE_BYTES) {
            return res.status(403).json({
                error: "Storage limit exceeded. Your R2 bucket is near the 10GB capacity."
            });
        }

        // 3. Generate Presigned PUT URL
        const key = `videos/${Date.now()}_${filename.replace(/\s+/g, '_')}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: type,
        });

        // URL valid for 30 minutes
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 1800 });

        // The final public URL where the video will live
        const R2_PUBLIC_BASE = process.env.R2_PUBLIC_BASE
        const publicUrl = `${R2_PUBLIC_BASE}/${key}`;

        res.status(200).json({
            uploadUrl: signedUrl,
            publicUrl: publicUrl
        });

    } catch (error) {
        console.error("Presigned URL error:", error);
        res.status(500).json({ error: "Failed to generate upload URL" });
    }
});

module.exports = mediaRouter;