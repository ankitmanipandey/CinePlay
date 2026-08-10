const mongoose = require('mongoose');

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
        // --- NEW FIELDS FOR MOVIE LISTS ---
        watchlist: [{
            type: String
        }],
        watched: [{
            type: String
        }]
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('User', userSchema);