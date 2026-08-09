const express = require('express');
require('dotenv').config();
const connectDB = require('../database/connectDb');
const authRouter = require('../routes/authRouter');

const app = express();

app.use(express.json());

app.use('/api/auth', authRouter);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB(); // Wait for MongoDB connection

        app.listen(PORT, () => {
            console.log(`Server ONLINE on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to connect to the database. Server not started.', error);
        process.exit(1);
    }
};

startServer();