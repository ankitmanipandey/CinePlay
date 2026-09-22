const express = require('express');
const http = require('http');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const socketIo = require('socket.io');
require('dotenv').config();
const cors = require('cors');
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

const allowedOrigins = ['http://localhost:8081', 'https://cineplayap.netlify.app']; // Add your actual Netlify URL

app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

const io = socketIo(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(express.json());

app.get('/', (req, res) => { res.status(200).send('Server is awake'); });

// =========================================================
// CORS PROXY ROUTE FOR WEB VIEW (ESPN/TV DATA)
// =========================================================
app.get('/api/proxy/fetch', async (req, res) => {
    try {
        const targetUrl = req.query.url;
        if (!targetUrl) return res.status(400).json({ error: 'Target URL is required' });

        // Add a standard Chrome User-Agent so GitHub/ESPN don't block the Node.js request
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });

        // Ensure we actually got a successful response before trying to parse JSON
        if (!response.ok) {
            throw new Error(`External API responded with status: ${response.status}`);
        }

        const data = await response.json();
        res.status(200).json(data);

    } catch (error) {
        console.error('[Proxy Error]:', error.message);
        res.status(500).json({ error: 'Failed to fetch data from external API' });
    }
});

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
    const userList = state?.users ? Object.entries(state.users).map(([sId, uname]) => ({ socketId: sId, username: uname })) : [];
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
// ROOM CREATION & LOBBY FETCHING (REST ROUTES)
// ---------------------------------------------------------
const ROOM_CLAIM_TIMEOUT_MS = 2 * 60 * 1000;

app.post('/api/rooms', protect, (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ message: 'Not authorized' });

        const { isPublic = false, pin = null, roomName } = req.body || {};

        let roomId = null;
        for (let i = 0; i < 25 && !roomId; i++) {
            const candidate = String(crypto.randomInt(10000, 100000)); // 5 digits
            if (!rooms[candidate]) roomId = candidate;
        }
        if (!roomId) return res.status(503).json({ message: 'Could not allocate a room, try again' });

        const defaultRoomName = req.user.name ? `${req.user.name.split(' ')[0]}'s Theatre` : 'CineTheatre Room';

        rooms[roomId] = {
            users: {},
            pending: {},
            blockedUsers: [],
            preApprovedUsers: [],
            hostSocketId: null,
            hostUserId: asId(req.user._id),
            hostName: req.user.name || 'Host',
            roomName: roomName || defaultRoomName,
            isPublic: Boolean(isPublic),
            pin: pin ? String(pin) : null,
            reserved: true,
            ytId: null,
            title: null,
            isPlaying: false,
            timestamp: 0
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

app.get('/api/rooms/public', protect, (req, res) => {
    try {
        const publicRooms = Object.entries(rooms)
            .filter(([id, room]) => room.isPublic && room.hostSocketId && !room.reserved)
            .map(([id, room]) => ({
                roomId: id,
                roomName: room.roomName,
                hostName: room.hostName,
                videoTitle: room.title || 'Choosing a video...',
                userCount: Object.keys(room.users || {}).length,
            }));

        return res.status(200).json(publicRooms);
    } catch (err) {
        console.error('[rooms] fetch public error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

apiNamespace.on('connection', (socket) => {

    // ---------------------------------------------------------
    // JOIN ROOM LOGIC
    // ---------------------------------------------------------
    socket.on('join_room', safe(async (payload = {}) => {
        const roomId = asId(payload.roomId);
        if (!roomId) return;

        const username = payload.username || 'Guest';
        const uid = socket.data.authUserId || null;
        let room = rooms[roomId];

        if (room && room.cleanupTimer) {
            clearTimeout(room.cleanupTimer);
            room.cleanupTimer = null;
        }

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
                room = rooms[roomId] = { users: {}, pending: {}, blockedUsers: [], preApprovedUsers: [], isPublic: false, pin: null };
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
            socket.data.userId = uid;
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

        // 1. Blocked from this specific room (Takes highest priority)
        if ((room.blockedUsers || []).includes(uid)) {
            return socket.emit('entry_denied', { reason: 'You have been blocked from this specific room.' });
        }

        // 2. Pre-approved (Host invited them OR they already entered the PIN previously)
        if (uid && (room.preApprovedUsers || []).includes(uid)) return completeJoin(room);

        // 3. Public Room Auto-Join
        if (room.isPublic) return completeJoin(room);

        // 4. Private Room with PIN Check
        if (room.pin) {
            const enteredPin = payload.pin; // Supplied from frontend PIN prompt

            if (enteredPin === room.pin) {
                // SUCCESS! Remember this user so they never have to type the PIN again
                if (uid) {
                    room.preApprovedUsers = room.preApprovedUsers || [];
                    if (!room.preApprovedUsers.includes(uid)) {
                        room.preApprovedUsers.push(uid);
                    }
                }
                return completeJoin(room);

            } else if (enteredPin) {
                // They tried a PIN, but it was wrong
                return socket.emit('entry_denied', { reason: 'Incorrect PIN.' });

            } else {
                // They haven't entered a PIN yet
                return socket.emit('require_pin');
            }
        }

        // 5. Private Room without PIN: Friends auto-join, strangers knock
        if (!uid || !asId(room.hostUserId)) return askPermission(room);

        const hostUser = await User.findById(room.hostUserId);
        room = rooms[roomId]; // the room may have closed while we waited on the DB
        if (!room) return socket.emit('room_not_found');
        if (!hostUser) return socket.emit('room_not_found');

        const isFriend = (hostUser.friends || []).some((id) => String(id) === uid);
        if (isFriend) return completeJoin(room);

        // Friend of friend / stranger: must ask permission
        return askPermission(room);
    }));

    // ---------------------------------------------------------
    // HOST DECISION (Allow / Reject / Block) - current host only
    // ---------------------------------------------------------
    socket.on('host_decision', safe(async (payload = {}) => {
        const roomId = asId(payload.roomId) || socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.hostSocketId !== socket.id) return;

        const pending = room.pending && room.pending[payload.joinerSocketId];
        if (!pending) return;
        delete room.pending[payload.joinerSocketId];

        const joinerSocket = getLiveSocket(pending.joinerSocketId);
        if (!joinerSocket) return; // user disconnected while waiting
        joinerSocket.data.pendingRoomId = null;

        if (payload.decision === 'ALLOW') {
            if (pending.joinerId) {
                room.preApprovedUsers = room.preApprovedUsers || [];
                if (!room.preApprovedUsers.includes(pending.joinerId)) {
                    room.preApprovedUsers.push(pending.joinerId);
                }
            }
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

        if (room.ytId === data.ytId) return;

        room.ytId = data.ytId;
        room.title = data.title;
        room.isPlaying = true;
        room.timestamp = 0;

        socket.to(roomId).emit('new_video', { roomId, ytId: data.ytId, title: data.title });
    }));

    // ---------------------------------------------------------
    // SYNC ACTION - current host only
    // ---------------------------------------------------------
    socket.on('sync_action', safe(async (data = {}) => {
        const roomId = asId(data.roomId) || socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.hostSocketId !== socket.id) return;

        room.isPlaying = data.action === 'play';
        if (typeof data.timestamp === 'number') room.timestamp = data.timestamp;

        socket.to(roomId).emit('remote_sync', { roomId, action: data.action, timestamp: room.timestamp });
    }));

    // ---------------------------------------------------------
    // CHAT
    // ---------------------------------------------------------
    socket.on('send_chat', safe(async (data = {}) => {
        const roomId = socket.data.roomId;
        if (!roomId || !rooms[roomId]) return;
        socket.to(roomId).emit('receive_chat', { ...data, roomId, sender: socket.data.username || data.sender });
    }));

    // ---------------------------------------------------------
    // CLOSE ROOM
    // ---------------------------------------------------------
    socket.on('close_room', safe(async (rawRoomId) => {
        const roomId = asId(rawRoomId) || socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.hostSocketId !== socket.id) return;

        socket.to(roomId).emit('room_closed');
        destroyRoom(roomId);
    }));

    // ---------------------------------------------------------
    // MODERATION
    // ---------------------------------------------------------
    socket.on('kick_user', safe(async (payload = {}) => {
        const roomId = asId(payload.roomId) || socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.hostSocketId !== socket.id) return;
        if (!payload.targetSocketId) return;

        kickFromRoom(roomId, room, payload.targetSocketId, 'You were kicked from the room by the host.');
    }));

    socket.on('kick_and_block_user', safe(async (payload = {}) => {
        const roomId = asId(payload.roomId) || socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.hostSocketId !== socket.id) return;
        if (!payload.targetSocketId) return;

        const targetUserId = kickFromRoom(roomId, room, payload.targetSocketId, 'You were blocked by the host for this room.');

        if (targetUserId) {
            room.blockedUsers = room.blockedUsers || [];
            if (!room.blockedUsers.includes(targetUserId)) room.blockedUsers.push(targetUserId);
        }
    }));
    // ---------------------------------------------------------
    // DISCONNECT
    // ---------------------------------------------------------
    socket.on('disconnect', safe(async () => {
        const pendingRoomId = socket.data.pendingRoomId;
        if (pendingRoomId && rooms[pendingRoomId]?.pending) {
            delete rooms[pendingRoomId].pending[socket.id];
        }

        const roomId = socket.data.roomId;
        const room = roomId ? rooms[roomId] : null;
        if (!room) return;

        delete room.users[socket.id];

        room.cleanupTimer = setTimeout(() => {
            if (!rooms[roomId]) return;
            if (Object.keys(room.users).length === 0) {
                destroyRoom(roomId);
            } else if (room.hostSocketId === socket.id) {
                migrateHost(roomId, room);
            }
        }, 20000);
    }));
});

// =========================================================
// 2. GLOBAL SOCKET NAMESPACE (/global) for CineBuddies
// =========================================================
const globalNamespace = io.of('/global');
app.locals.globalNamespace = globalNamespace;
app.locals.rooms = rooms;
module.exports.globalNamespace = globalNamespace;

// 1. Authenticate the global socket just like the theatre socket
globalNamespace.use((socket, next) => {
    const token = socket.handshake?.auth?.token;
    if (token && token !== 'null' && token !== 'undefined') {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.data.userId = String(decoded.id);
            return next();
        } catch (err) { }
    }
    next(new Error("Not authorized"));
});

// 2. Connect using Socket Rooms (Supports multi-device natively)
globalNamespace.on('connection', (socket) => {
    const uid = socket.data.userId;

    if (uid) {
        socket.join(uid);
        globalNamespace.emit('user_status', { userId: uid, isOnline: true });
    }

    socket.on('disconnect', async () => {
        if (uid) {
            // Check if they have other devices still connected
            const sockets = await globalNamespace.in(uid).fetchSockets();
            if (sockets.length === 0) {
                globalNamespace.emit('user_status', { userId: uid, isOnline: false });
            }
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