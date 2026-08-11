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
        // 1. Extract name, email, and password from the request body
        const { name, email, password } = req.body;

        // 2. Ensure all fields are provided (added 'name' check)
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        // 3. Validate Email format
        if (!validator.isEmail(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        // 4. Validate Password strength
        if (!validator.isLength(password, { min: 6 })) {
            return res.status(400).json({ message: 'Password must be at least 6 characters long' });
        }

        // 5. Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // 6. Proceed with hashing
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 7. Create the user using the actual name provided
        const user = await User.create({
            name: name.trim(), // <-- Uses the actual name from the frontend
            email,
            password: hashedPassword,
        });

        // 8. Send back user data and token
        res.status(201).json({
            _id: user._id,
            name: user.name,
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
            name: user.name, // <-- ADDED THIS
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
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Server error during logout' });
    }
});

module.exports = authRouter;