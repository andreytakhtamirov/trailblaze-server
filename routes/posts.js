var express = require('express');
var router = express.Router();
const JwtAuth = require('../middleware/jwt');
const Post = require('../models/post');
const User = require('../models/user');
const jsonwebtoken = require('jsonwebtoken');
const mongoose = require('mongoose');

// Use local '.env' if not in production.
// Production environment variables are defined in App Service Settings.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const DB_URI = process.env.DB_CONNECTION_STRING;

router.post('/create-post', JwtAuth, function (req, res) {
    const token = req.headers.authorization.replace('Bearer ', '');
    const decoded = jsonwebtoken.decode(token);

    const user = {
        email: decoded.email,
        username: decoded.name,
        user_sub: decoded.sub,
    };

    const parsedData = JSON.parse(JSON.stringify(req.body));

    // Connect to database.
    mongoose.connect(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
        .then(() => {
            // Save post from request body data.
            const post = new Post({
                title: parsedData.title,
                description: parsedData.description,
                routeId: parsedData.routeId,
            });

            return post.save();
        })
        .then(savedPost => {
            // Once we have a saved route, find or create a user.
            // user_sub is the more unique field, since users can sign in with the same
            //  email address from multiple sources (google as well as auth0 database).
            User.findOne({ user_sub: user.user_sub })
                .then(existingUser => {
                    if (existingUser) {
                        existingUser.posts.push(savedPost);
                        return existingUser.save();
                    }
                })
                .then(() => {
                    res.status(200).json(savedPost);
                })
                .catch(err => {
                    console.error(err);
                    res.status(500).send('Internal server error');
                });
        }).catch(err => {
            console.error(err);
            // Potential improvement: Mention the specific part that was invalid.
            res.status(500).send('Incomplete post');
        });
});

router.get('/get-user-posts', JwtAuth, async (req, res) => {
    mongoose.connect(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
        .then(() => {
            try {
                const token = req.headers.authorization.replace('Bearer ', '');
                const decoded = jsonwebtoken.decode(token);

                User.findOne({ user_sub: decoded.sub }).populate('posts')
                    .then((user) => {
                        if (!user) {
                            return res.status(404).send('User not found');
                        }

                        const page = parseInt(req.query.page) || 1;
                        const limit = 5;
                        const startIndex = (page - 1) * limit;

                        Post.find({ _id: { $in: user.posts } })
                            .sort({ _id: -1 })
                            .populate('routeId')
                            .skip(startIndex)
                            .limit(limit)
                            .then((posts) => {
                                res.json(posts);
                            });
                    });
            } catch (error) {
                console.error(error);
                res.status(500).send('Server error');
            }
        });
});

router.get('/get-user-likes', JwtAuth, async (req, res) => {
    mongoose.connect(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
        .then(() => {
            try {
                const token = req.headers.authorization.replace('Bearer ', '');
                const decoded = jsonwebtoken.decode(token);

                User.findOne({ user_sub: decoded.sub }).populate('likes')
                    .then((user) => {
                        if (!user) {
                            return res.status(404).send('User not found');
                        }

                        const page = parseInt(req.query.page) || 1;
                        const limit = 5;
                        const startIndex = (page - 1) * limit;

                        Post.find({ _id: { $in: user.likes } })
                            .sort({ _id: -1 })
                            .populate('routeId')
                            .skip(startIndex)
                            .limit(limit)
                            .then((posts) => {
                                res.json(posts);
                            });
                    });
            } catch (error) {
                console.error(error);
                res.status(500).send('Server error');
            }
        });
});

router.get('/get-posts', async (req, res) => {
    mongoose.connect(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
        .then(() => {
            try {
                // Retrieve 5 posts at a time, from all users.
                const page = parseInt(req.query.page) || 1;
                const limit = 5;
                const startIndex = (page - 1) * limit;

                Post.find()
                    .sort({ _id: -1 })
                    .skip(startIndex)
                    .limit(limit)
                    .populate('routeId')
                    .then((posts) => {
                        res.json(posts);
                    });
            } catch (error) {
                console.error(error);
                res.status(500).send('Server error');
            }
        });
});

module.exports = router;
