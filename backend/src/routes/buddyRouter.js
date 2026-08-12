const express = require('express');
const User = require('../models/User');
const Message = require('../models/Message'); // <-- IMPORT MESSAGE MODEL
const { protect } = require('../middleware/authMiddleware');
const { Expo } = require('expo-server-sdk');

const buddyRouter = express.Router();

// 1. SEARCH USERS
buddyRouter.get('/search', protect, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(200).json([]);

        const users = await User.find({
            _id: { $ne: req.user._id },
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        }).select('_id name email profilePicture');

        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error searching users' });
    }
});

// 2. SEND CINEREQUEST
buddyRouter.post('/request', protect, async (req, res) => {
    try {
        const { receiverId } = req.body;
        const senderId = req.user._id;

        const receiver = await User.findById(receiverId);
        const sender = await User.findById(senderId);

        if (!receiver) return res.status(404).json({ message: 'User not found' });
        if (receiver.friends.includes(senderId) || receiver.friendRequests.includes(senderId)) {
            return res.status(400).json({ message: 'Request already sent or already friends' });
        }

        receiver.friendRequests.push(senderId);
        const newNotification = {
            type: 'CINEREQUEST',
            senderId: senderId,
            message: `${sender.name} sent you a Cinerequest.`
        };
        receiver.notifications.push(newNotification);
        await receiver.save();

        const globalNamespace = req.app.locals.globalNamespace;
        const onlineUsers = req.app.locals.onlineUsers;
        const receiverSocketId = onlineUsers.get(receiverId.toString());

        if (receiverSocketId) {
            globalNamespace.to(receiverSocketId).emit('new_notification', newNotification);
        }

        res.status(200).json({ message: 'Cinerequest sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error sending request' });
    }
});

// 3. ACCEPT REQUEST
buddyRouter.post('/accept', protect, async (req, res) => {
    try {
        const { notificationId, senderId } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);
        const sender = await User.findById(senderId);

        user.friendRequests = user.friendRequests.filter(id => id.toString() !== senderId.toString());
        if (!user.friends.includes(senderId)) user.friends.push(senderId);
        if (!sender.friends.includes(userId)) sender.friends.push(userId);

        user.notifications = user.notifications.filter(n => n._id.toString() !== notificationId);

        await user.save();
        await sender.save();

        res.status(200).json({ message: 'Cinerequest accepted' });
    } catch (error) {
        res.status(500).json({ message: 'Error accepting request' });
    }
});

// 4. REJECT REQUEST
buddyRouter.post('/reject', protect, async (req, res) => {
    try {
        const { notificationId, senderId } = req.body;
        const userId = req.user._id;

        const user = await User.findById(userId);
        const sender = await User.findById(senderId);

        user.friendRequests = user.friendRequests.filter(id => id.toString() !== senderId.toString());
        user.notifications = user.notifications.filter(n => n._id.toString() !== notificationId);
        await user.save();

        const rejectionAlert = {
            type: 'REJECTED_ALERT',
            senderId: userId,
            message: `${user.name} rejected your Cinerequest.`
        };
        sender.notifications.push(rejectionAlert);
        await sender.save();

        const globalNamespace = req.app.locals.globalNamespace;
        const onlineUsers = req.app.locals.onlineUsers;
        const senderSocketId = onlineUsers.get(senderId.toString());

        if (senderSocketId) {
            globalNamespace.to(senderSocketId).emit('request_rejected', rejectionAlert);
        }

        res.status(200).json({ message: 'Cinerequest rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting request' });
    }
});

// 5. UNFRIEND ROUTE
// 5. UNFRIEND ROUTE
buddyRouter.post('/unfriend', protect, async (req, res) => {
    try {
        const { friendId } = req.body;
        const userId = req.user._id;

        await User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
        await User.findByIdAndUpdate(friendId, { $pull: { friends: userId } });

        // 🚨 REAL-TIME NOTIFICATION: Tell the friend they were removed
        const globalNamespace = req.app.locals.globalNamespace;
        const onlineUsers = req.app.locals.onlineUsers;

        const friendSocketId = onlineUsers.get(friendId.toString());
        if (friendSocketId) {
            globalNamespace.to(friendSocketId).emit('friend_removed', {
                unfriendedBy: userId.toString()
            });
        }

        res.status(200).json({ message: 'Removed from CineBuddies' });
    } catch (error) {
        res.status(500).json({ message: 'Error unfriending user' });
    }
});

// 6. GET NOTIFICATIONS
buddyRouter.get('/notifications', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('notifications.senderId', 'name email profilePicture');
        res.status(200).json(user.notifications.sort((a, b) => b.createdAt - a.createdAt));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications' });
    }
});

// 7. GET FRIENDS LIST (WITH UNREAD COUNTS)
buddyRouter.get('/list', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('friends', 'name email profilePicture');
        const onlineUsers = req.app.locals.onlineUsers;

        const friendsWithUnreadCounts = await Promise.all(user.friends.map(async (friend) => {
            // 🚨 FIX: Use $ne: true to ensure we count all unread messages
            const unreadCount = await Message.countDocuments({
                sender: friend._id,
                receiver: req.user._id,
                isRead: { $ne: true }
            });

            return {
                ...friend.toObject(),
                unreadCount,
                isOnline: onlineUsers ? onlineUsers.has(friend._id.toString()) : false
            };
        }));

        res.status(200).json(friendsWithUnreadCounts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching friends list' });
    }
});

// 8. SEND THEATRE INVITE & NATIVE PUSH
buddyRouter.post('/invite', protect, async (req, res) => {
    // ... KEEP YOUR EXACT EXISTING INVITE LOGIC HERE ...
    try {
        const { receiverId, roomId, videoTitle } = req.body;
        const senderId = req.user._id;
        const receiver = await User.findById(receiverId);
        const sender = await User.findById(senderId);

        if (!receiver) return res.status(404).json({ message: 'User not found' });

        const rooms = req.app.locals.rooms;
        const room = rooms ? rooms[roomId] : null;

        if (room && room.hostUserId) {
            const hostUser = await User.findById(room.hostUserId);
            if (hostUser && hostUser.blockedUsers.includes(receiverId)) {
                return res.status(403).json({ message: 'Your Friend is blocked by Creator.' });
            }
            if (room.hostUserId.toString() === senderId.toString()) {
                room.preApprovedUsers = room.preApprovedUsers || [];
                if (!room.preApprovedUsers.includes(receiverId.toString())) {
                    room.preApprovedUsers.push(receiverId.toString());
                }
            }
        }

        const displayTitle = videoTitle ? `"${videoTitle}"` : 'a video';
        const notificationMessage = `You got a Theatre Invite from ${sender.name} for ${displayTitle}, click to join`;

        const newNotification = {
            type: 'THEATRE_INVITE',
            senderId: senderId,
            roomId: roomId,
            message: notificationMessage
        };
        receiver.notifications.push(newNotification);
        await receiver.save();

        const globalNamespace = req.app.locals.globalNamespace;
        const onlineUsers = req.app.locals.onlineUsers;
        const receiverSocketId = onlineUsers.get(receiverId.toString());

        if (receiverSocketId) {
            globalNamespace.to(receiverSocketId).emit('new_notification', newNotification);
        }

        if (receiver.expoPushToken && Expo.isExpoPushToken(receiver.expoPushToken)) {
            let expo = new Expo();
            let messages = [{
                to: receiver.expoPushToken,
                sound: 'default',
                title: '🎬 CinePlay Invite',
                body: notificationMessage,
                data: { roomId: roomId, type: 'THEATRE_INVITE' },
            }];

            try {
                await expo.sendPushNotificationsAsync(messages);
            } catch (pushErr) {
                console.error('Push notification failed:', pushErr);
            }
        }

        res.status(200).json({ message: 'Invite sent successfully' });
    } catch (error) {
        console.error("Invite Error:", error);
        res.status(500).json({ message: 'Error sending invite' });
    }
});

module.exports = buddyRouter;