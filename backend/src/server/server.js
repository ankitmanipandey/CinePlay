const express = require('express');
const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
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
const mediaRouter = require('../routes/mediaRouter');
const { protect } = require('../middleware/authMiddleware');

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
app.use('/api/media', mediaRouter);

// A stray rejected promise must never take the whole server down.
process.on('unhandledRejection', (err) => {
    console.error('[server] Unhandled rejection:', err);
});

// =========================================================
// 1. THEATRE MODE SOCKET NAMESPACE (/api)
// =========================================================
// Room shape (kept compatible with the buddy routes that use app.locals.rooms):
// {
//   users:            { [socketId]: username }   // admitted users in join order -> first key is next host
//   pending:          { [socketId]: { joinerSocketId, joinerId, joinerName } }  // knocking, not admitted yet
//   blockedUsers:     [userId],
//   preApprovedUsers: [userId],
//   hostSocketId, hostUserId,
//   ytId, title, isPlaying, timestamp
// }
const rooms = {};
const apiNamespace = io.of('/api');

// Export rooms so we can check if they exist in Phase 4 (Room Expiration Check)
module.exports.rooms = rooms;

// ---------- helpers ----------
const asId = (v) => (v === undefined || v === null || v === '' ? null : String(v));
const getLiveSocket = (socketId) => (socketId ? apiNamespace.sockets.get(socketId) : undefined);

// Wrap every handler so one bad payload can never crash the process
const safe = (fn) => async (...args) => {
    try {
        await fn(...args);
    } catch (err) {
        console.error('[theatre] handler error:', err);
    }
};

function emitRoomUsers(roomId) {
    const state = rooms[roomId];
    const userList = state?.users ? Object.values(state.users) : [];
    apiNamespace.to(roomId).emit('room_users', userList);
}

function sendVideoState(socket, room) {
    if (!room.ytId) return;
    socket.emit('new_video', { ytId: room.ytId, title: room.title });
    socket.emit('remote_sync', {
        action: room.isPlaying ? 'play' : 'pause',
        timestamp: room.timestamp || 0,
    });
}

// Destroys the room and tells anyone still knocking that it is gone
function destroyRoom(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    for (const pendingSocketId of Object.keys(room.pending || {})) {
        const s = getLiveSocket(pendingSocketId);
        if (s) {
            s.data.pendingRoomId = null;
            s.emit('room_not_found');
        }
    }
    delete rooms[roomId];
}

function findSocketIdByUsername(room, username, excludeSocketId) {
    for (const [sId, uname] of Object.entries(room.users || {})) {
        if (sId !== excludeSocketId && uname === username) return sId;
    }
    return null;
}

// Removes a user from the room and tells them why. Returns their DB user id (if any).
function kickFromRoom(roomId, room, targetSocketId, reason) {
    const targetSocket = getLiveSocket(targetSocketId);
    const targetUserId = targetSocket ? asId(targetSocket.data.userId) : null;
    if (targetSocket) {
        targetSocket.emit('kicked_from_room', { reason });
        targetSocket.leave(roomId);
        targetSocket.data.roomId = null; // so its later disconnect does not touch this room
    }
    delete room.users[targetSocketId];
    emitRoomUsers(roomId);
    return targetUserId;
}

// The host left: hand the room to the oldest surviving user, or destroy it if nobody is left
function migrateHost(roomId, room) {
    let newHostSocketId = null;
    for (const sId of Object.keys(room.users)) {
        if (getLiveSocket(sId)) { newHostSocketId = sId; break; }
        delete room.users[sId]; // dead entry, clean it up
    }

    if (!newHostSocketId) {
        destroyRoom(roomId);
        console.log(`[Room ${roomId}] Empty. Room destroyed.`);
        return;
    }

    const newHostSocket = getLiveSocket(newHostSocketId);
    room.hostSocketId = newHostSocketId;
    room.hostUserId = asId(newHostSocket.data.userId);

    newHostSocket.emit('role_assigned', { isHost: true });
    newHostSocket.emit('host_migrated');
    emitRoomUsers(roomId);

    // Anyone still knocking must now be answered by the new host
    for (const request of Object.values(room.pending || {})) {
        newHostSocket.emit('request_host_permission', request);
    }
    console.log(`[Room ${roomId}] Host migrated to ${room.users[newHostSocketId]}`);
}

// ---------------------------------------------------------
// SOCKET AUTH: identity comes from the JWT, never from the payload.
// Same token the REST routes use (payload shape: { id }). No/invalid token = guest.
// ---------------------------------------------------------
apiNamespace.use((socket, next) => {
    socket.data.authUserId = null;
    const token = socket.handshake?.auth?.token;
    if (token && token !== 'null' && token !== 'undefined') {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.data.authUserId = asId(decoded.id);
        } catch (err) {
            console.log('[theatre] Invalid or expired token, connecting as guest');
        }
    }
    next();
});

// ---------------------------------------------------------
// ROOM CODES ARE ISSUED BY THE SERVER (POST /api/rooms, logged-in users only).
// The room is reserved for its creator; if the host never shows up it expires.
// ---------------------------------------------------------
const ROOM_CLAIM_TIMEOUT_MS = 2 * 60 * 1000;

app.post('/api/rooms', protect, (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Not authorized' });

        let roomId = null;
        for (let i = 0; i < 25 && !roomId; i++) {
            const candidate = String(crypto.randomInt(10000, 100000)); // 5 digits, same as before
            if (!rooms[candidate]) roomId = candidate;
        }
        if (!roomId) return res.status(503).json({ message: 'Could not allocate a room, try again' });

        rooms[roomId] = {
            users: {},
            pending: {},
            blockedUsers: [],
            preApprovedUsers: [],
            hostSocketId: null,
            hostUserId: asId(req.user._id),
            reserved: true,
        };

        const expiry = setTimeout(() => {
            const r = rooms[roomId];
            if (r && r.reserved) {
                apiNamespace.to(roomId).emit('room_closed');
                destroyRoom(roomId);
            }
        }, ROOM_CLAIM_TIMEOUT_MS);
        if (expiry.unref) expiry.unref();

        return res.status(201).json({ roomId });
    } catch (err) {
        console.error('[rooms] create error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

apiNamespace.on('connection', (socket) => {

    // ---------------------------------------------------------
    // JOIN
    // ---------------------------------------------------------
    socket.on('join_room', safe(async (payload = {}) => {
        const roomId = asId(payload.roomId);
        if (!roomId) return;

        const username = payload.username || 'Guest';
        const uid = socket.data.authUserId || null; // from the verified token, payload.userId is ignored
        let room = rooms[roomId];

        // The server decides who is host, not the client.
        //  - no room yet: a logged-in user may create it (guests cannot host)
        //  - room exists: only the same DB user as the room's host may take the seat
        //    (creator claiming a reserved room, or the host reconnecting from a stale socket)
        let becomesHost = false;
        if (payload.isHost) {
            if (!room) {
                becomesHost = !!uid;
            } else {
                becomesHost = !!uid && uid === asId(room.hostUserId);
            }
        }

        // ----- HOST -----
        if (becomesHost) {
            if (!room) {
                room = rooms[roomId] = { users: {}, pending: {}, blockedUsers: [], preApprovedUsers: [] };
            } else if (room.hostSocketId && room.hostSocketId !== socket.id) {
                delete room.users[room.hostSocketId]; // drop the stale socket of the same host
            }

            socket.join(roomId);
            socket.data.roomId = roomId;
            socket.data.username = username;
            socket.data.userId = uid;

            room.hostSocketId = socket.id;
            room.hostUserId = uid;
            room.reserved = false;
            room.users[socket.id] = username;

            socket.emit('role_assigned', { isHost: true });
            emitRoomUsers(roomId);

            for (const request of Object.values(room.pending || {})) {
                socket.emit('request_host_permission', request);
            }
            return;
        }

        // ----- VIEWER -----
        if (!room || !room.hostSocketId) return socket.emit('room_not_found');

        function completeJoin(r) {
            socket.join(roomId);
            socket.data.roomId = roomId;
            socket.data.username = username;
            socket.data.userId = uid; // saved so the host can block them later
            socket.data.pendingRoomId = null;

            r.users[socket.id] = username;
            if (r.pending) delete r.pending[socket.id];

            socket.emit('role_assigned', { isHost: false });
            sendVideoState(socket, r);
            emitRoomUsers(roomId);
        }

        function askPermission(r) {
            r.pending = r.pending || {};
            r.pending[socket.id] = { joinerSocketId: socket.id, joinerId: uid, joinerName: username };
            socket.data.pendingRoomId = roomId;

            socket.emit('role_assigned', { isHost: false });
            socket.emit('waiting_for_host');

            const hostSocket = getLiveSocket(r.hostSocketId);
            if (hostSocket) hostSocket.emit('request_host_permission', r.pending[socket.id]);
        }

        // Guests (no account) or a host without an account: they must knock
        if (!uid || !asId(room.hostUserId)) return askPermission(room);

        // 1. Blocked from this specific room
        if ((room.blockedUsers || []).includes(uid)) {
            return socket.emit('entry_denied', { reason: 'You have been blocked from this specific room.' });
        }

        // 2. Pre-approved (host invited them)
        if ((room.preApprovedUsers || []).includes(uid)) return completeJoin(room);

        // 3. Direct friend of the current host
        const hostUser = await User.findById(room.hostUserId);
        room = rooms[roomId]; // the room may have closed while we waited on the DB
        if (!room) return socket.emit('room_not_found');
        if (!hostUser) return socket.emit('room_not_found');

        const isFriend = (hostUser.friends || []).some((id) => String(id) === uid);
        if (isFriend) return completeJoin(room);

        // 4. Friend of friend / stranger: must ask permission
        return askPermission(room);
    }));

    // ---------------------------------------------------------
    // HOST DECISION (Allow / Reject / Block) - current host only
    // ---------------------------------------------------------
    socket.on('host_decision', safe(async (payload = {}) => {
        const roomId = asId(payload.roomId) || socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.hostSocketId !== socket.id) return;

        // Use the server's own record of who is knocking, never the client's copy
        const pending = room.pending && room.pending[payload.joinerSocketId];
        if (!pending) return;
        delete room.pending[payload.joinerSocketId];

        const joinerSocket = getLiveSocket(pending.joinerSocketId);
        if (!joinerSocket) return; // user disconnected while waiting
        joinerSocket.data.pendingRoomId = null;

        if (payload.decision === 'ALLOW') {
            joinerSocket.join(roomId);
            joinerSocket.data.roomId = roomId;
            joinerSocket.data.username = pending.joinerName;
            joinerSocket.data.userId = pending.joinerId;
            room.users[pending.joinerSocketId] = pending.joinerName;

            joinerSocket.emit('entry_approved');
            sendVideoState(joinerSocket, room);
            emitRoomUsers(roomId);
        } else if (payload.decision === 'REJECT') {
            joinerSocket.emit('entry_denied', { reason: 'The host declined your request to join.' });
        } else if (payload.decision === 'BLOCK') {
            joinerSocket.emit('entry_denied', { reason: 'You have been blocked from this specific room.' });

            if (pending.joinerId) {
                room.blockedUsers = room.blockedUsers || [];
                if (!room.blockedUsers.includes(pending.joinerId)) room.blockedUsers.push(pending.joinerId);
            }
        }
    }));

    // ---------------------------------------------------------
    // PLAYBACK - current host only
    // ---------------------------------------------------------
    socket.on('change_video', safe(async (data = {}) => {
        const roomId = asId(data.roomId) || socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.hostSocketId !== socket.id || !data.ytId) return;

        // Same video re-announced (e.g. host socket reconnected): keep the current time, do nothing
        if (room.ytId === data.ytId) return;

        room.ytId = data.ytId;
        room.title = data.title;
        room.isPlaying = true;
        room.timestamp = 0;

        socket.to(roomId).emit('new_video', { roomId, ytId: data.ytId, title: data.title });
    }));

    socket.on('sync_action', safe(async (data = {}) => {
        const roomId = asId(data.roomId) || socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.hostSocketId !== socket.id) return;

        room.isPlaying = data.action === 'play';
        if (typeof data.timestamp === 'number') room.timestamp = data.timestamp;

        socket.to(roomId).emit('remote_sync', { roomId, action: data.action, timestamp: room.timestamp });
    }));

    // ---------------------------------------------------------
    // CHAT - only into the room this socket actually belongs to
    // ---------------------------------------------------------
    socket.on('send_chat', safe(async (data = {}) => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId]) return;
        socket.to(roomId).emit('receive_chat', { ...data, roomId, sender: socket.data.username || data.sender });
    }));

    // ---------------------------------------------------------
    // CLOSE ROOM FOR EVERYONE - current host only
    // (the normal "leave" path is just disconnecting, which migrates the host)
    // ---------------------------------------------------------
    socket.on('close_room', safe(async (rawRoomId) => {
        const roomId = asId(rawRoomId) || socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.hostSocketId !== socket.id) return;

        socket.to(roomId).emit('room_closed');
        destroyRoom(roomId);
    }));

    // ---------------------------------------------------------
    // MODERATION - current host only
    // ---------------------------------------------------------
    socket.on('kick_user', safe(async (payload = {}) => {
        const roomId = asId(payload.roomId) || socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.hostSocketId !== socket.id) return;

        const targetSocketId = findSocketIdByUsername(room, payload.targetUsername, socket.id);
        if (!targetSocketId) return;

        kickFromRoom(roomId, room, targetSocketId, 'You were kicked from the room by the host.');
    }));

    socket.on('kick_and_block_user', safe(async (payload = {}) => {
        const roomId = asId(payload.roomId) || socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.hostSocketId !== socket.id) return;

        const targetSocketId = findSocketIdByUsername(room, payload.targetUsername, socket.id);
        if (!targetSocketId) return;

        const targetUserId = kickFromRoom(roomId, room, targetSocketId, 'You were blocked by the host for this room.');

        if (targetUserId) {
            room.blockedUsers = room.blockedUsers || [];
            if (!room.blockedUsers.includes(targetUserId)) room.blockedUsers.push(targetUserId);
        }
    }));

    // ---------------------------------------------------------
    // DISCONNECT
    // ---------------------------------------------------------
    socket.on('disconnect', safe(async () => {
        // A joiner who was still knocking gave up
        const pendingRoomId = socket.data.pendingRoomId;
        if (pendingRoomId && rooms[pendingRoomId]?.pending) {
            delete rooms[pendingRoomId].pending[socket.id];
        }

        const roomId = socket.data.roomId;
        const room = roomId ? rooms[roomId] : null;
        if (!room) return;

        delete room.users[socket.id];

        if (room.hostSocketId === socket.id) {
            // The host left: promote the next person in line, or close the room if nobody is left
            migrateHost(roomId, room);
        } else if (Object.keys(room.users).length === 0) {
            destroyRoom(roomId);
        } else {
            emitRoomUsers(roomId);
        }
    }));
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