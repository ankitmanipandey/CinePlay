const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { Expo } = require('expo-server-sdk');

const chatRouter = express.Router();

// 1. GET TOTAL UNREAD CHATS COUNT
chatRouter.get('/unread-count', protect, async (req, res) => {
    try {
        const count = await Message.countDocuments({ receiver: req.user._id, isRead: { $ne: true } });
        res.status(200).json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching unread count' });
    }
});

// 2. GET CHAT HISTORY & BUDDY INFO
chatRouter.get('/:buddyId', protect, async (req, res) => {
    try {
        const buddy = await User.findById(req.params.buddyId).select('name email profilePicture friends');
        if (!buddy) return res.status(404).json({ message: 'Buddy not found' });

        const isFriend = buddy.friends.some(id => id.toString() === req.user._id.toString());

        const messages = await Message.find({
            $or: [
                { sender: req.user._id, receiver: req.params.buddyId },
                { sender: req.params.buddyId, receiver: req.user._id }
            ]
        }).sort('createdAt');

        const globalNamespace = req.app.locals.globalNamespace;

        // Native Socket.IO check for active connections
        const sockets = await globalNamespace.in(req.params.buddyId.toString()).fetchSockets();
        const isOnline = sockets.length > 0;

        const { friends, ...buddyPublic } = buddy.toObject();

        res.status(200).json({
            buddy: { ...buddyPublic, isOnline },
            isFriend,
            messages
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching chat history' });
    }
});

// 3. SEND DIRECT MESSAGE & PUSH NOTIFICATION
chatRouter.post('/send', protect, async (req, res) => {
    try {
        const { receiverId, text } = req.body;

        // 🚨 SECURITY GATEKEEPER: Check if they are friends BEFORE creating message
        const receiverUser = await User.findById(receiverId);
        if (!receiverUser) return res.status(404).json({ message: 'User not found' });

        const areFriends = receiverUser.friends.some(id => id.toString() === req.user._id.toString());
        if (!areFriends) {
            return res.status(403).json({ message: 'You can no longer message this user because you are not friends.' });
        }

        const newMessage = await Message.create({
            sender: req.user._id,
            receiver: receiverId,
            text,
            isRead: false
        });

        const senderUser = await User.findById(req.user._id);

        const cleanMessage = {
            _id: newMessage._id.toString(),
            sender: newMessage.sender.toString(),
            senderName: senderUser.name,
            receiver: newMessage.receiver.toString(),
            text: newMessage.text,
            createdAt: newMessage.createdAt
        };

        const globalNamespace = req.app.locals.globalNamespace;

        // Emit directly to the receiver's room (handles multiple devices instantly)
        globalNamespace.to(receiverId.toString()).emit('receive_direct_message', cleanMessage);
        globalNamespace.to(req.user._id.toString()).emit('receive_direct_message', cleanMessage);

        // Fetch active sockets to see if a push notification is needed
        const sockets = await globalNamespace.in(receiverId.toString()).fetchSockets();

        if (sockets.length === 0 && receiverUser.expoPushToken && Expo.isExpoPushToken(receiverUser.expoPushToken)) {
            let expo = new Expo();
            let pushMessages = [{
                to: receiverUser.expoPushToken,
                sound: 'default',
                title: senderUser.name,
                body: text,
                data: { buddyId: senderUser._id, type: 'NEW_CHAT' },
            }];
            try { await expo.sendPushNotificationsAsync(pushMessages); } catch (pushErr) { }
        }

        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ message: 'Error sending message' });
    }
});

// 4. MARK MESSAGES AS READ & NOTIFY CLIENT
chatRouter.put('/mark-read', protect, async (req, res) => {
    try {
        const { buddyId } = req.body;

        // Use $ne: true to catch any undefined/legacy messages
        const result = await Message.updateMany(
            { sender: buddyId, receiver: req.user._id, isRead: { $ne: true } },
            { $set: { isRead: true } }
        );

        const globalNamespace = req.app.locals.globalNamespace;

        // Notify the reader's own client(s) directly via their room so badges decrement immediately
        if (result.modifiedCount > 0) {
            globalNamespace.to(req.user._id.toString()).emit('messages_read', { count: result.modifiedCount });
        }

        res.status(200).json({ message: 'Messages marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error marking messages as read' });
    }
});

module.exports = chatRouter;