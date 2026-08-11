const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();
const connectDB = require('../database/connectDB');
const authRouter = require('../routes/authRouter');
const userRouter = require('../routes/userRouter');
const aiRouter = require('../routes/aiRouter');
const serverAwake = require('../jobs/serverAwake');

const app = express();

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const rooms = {};

app.use(express.json());

app.get('/', (req, res) => { res.status(200).send('Server is awake'); });

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/ai', aiRouter);

const apiNamespace = io.of('/api');

function emitRoomUsers(roomId) {
    const state = rooms[roomId];
    const userList = state?.users ? Object.values(state.users) : [];
    apiNamespace.to(roomId).emit('room_users', userList);
}

apiNamespace.on('connection', (socket) => {

    // --> ADDED isHost TO THE PAYLOAD
    socket.on('join_room', ({ roomId, username, isHost }) => {

        // --> SECURITY CHECK: If it's a viewer and the room doesn't exist, reject them.
        if (!isHost && !rooms[roomId]) {
            socket.emit('room_not_found');
            return; // Stop execution here, don't let them join
        }

        socket.join(roomId);

        socket.data.roomId = roomId;
        socket.data.username = username;

        // If the host is joining and room doesn't exist, initialize it
        if (!rooms[roomId]) {
            rooms[roomId] = { users: {} };
        }
        if (!rooms[roomId].users) rooms[roomId].users = {};

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
    });

    socket.on('change_video', (data) => {
        rooms[data.roomId] = {
            ...rooms[data.roomId],
            ytId: data.ytId,
            title: data.title,
            isPlaying: true,
            timestamp: 0,
        };
        socket.to(data.roomId).emit('new_video', data);
    });

    socket.on('sync_action', (data) => {
        if (rooms[data.roomId]) {
            rooms[data.roomId].isPlaying = data.action === 'play';
            rooms[data.roomId].timestamp = data.timestamp;
        }
        socket.to(data.roomId).emit('remote_sync', data);
    });

    socket.on('send_chat', (data) => {
        socket.to(data.roomId).emit('receive_chat', data);
    });

    socket.on('close_room', (roomId) => {
        delete rooms[roomId];
        socket.to(roomId).emit('room_closed');
    });

    socket.on('disconnect', () => {
        const roomId = socket.data.roomId;

        if (roomId && rooms[roomId]?.users) {
            delete rooms[roomId].users[socket.id];

            if (Object.keys(rooms[roomId].users).length === 0) {
                delete rooms[roomId];
            } else {
                emitRoomUsers(roomId);
            }
        }
    });
});

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