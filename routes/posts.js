var express = require('express');
var router = express.Router();
const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require('jwks-rsa');
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

// Middleware for checking the JWT
const checkJwt = jwt({
    // Dynamically provide a signing key based on the header 
    //  and the signing keys provided by the JWKS endpoint.
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://dev-trailblaze.us.auth0.com/.well-known/jwks.json`
    }),

    issuer: 'https://dev-trailblaze.us.auth0.com/',
    algorithms: ['RS256']
});

// Middleware for checking for the app token. Should be checked in all endpoints.
const verifyAppToken = (req, res, next) => {
    const token = req.get('TRAILBLAZE-APP-TOKEN')
    if (!token || token !== process.env.TRAILBLAZE_APP_TOKEN) {
        return res.status(401).json({ message: 'Unauthorized' })
    }
    next()
}

router.post('/create-post', verifyAppToken, checkJwt, function (req, res) {
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

router.get('/get-user-posts', verifyAppToken, checkJwt, async (req, res) => {
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
                        const endIndex = page * limit;

                        const postIds = user.posts.slice(startIndex, endIndex).map(post => post._id);
                        Post.find({ _id: { $in: postIds } })
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

router.get('/get-posts', verifyAppToken, checkJwt, async (req, res) => {
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
                    .skip(startIndex)
                    .limit(limit)
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
