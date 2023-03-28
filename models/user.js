const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true },
    username: { type: String, required: true },
    user_sub: { type: String, required: true },
    routes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    likes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    posts: { type: [mongoose.Schema.Types.ObjectId], default: [] },
});

module.exports = mongoose.model('User', userSchema, "Users");