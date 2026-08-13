const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();
const connectDB = require('../database/connectDB');
const authRouter = require('../routes/authRouter');
const userRouter = require('../routes/userRouter');
const aiRouter = require('../routes/aiRouter');
const serverAwake = require('../jobs/serverAwake');
const buddyRouter = require('../routes/buddyRouter');
const chatRouter = require('../routes/chatRouter');
const User = require('../models/User');

const app = express();

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(express.json());

app.get('/', (req, res) => { res.status(200).send('Server is awake'); });

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/ai', aiRouter);
app.use('/api/buddies', buddyRouter);
app.use('/api/chat', chatRouter);

// =========================================================
// 1. THEATRE MODE SOCKET NAMESPACE (/api)
// =========================================================
const rooms = {};
const apiNamespace = io.of('/api');

// Export rooms so we can check if they exist in Phase 4 (Room Expiration Check)
module.exports.rooms = rooms;

function emitRoomUsers(roomId) {
    const state = rooms[roomId];
    const userList = state?.users ? Object.values(state.users) : [];
    apiNamespace.to(roomId).emit('room_users', userList);
}

apiNamespace.on('connection', (socket) => {

    socket.on('join_room', async ({ roomId, username, isHost, userId }) => {
        // SECURITY CHECK: Room existence
        if (!isHost && !rooms[roomId]) {
            return socket.emit('room_not_found');
        }

        if (isHost) {
            // Host creates/joins the room unconditionally
            socket.join(roomId);
            socket.data.roomId = roomId;
            socket.data.username = username;

            // NEW: Initialize Memory Block & Pre-Approve Arrays for the room
            rooms[roomId] = rooms[roomId] || { users: {}, blockedUsers: [], preApprovedUsers: [] };
            rooms[roomId].hostSocketId = socket.id;
            rooms[roomId].hostUserId = userId; // Save Host's DB ID to check relationships later
            rooms[roomId].users[socket.id] = username;

            emitRoomUsers(roomId);
        } else {
            // Viewer joining - The Gatekeeper Check
            const room = rooms[roomId];

            try {
                // If they are a guest (no userId), instantly reject or make them ask. We will make them ask.
                if (!userId || !room.hostUserId) {
                    return askPermission();
                }

                // 1. Check if Blocked FOR THIS SPECIFIC ROOM (Memory Check)
                const isBlocked = room.blockedUsers && room.blockedUsers.includes(userId.toString());
                if (isBlocked) {
                    return socket.emit('entry_denied', { reason: 'You have been blocked from this specific room.' });
                }

                // 2. Check if Pre-Approved (Host invited them, bypassing blocks/knocking)
                const isPreApproved = room.preApprovedUsers && room.preApprovedUsers.includes(userId.toString());
                if (isPreApproved) {
                    return completeJoin();
                }

                // 3. Check if Direct Friend
                const hostUser = await User.findById(room.hostUserId);
                if (!hostUser) return socket.emit('room_not_found');

                const isFriend = hostUser.friends.some(id => id.toString() === userId.toString());
                if (isFriend) {
                    return completeJoin();
                } else {
                    // 4. Friend of Friend - Must ask permission
                    return askPermission();
                }
            } catch (err) {
                return socket.emit('room_not_found');
            }
        }

        function askPermission() {
            socket.emit('waiting_for_host');
            apiNamespace.to(rooms[roomId].hostSocketId).emit('request_host_permission', {
                joinerSocketId: socket.id,
                joinerId: userId,
                joinerName: username
            });
        }

        function completeJoin() {
            socket.join(roomId);
            socket.data.roomId = roomId;
            socket.data.username = username;
            socket.data.userId = userId; // 👈 Save the DB ID so we can block them later!
            rooms[roomId].users[socket.id] = username;

            const state = rooms[roomId];
            if (state.ytId) {
                socket.emit('new_video', { ytId: state.ytId, title: state.title });
                socket.emit('remote_sync', {
                    action: state.isPlaying ? 'play' : 'pause',
                    timestamp: state.timestamp || 0,
                });
            }
            emitRoomUsers(roomId);
        }
    });

    // Handle Host's Decision (Allow / Reject / Block)
    socket.on('host_decision', async ({ joinerSocketId, joinerId, joinerName, decision, roomId, hostUserId }) => {
        const joinerSocket = apiNamespace.sockets.get(joinerSocketId);
        if (!joinerSocket) return; // User disconnected while waiting

        if (decision === 'ALLOW') {
            joinerSocket.join(roomId);
            joinerSocket.data.roomId = roomId;
            joinerSocket.data.username = joinerName;
            joinerSocket.data.userId = joinerId; // 👈 Save the DB ID here too!
            rooms[roomId].users[joinerSocketId] = joinerName;

            joinerSocket.emit('entry_approved');

            const state = rooms[roomId];
            if (state.ytId) {
                joinerSocket.emit('new_video', { ytId: state.ytId, title: state.title });
                joinerSocket.emit('remote_sync', {
                    action: state.isPlaying ? 'play' : 'pause',
                    timestamp: state.timestamp || 0,
                });
            }
            emitRoomUsers(roomId);
        } else if (decision === 'REJECT') {
            joinerSocket.emit('entry_denied', { reason: 'The host declined your request to join.' });
        } else if (decision === 'BLOCK') {
            joinerSocket.emit('entry_denied', { reason: 'You have been blocked from this specific room.' });

            // Add to Room's Memory Block List (Not MongoDB)
            if (joinerId) {
                rooms[roomId].blockedUsers = rooms[roomId].blockedUsers || [];
                if (!rooms[roomId].blockedUsers.includes(joinerId.toString())) {
                    rooms[roomId].blockedUsers.push(joinerId.toString());
                }
            }
        }
    });

    // ... KEEP YOUR EXISTING change_video, sync_action, send_chat, close_room, and disconnect EVENTS HERE ...
    socket.on('change_video', (data) => {
        rooms[data.roomId] = { ...rooms[data.roomId], ytId: data.ytId, title: data.title, isPlaying: true, timestamp: 0 };
        socket.to(data.roomId).emit('new_video', data);
    });
    socket.on('sync_action', (data) => {
        if (rooms[data.roomId]) { rooms[data.roomId].isPlaying = data.action === 'play'; rooms[data.roomId].timestamp = data.timestamp; }
        socket.to(data.roomId).emit('remote_sync', data);
    });
    socket.on('send_chat', (data) => { socket.to(data.roomId).emit('receive_chat', data); });
    socket.on('close_room', (roomId) => { delete rooms[roomId]; socket.to(roomId).emit('room_closed'); });

    // --- MODERATION: KICK USER ---
    socket.on('kick_user', ({ roomId, targetUsername }) => {
        const room = rooms[roomId];
        if (!room) return;

        // Find the socket ID of the user being kicked
        let targetSocketId = null;
        for (const [sId, uname] of Object.entries(room.users)) {
            if (uname === targetUsername) { targetSocketId = sId; break; }
        }

        if (targetSocketId) {
            const targetSocket = apiNamespace.sockets.get(targetSocketId);
            if (targetSocket) {
                targetSocket.emit('kicked_from_room', { reason: 'You were kicked from the room by the host.' });
                targetSocket.leave(roomId); // Forcibly remove them from the socket room
            }
            // Remove from tracking and update everyone else
            delete room.users[targetSocketId];
            emitRoomUsers(roomId);
        }
    });

    // --- MODERATION: KICK AND BLOCK USER ---
    socket.on('kick_and_block_user', async ({ roomId, targetUsername, hostUserId }) => {
        const room = rooms[roomId];
        if (!room) return;

        let targetSocketId = null;
        for (const [sId, uname] of Object.entries(room.users)) {
            if (uname === targetUsername) { targetSocketId = sId; break; }
        }

        if (targetSocketId) {
            const targetSocket = apiNamespace.sockets.get(targetSocketId);
            let targetUserId = null;

            if (targetSocket) {
                targetUserId = targetSocket.data.userId; // We saved this during join_room!
                targetSocket.emit('kicked_from_room', { reason: 'You were blocked by the host for this room.' });
                targetSocket.leave(roomId);
            }

            delete room.users[targetSocketId];
            emitRoomUsers(roomId);

            // Add to Room's Memory Block List (Not MongoDB)
            if (targetUserId) {
                rooms[roomId].blockedUsers = rooms[roomId].blockedUsers || [];
                if (!rooms[roomId].blockedUsers.includes(targetUserId.toString())) {
                    rooms[roomId].blockedUsers.push(targetUserId.toString());
                }
            }
        }
    });

    socket.on('disconnect', () => {
        const roomId = socket.data.roomId;

        if (roomId && rooms[roomId]) {
            // FAILSAFE: Check if the user who just disconnected is the Host
            if (rooms[roomId].hostSocketId === socket.id) {
                // The Host left! Notify viewers and destroy the room
                socket.to(roomId).emit('room_closed');
                delete rooms[roomId];
                console.log(`[Room ${roomId}] Host disconnected. Room destroyed.`);
            } else {
                // A normal viewer left
                if (rooms[roomId].users) {
                    delete rooms[roomId].users[socket.id];

                    // If room is empty, clean it up
                    if (Object.keys(rooms[roomId].users).length === 0) {
                        delete rooms[roomId];
                    } else {
                        emitRoomUsers(roomId);
                    }
                }
            }
        }
    });
});

// =========================================================
// 2. GLOBAL SOCKET NAMESPACE (/global) for CineBuddies
// =========================================================
const globalNamespace = io.of('/global');
const onlineUsers = new Map(); // Tracks online users: userId -> socket.id
app.locals.globalNamespace = globalNamespace;
app.locals.onlineUsers = onlineUsers;
app.locals.rooms = rooms;

// Export them for use in future Notification/Buddy API Routes
module.exports.onlineUsers = onlineUsers;
module.exports.globalNamespace = globalNamespace;

globalNamespace.on('connection', (socket) => {
    socket.on('register_user', (userId) => {
        if (userId) {
            const uid = userId.toString();
            onlineUsers.set(uid, socket.id);
            socket.data.userId = uid;

            // Broadcast to everyone that this user is online
            globalNamespace.emit('user_status', { userId: uid, isOnline: true });
        }
    });

    socket.on('disconnect', () => {
        const userId = socket.data.userId;

        if (userId && onlineUsers.get(userId) === socket.id) {
            onlineUsers.delete(userId);

            // Broadcast to everyone that this user is offline
            globalNamespace.emit('user_status', { userId: userId, isOnline: false });
        }
    });
});


// =========================================================
// START SERVER
// =========================================================
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        server.listen(PORT, () => {
            console.log(`Server & WebSockets ONLINE on port ${PORT}`);
            serverAwake();
        });
    } catch (error) {
        console.error('Failed to connect to the database. Server not started.', error);
        process.exit(1);
    }
};

startServer();  