const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Adjust path to your User model if needed
const generateToken = require('../config/token');
const validator = require('validator');

const authRouter = express.Router();

// ==========================================
// 1. REGISTER ENDPOINT
// ==========================================
authRouter.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        // 1. Validate Email format
        if (!validator.isEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // 2. Validate Password strength (e.g., minimum length of 6)
        if (!validator.isLength(password, { min: 6 })) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        // Check if user already exists...
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Proceed with hashing and creation...
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            name: email.split('@')[0],
            email,
            password: hashedPassword,
        });

        res.status(201).json({
            _id: user._id,
            email: user.email,
            profilePicture: user.profilePicture,
            token: generateToken(user._id),
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// ==========================================
// 2. LOGIN ENDPOINT
// ==========================================
authRouter.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if email and password are provided
        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Check if password matches
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Send back user data and token
        res.json({
            _id: user._id,
            email: user.email,
            profilePicture: user.profilePicture,
            token: generateToken(user._id),
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// ==========================================
// 3. LOGOUT ENDPOINT
// ==========================================
authRouter.post('/logout', (req, res) => {
    try {
        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {x
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Server error during logout' });
    }
});

module.exports = authRouter;