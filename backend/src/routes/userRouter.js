const express = require('express');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

const userRouter = express.Router();

// Get User's Lists
userRouter.get('/lists', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.status(200).json({
            watchlist: user.watchlist,
            watched: user.watched
        });
    } catch (error) {
        console.error('Error fetching lists:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

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

module.exports = userRouter;