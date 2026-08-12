const mongoose = require('mongoose');

// Schema for individual notifications
const notificationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['CINEREQUEST', 'THEATRE_INVITE', 'REJECTED_ALERT'],
        required: true
    },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: String },
    roomId: { type: String }, // Used specifically for Theatre Invites
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a name'],
        },
        email: {
            type: String,
            required: [true, 'Please add an email'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: function () {
                return !this.googleId;
            },
            minlength: 6,
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },
        profilePicture: {
            type: String,
            default: null
        },
        expoPushToken: {
            type: String,
            default: null
        },
        watchlist: [{
            type: String
        }],
        watched: [{
            type: String
        }],
        // --- NEW CINEBUDDIES FIELDS ---
        friends: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        friendRequests: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        blockedUsers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        notifications: [notificationSchema]
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('User', userSchema);