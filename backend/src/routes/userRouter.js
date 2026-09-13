const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const userRouter = express.Router();


// Toggle Watchlist Item
userRouter.post('/watchlist/toggle', protect, async (req, res) => {
    try {
        const { tmdbId } = req.body;
        const user = await User.findById(req.user._id);
        const idStr = String(tmdbId);

        const isWatchlisted = user.watchlist.includes(idStr);

        if (isWatchlisted) {
            // Remove from watchlist
            user.watchlist = user.watchlist.filter(id => id !== idStr);
        } else {
            // Add to watchlist and remove from watched (mutual exclusivity)
            user.watchlist.push(idStr);
            user.watched = user.watched.filter(id => id !== idStr);
        }

        await user.save();
        res.status(200).json({ watchlist: user.watchlist, watched: user.watched });
    } catch (error) {
        console.error('Error toggling watchlist:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Toggle Watched Item
userRouter.post('/watched/toggle', protect, async (req, res) => {
    try {
        const { tmdbId } = req.body;
        const user = await User.findById(req.user._id);
        const idStr = String(tmdbId);

        const isWatched = user.watched.includes(idStr);

        if (isWatched) {
            // Remove from watched
            user.watched = user.watched.filter(id => id !== idStr);
        } else {
            // Add to watched and remove from watchlist (mutual exclusivity)
            user.watched.push(idStr);
            user.watchlist = user.watchlist.filter(id => id !== idStr);
        }

        await user.save();
        res.status(200).json({ watchlist: user.watchlist, watched: user.watched });
    } catch (error) {
        console.error('Error toggling watched:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

userRouter.put('/push-token', protect, async (req, res) => {
    try {
        const { token } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.expoPushToken = token;
        await user.save();

        res.status(200).json({ message: 'Push token saved successfully' });
    } catch (error) {
        console.error('Error saving push token:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 1. GET User's Lists (Update to include liked & disliked songs)
userRouter.get('/lists', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.status(200).json({
            watchlist: user.watchlist,
            watched: user.watched,
            likedSongs: user.likedSongs || [],       // <-- Added
            dislikedSongs: user.dislikedSongs || []  // <-- Added
        });
    } catch (error) {
        console.error('Error fetching lists:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 2. POST Handle Like/Dislike/History (Update to handle 'removeLike')
userRouter.post('/music/interact', protect, async (req, res) => {
    try {
        const { songId, action } = req.body;
        const user = await User.findById(req.user._id);

        if (action === 'like') {
            if (!user.likedSongs.includes(songId)) user.likedSongs.push(songId);
            user.dislikedSongs = user.dislikedSongs.filter(id => id !== songId);
        } else if (action === 'removeLike') { // <-- NEW LOGIC ADDED HERE
            user.likedSongs = user.likedSongs.filter(id => id !== songId);
        } else if (action === 'dislike') {
            if (!user.dislikedSongs.includes(songId)) user.dislikedSongs.push(songId);
            user.likedSongs = user.likedSongs.filter(id => id !== songId);
        } else if (action === 'listen') {
            user.musicHistory = [songId, ...user.musicHistory.filter(id => id !== songId)].slice(0, 50);
        }

        await user.save();
        res.status(200).json({ success: true, likedSongs: user.likedSongs });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET: Infinite Queue Algorithm Generator
userRouter.get('/music/recommendations', protect, async (req, res) => {
    try {
        const { seedSongId, seedArtist } = req.query;
        const user = await User.findById(req.user._id);

        // 1. Sanitize the artist name: take the first primary artist, remove noise
        let cleanArtist = 'Trending';
        if (seedArtist && seedArtist !== 'Playing Now' && seedArtist !== 'Unknown Artist') {
            cleanArtist = seedArtist.split(',')[0].split('&')[0].split('-')[0].trim();
        }

        // 2. Randomize page (1 to 5) so subsequent calls do not return the same songs
        const randomPage = Math.floor(Math.random() * 5) + 1;
        const searchQ = encodeURIComponent(cleanArtist);

        // 3. Fetch from primary or fallback instance
        const primaryUrl = `https://jiosaavn-api-47fm.onrender.com/api/search/songs?query=${searchQ}&page=${randomPage}&limit=25`;
        const fallbackUrl = `https://saavn.sumit.co/api/search/songs?query=${searchQ}&page=${randomPage}&limit=25`;

        let saavnData = null;
        try {
            const primaryRes = await fetch(primaryUrl);
            saavnData = await primaryRes.json();
        } catch (err) {
            console.warn('[Recommendations] Primary API failed, trying fallback...');
            const fallbackRes = await fetch(fallbackUrl);
            saavnData = await fallbackRes.json();
        }

        if (saavnData?.success && saavnData?.data?.results?.length > 0) {
            // 4. Exclude disliked songs
            const dislikedSet = new Set(user?.dislikedSongs || []);
            const likedSet = new Set(user?.likedSongs || []);

            let recommendations = saavnData.data.results.filter(song => !dislikedSet.has(song.id));

            // 5. Rank: liked songs first
            recommendations.sort((a, b) => {
                const aLiked = likedSet.has(a.id) ? 1 : 0;
                const bLiked = likedSet.has(b.id) ? 1 : 0;
                return bLiked - aLiked;
            });

            return res.status(200).json({ success: true, data: recommendations.slice(0, 15) });
        }

        // Return empty array gracefully if no results found
        return res.status(200).json({ success: true, data: [] });
    } catch (error) {
        console.error('[Recommendations Error]:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});
// GET: Liked Songs with Details
userRouter.get('/music/liked', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        // Return early if no liked songs
        if (!user.likedSongs || user.likedSongs.length === 0) {
            return res.status(200).json({ data: [] });
        }

        // Fetch details from Saavn API
        const ids = user.likedSongs.join(',');

        // Use the primary API that works, with a fallback
        const primaryUrl = `https://jiosaavn-api-47fm.onrender.com/api/songs?ids=${ids}`;
        const fallbackUrl = `https://saavn.sumit.co/api/songs?ids=${ids}`;

        let json = null;
        try {
            const primaryRes = await fetch(primaryUrl);
            json = await primaryRes.json();
        } catch (err) {
            console.warn('[Liked Songs] Primary API failed, trying fallback...');
            const fallbackRes = await fetch(fallbackUrl);
            json = await fallbackRes.json();
        }

        if (json && json.success && json.data) {
            // Format to match frontend structure
            const tracks = json.data.map(t => ({
                id: t.id,
                title: t.name,
                artist: t.artists?.primary?.map(a => a.name).join(', ') || 'Unknown',
                image: t.image?.find(i => i.quality === '500x500')?.url || t.image?.[0]?.url,
                url: t.downloadUrl?.find(d => d.quality === '320kbps')?.url || t.downloadUrl?.[0]?.url
            })).filter(t => t.url); // Ensure valid URL

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