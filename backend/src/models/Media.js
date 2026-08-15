const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    url: {
        type: String,
        required: true
    },
    r2Key: {
        type: String,
        required: true
    },
    duration: {
        type: String,
        default: "0:00"
    },
    thumbnailUrl: { type: String },
    thumbnailKey: { type: String },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Media', mediaSchema);