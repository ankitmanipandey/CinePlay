const express = require('express');
require('dotenv').config();
const connectDB = require('../database/connectDB');
const authRouter = require('../routes/authRouter');
const userRouter = require('../routes/userRouter');
const serverAwake = require('../jobs/serverAwake');

const app = express();

app.use(express.json());

app.get('/', (req, res) => { res.status(200).send('Server is awake'); });

app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB(); // Wait for MongoDB connection

        app.listen(PORT, () => {
            console.log(`Server ONLINE on port ${PORT}`);
            serverAwake();
        });
    } catch (error) {
        console.error('Failed to connect to the database. Server not started.', error);
        process.exit(1);
    }
};

startServer();