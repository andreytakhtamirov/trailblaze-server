const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true },
    username: { 
        type: String, 
        default: function() {
          return 'user_' + uuidv4().replace(/-/g, '').substring(0, 5);
        }
      },
    user_sub: { type: String, required: true },
    profile_picture: { type: String, required: false},
    routes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    likes: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    posts: { type: [mongoose.Schema.Types.ObjectId], default: [] },
});

module.exports = mongoose.model('User', userSchema, "Users");