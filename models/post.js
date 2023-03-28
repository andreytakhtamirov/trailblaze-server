const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    routeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Route',
        required: true
    },
    likes: { type: Number, default: 0 },
});

module.exports = mongoose.model('Post', postSchema, "Posts");