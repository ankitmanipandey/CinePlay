const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { Expo } = require('expo-server-sdk');

const userRouter = express.Router();

// Toggle Watchlist Item
userRouter.post('/watchlist/toggle', protect, async (req, res) => {
    try {
        const { tmdbId } = req.body;
        if (!tmdbId) return res.status(400).json({ message: 'tmdbId is required' });

        const idStr = String(tmdbId);
        const user = await User.findById(req.user._id);
        const isWatchlisted = user.watchlist.includes(idStr);

        if (isWatchlisted) {
            await User.findByIdAndUpdate(req.user._id, { $pull: { watchlist: idStr } });
        } else {
            await User.findByIdAndUpdate(req.user._id, {
                $addToSet: { watchlist: idStr }, $pull: { watched: idStr }
            });
        }

        const updatedUser = await User.findById(req.user._id);
        res.status(200).json({ watchlist: updatedUser.watchlist, watched: updatedUser.watched });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Toggle Watched Item (Fixed Race Condition)
userRouter.post('/watched/toggle', protect, async (req, res) => {
    try {
        const { tmdbId } = req.body;
        if (!tmdbId) return res.status(400).json({ message: 'tmdbId is required' });

        const idStr = String(tmdbId);
        const user = await User.findById(req.user._id);
        const isWatched = user.watched.includes(idStr);

        if (isWatched) {
            await User.findByIdAndUpdate(req.user._id, { $pull: { watched: idStr } });
        } else {
            await User.findByIdAndUpdate(req.user._id, {
                $addToSet: { watched: idStr }, $pull: { watchlist: idStr }
            });
        }

        const updatedUser = await User.findById(req.user._id);
        res.status(200).json({ watchlist: updatedUser.watchlist, watched: updatedUser.watched });
    } catch (error) {
        console.error('Error toggling watched:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Toggle Favorite Artist (Fixed Race Condition)
userRouter.post('/artists/toggle', protect, async (req, res) => {
    try {
        const { artistName } = req.body;
        if (!artistName) return res.status(400).json({ message: 'artistName is required' });

        const user = await User.findById(req.user._id);
        const favorites = user.favoriteArtists || [];
        const isFavorite = favorites.includes(artistName);

        if (isFavorite) {
            await User.findByIdAndUpdate(req.user._id, { $pull: { favoriteArtists: artistName } });
        } else {
            await User.findByIdAndUpdate(req.user._id, { $addToSet: { favoriteArtists: artistName } });
        }

        const updatedUser = await User.findById(req.user._id);
        res.status(200).json({ favoriteArtists: updatedUser.favoriteArtists });
    } catch (error) {
        console.error('Error toggling artist:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

userRouter.put('/push-token', protect, async (req, res) => {
    try {
        const { token } = req.body;

        if (!Expo.isExpoPushToken(token)) {
            return res.status(400).json({ message: 'Invalid token format' });
        }

        await User.updateMany(
            { expoPushToken: token, _id: { $ne: req.user._id } },
            { $set: { expoPushToken: null } }
        );

        await User.updateOne({ _id: req.user._id }, { $set: { expoPushToken: token } });

        res.status(200).json({ message: 'Push token saved successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// 1. GET User's Lists 
userRouter.get('/lists', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.status(200).json({
            watchlist: user.watchlist,
            watched: user.watched,
            likedSongs: user.likedSongs || [],
            dislikedSongs: user.dislikedSongs || [],
            favoriteArtists: user.favoriteArtists || []
        });
    } catch (error) {
        console.error('Error fetching lists:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 2. POST Handle Like/Dislike/History (Fixed Race Condition)
userRouter.post('/music/interact', protect, async (req, res) => {
    try {
        const { songId, action } = req.body;
        if (!songId) return res.status(400).json({ message: 'songId is required' });

        if (action === 'like') {
            await User.findByIdAndUpdate(req.user._id, {
                $addToSet: { likedSongs: songId }, $pull: { dislikedSongs: songId }
            });
        } else if (action === 'removeLike') {
            await User.findByIdAndUpdate(req.user._id, { $pull: { likedSongs: songId } });
        } else if (action === 'dislike') {
            await User.findByIdAndUpdate(req.user._id, {
                $addToSet: { dislikedSongs: songId }, $pull: { likedSongs: songId }
            });
        } else if (action === 'listen') {
            // For complex history array shifting, read-modify-update is required, 
            // but we limit it safely.
            const user = await User.findById(req.user._id);
            const newHistory = [songId, ...(user.musicHistory || []).filter(id => id !== songId)].slice(0, 50);
            await User.findByIdAndUpdate(req.user._id, { $set: { musicHistory: newHistory } });
        }

        const updatedUser = await User.findById(req.user._id);
        res.status(200).json({ success: true, likedSongs: updatedUser.likedSongs });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET: Infinite Queue Algorithm Generator (Added Fetch Timeouts)
userRouter.get('/music/recommendations', protect, async (req, res) => {
    try {
        const { seedSongId, seedArtist } = req.query;
        const user = await User.findById(req.user._id);

        let cleanArtist = 'Trending';
        if (seedArtist && seedArtist !== 'Playing Now' && seedArtist !== 'Unknown Artist') {
            cleanArtist = seedArtist.split(',')[0].split('&')[0].split('-')[0].trim();
        }

        const randomPage = Math.floor(Math.random() * 5) + 1;
        const searchQ = encodeURIComponent(cleanArtist);

        const primaryUrl = `https://jiosaavn-api-47fm.onrender.com/api/search/songs?query=${searchQ}&page=${randomPage}&limit=25`;
        const fallbackUrl = `https://saavn.sumit.co/api/search/songs?query=${searchQ}&page=${randomPage}&limit=25`;

        let saavnData = null;
        try {
            // Added 8-second timeout to prevent server hanging
            const primaryRes = await fetch(primaryUrl, { signal: AbortSignal.timeout(8000) });
            if (!primaryRes.ok) throw new Error("Primary API failed");
            saavnData = await primaryRes.json();
        } catch (err) {
            console.warn('[Recommendations] Primary API failed, trying fallback...');
            try {
                const fallbackRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(8000) });
                if (fallbackRes.ok) {
                    saavnData = await fallbackRes.json();
                }
            } catch (fallbackErr) {
                console.warn('[Recommendations] Fallback API also failed.');
            }
        }

        if (saavnData?.success && saavnData?.data?.results?.length > 0) {
            const dislikedSet = new Set(user?.dislikedSongs || []);
            const likedSet = new Set(user?.likedSongs || []);

            let recommendations = saavnData.data.results.filter(song => !dislikedSet.has(song.id));

            recommendations.sort((a, b) => {
                const aLiked = likedSet.has(a.id) ? 1 : 0;
                const bLiked = likedSet.has(b.id) ? 1 : 0;
                return bLiked - aLiked;
            });

            return res.status(200).json({ success: true, data: recommendations.slice(0, 15) });
        }

        return res.status(200).json({ success: true, data: [] });
    } catch (error) {
        console.error('[Recommendations Error]:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});

// GET: Liked Songs with Details (Fixed 414 URI Too Long & Added Timeouts)
userRouter.get('/music/liked', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user.likedSongs || user.likedSongs.length === 0) {
            return res.status(200).json({ data: [] });
        }

        // Cap to the 40 most recent likes so the URL doesn't exceed HTTP limits
        const recentLikes = user.likedSongs.slice(-40);
        const ids = encodeURIComponent(recentLikes.join(','));

        const primaryUrl = `https://jiosaavn-api-47fm.onrender.com/api/songs?ids=${ids}`;
        const fallbackUrl = `https://saavn.sumit.co/api/songs?ids=${ids}`;

        let json = null;
        try {
            const primaryRes = await fetch(primaryUrl, { signal: AbortSignal.timeout(8000) });
            if (!primaryRes.ok) throw new Error("Primary API failed");
            json = await primaryRes.json();
        } catch (err) {
            console.warn('[Liked Songs] Primary API failed, trying fallback...');
            try {
                const fallbackRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(8000) });
                if (fallbackRes.ok) {
                    json = await fallbackRes.json();
                }
            } catch (fallbackErr) {
                console.warn('[Liked Songs] Fallback API also failed.');
            }
        }

        if (json && json.success && json.data) {
            const tracks = json.data.map(t => ({
                id: t.id,
                title: t.name,
                artist: t.artists?.primary?.map(a => a.name).join(', ') || 'Unknown',
                image: t.image?.find(i => i.quality === '500x500')?.url || t.image?.[0]?.url,
                url: t.downloadUrl?.find(d => d.quality === '320kbps')?.url || t.downloadUrl?.[0]?.url
            })).filter(t => t.url);

            res.status(200).json({ data: tracks });
        } else {
            res.status(200).json({ data: [] });
        }
    } catch (error) {
        console.error('Error fetching liked songs:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = userRouter;