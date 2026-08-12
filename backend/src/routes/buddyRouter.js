const express = require('express');
const User = require('../models/User');
const Message = require('../models/Message');
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

        // 🚨 FIX: Convert both IDs to strings for a flawless comparison
        const isAlreadyFriend = receiver.friends.some(id => id.toString() === senderId.toString());
        const hasPendingRequest = receiver.friendRequests.some(id => id.toString() === senderId.toString());

        if (isAlreadyFriend) {
            return res.status(400).json({ message: 'You are already CineBuddies.' });
        }
        if (hasPendingRequest) {
            return res.status(400).json({ message: 'Cinerequest already sent.' });
        }

        // Add to requests
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
            const savedNotification = receiver.notifications[receiver.notifications.length - 1];
            globalNamespace.to(receiverSocketId).emit('new_notification', savedNotification);
        } else {
            if (receiver.expoPushToken && Expo.isExpoPushToken(receiver.expoPushToken)) {
                let expo = new Expo();
                let pushMessages = [{
                    to: receiver.expoPushToken,
                    sound: 'default',
                    title: '👋 New Cinerequest!',
                    body: `${sender.name} sent you a Cinerequest.`,
                    data: { type: 'CINEREQUEST', senderId: sender._id },
                }];
                try { await expo.sendPushNotificationsAsync(pushMessages); } catch (pushErr) { }
            }
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

        if (!senderId) {
            return res.status(400).json({ message: "Invalid sender ID provided" });
        }

        const user = await User.findById(userId);
        const sender = await User.findById(senderId);

        if (!user || !sender) {
            return res.status(404).json({ message: 'User or Sender not found' });
        }

        // 1. Clean up friend request array
        user.friendRequests = user.friendRequests.filter(id => id.toString() !== senderId.toString());

        // 2. Clear the notification card (safely handles missing notificationId)
        if (notificationId) {
            user.notifications = user.notifications.filter(n => n._id.toString() !== notificationId);
        } else {
            user.notifications = user.notifications.filter(n =>
                !(n.type === 'CINEREQUEST' && n.senderId.toString() === senderId.toString())
            );
        }

        // 3. Add to both friends arrays safely
        if (!user.friends.some(id => id.toString() === senderId.toString())) {
            user.friends.push(senderId);
        }
        if (!sender.friends.some(id => id.toString() === userId.toString())) {
            sender.friends.push(userId);
        }

        // 4. Alert sender (User A) that their request was accepted
        const acceptanceNotification = {
            type: 'ACCEPTED_ALERT',
            senderId: userId,
            message: `${user.name} accepted your Cinerequest.`
        };
        sender.notifications.push(acceptanceNotification);

        await user.save();
        await sender.save();

        // 5. Initialize Socket & Push logic
        const globalNamespace = req.app.locals.globalNamespace;
        const onlineUsers = req.app.locals.onlineUsers;
        const senderSocketId = onlineUsers.get(senderId.toString());

        if (senderSocketId) {
            const savedAcceptance = sender.notifications[sender.notifications.length - 1];
            globalNamespace.to(senderSocketId).emit('new_notification', savedAcceptance);
        } else {
            if (sender.expoPushToken && Expo.isExpoPushToken(sender.expoPushToken)) {
                let expo = new Expo();
                let pushMessages = [{
                    to: sender.expoPushToken,
                    sound: 'default',
                    title: '🎉 Cinerequest Accepted!',
                    body: `${user.name} accepted your Cinerequest. You are now CineBuddies!`,
                    data: { type: 'CINEREQUEST_ACCEPTED', buddyId: user._id },
                }];
                try { await expo.sendPushNotificationsAsync(pushMessages); } catch (pushErr) { }
            }
        }

        res.status(200).json({ message: 'Cinerequest accepted' });
    } catch (error) {
        console.error("Accept Error:", error);
        res.status(500).json({ message: 'Error accepting request' });
    }
});


// 4. REJECT REQUEST
buddyRouter.post('/reject', protect, async (req, res) => {
    try {
        const { notificationId, senderId } = req.body;
        const userId = req.user._id;

        if (!senderId) {
            return res.status(400).json({ message: "Invalid sender ID" });
        }

        const user = await User.findById(userId);
        const sender = await User.findById(senderId);

        if (!user || !sender) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 1. Clean up friend request array
        user.friendRequests = user.friendRequests.filter(id => id.toString() !== senderId.toString());

        // 2. Clear the notification card (safely handles missing notificationId)
        if (notificationId) {
            user.notifications = user.notifications.filter(n => n._id.toString() !== notificationId);
        } else {
            user.notifications = user.notifications.filter(n =>
                !(n.type === 'CINEREQUEST' && n.senderId.toString() === senderId.toString())
            );
        }

        await user.save();

        // 3. Create and save rejection alert for the sender
        const rejectionAlert = {
            type: 'REJECTED_ALERT',
            senderId: userId,
            message: `${user.name} rejected your Cinerequest.`
        };
        sender.notifications.push(rejectionAlert);
        await sender.save();

        // 4. Initialize Socket & Push logic
        const globalNamespace = req.app.locals.globalNamespace;
        const onlineUsers = req.app.locals.onlineUsers;
        const senderSocketId = onlineUsers.get(senderId.toString());

        if (senderSocketId) {
            const savedRejection = sender.notifications[sender.notifications.length - 1];
            globalNamespace.to(senderSocketId).emit('request_rejected', savedRejection);
        } else {
            if (sender.expoPushToken && Expo.isExpoPushToken(sender.expoPushToken)) {
                let expo = new Expo();
                let pushMessages = [{
                    to: sender.expoPushToken,
                    sound: 'default',
                    title: 'Cinerequest Update',
                    body: `${user.name} rejected your Cinerequest.`,
                    data: { type: 'REJECTED_ALERT' },
                }];
                try {
                    await expo.sendPushNotificationsAsync(pushMessages);
                } catch (pushErr) {
                    console.error('Expo Push Failed:', pushErr);
                }
            }
        }

        res.status(200).json({ message: 'Cinerequest rejected' });

    } catch (error) {
        console.error('Reject Request Error:', error);
        res.status(500).json({ message: 'Error rejecting request' });
    }
});

// 5. UNFRIEND ROUTE
buddyRouter.post('/unfriend', protect, async (req, res) => {
    try {
        const { friendId } = req.body;
        const userId = req.user._id;

        // 1. Remove from friends AND clear any stale friendRequests between them
        await User.findByIdAndUpdate(userId, {
            $pull: {
                friends: friendId,
                friendRequests: friendId,
                'notifications': { senderId: friendId } // Optional: clears old cards
            }
        });

        await User.findByIdAndUpdate(friendId, {
            $pull: {
                friends: userId,
                friendRequests: userId,
                'notifications': { senderId: userId }
            }
        });

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

// 7. GET FRIENDS LIST
buddyRouter.get('/list', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('friends', 'name email profilePicture');
        const onlineUsers = req.app.locals.onlineUsers;

        const friendsWithUnreadCounts = await Promise.all(user.friends.map(async (friend) => {
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
            const savedNotification = receiver.notifications[receiver.notifications.length - 1];
            globalNamespace.to(receiverSocketId).emit('new_notification', savedNotification);
        } else {
            if (receiver.expoPushToken && Expo.isExpoPushToken(receiver.expoPushToken)) {
                let expo = new Expo();
                let messages = [{
                    to: receiver.expoPushToken,
                    sound: 'default',
                    title: '🎬 CinePlay Invite',
                    body: notificationMessage,
                    data: { roomId: roomId, type: 'THEATRE_INVITE' },
                }];
                try { await expo.sendPushNotificationsAsync(messages); } catch (pushErr) { }
            }
        }

        res.status(200).json({ message: 'Invite sent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error sending invite' });
    }
});

// 9. GET DISCOVER DATA
buddyRouter.get('/discover', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        // 1. Get Friends and Received Requests
        const user = await User.findById(userId)
            .populate('friends', '_id name email profilePicture')
            .populate('friendRequests', '_id name email profilePicture');

        // 2. Get Sent Requests (Users who have MY id in their friendRequests array)
        const sentRequests = await User.find({ friendRequests: userId })
            .select('_id name email profilePicture');

        res.status(200).json({
            friends: user.friends,
            received: user.friendRequests,
            sent: sentRequests
        });
    } catch (error) {
        console.error("Discover Error:", error);
        res.status(500).json({ message: 'Error fetching discover data' });
    }
});
module.exports = buddyRouter;