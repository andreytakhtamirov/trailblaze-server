var express = require('express');
var router = express.Router();
const JwtAuth = require('../middleware/jwt')
const User = require('../models/user');
const jsonwebtoken = require('jsonwebtoken');
const mongoose = require('mongoose');
const isUsernameValid = require('../utils/validationUtils');
const { deleteUserAndAssociatedData, deleteUser } = require('../services/dataDeletion');

// Use local '.env' if not in production.
// Production environment variables are defined in App Service Settings.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const DB_URI = process.env.DB_CONNECTION_STRING;

router.get('/', JwtAuth, function (req, res) {
    const token = req.headers.authorization.replace('Bearer ', '');
    const decoded = jsonwebtoken.decode(token);

    // Connect to database.
    mongoose.connect(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
        .then(() => {
            User.findOne({ user_sub: decoded.sub })
                .then(existingUser => {
                    if (existingUser) {
                        const userProfile = {
                            username: existingUser.username,
                            profile_picture: existingUser.profile_picture,
                        };
                        res.status(200).json(userProfile);
                    } else {
                        res.status(204).json({ message: 'User profile not found. Please create a new profile.' });
                    }
                })
                .catch(err => {
                    console.error(err);
                    res.status(500).json({ error: 'Internal server error' });
                });
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'Database connection error' });
        });
});

router.post('/', JwtAuth, function (req, res) {
    const token = req.headers.authorization.replace('Bearer ', '');
    const decoded = jsonwebtoken.decode(token);

    const username = req.body.username ? req.body.username.toLowerCase() : null;
    if (username != null && !isUsernameValid(username)) {
        return res.status(400).json({ error: 'Invalid username' });
    }

    const imageBytes = req.body.profile_picture;

    // Connect to the database.
    mongoose.connect(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
        .then(() => {
            // Check if the user already exists in the database based on 'user_sub'.
            User.findOne({ user_sub: decoded.sub })
                .then(existingUser => {
                    if (existingUser) {
                        // User already exists, update the username instead.
                        // Check if the username is already used by another user.
                        User.findOne({ username: username })
                            .then(existingUsername => {
                                if (existingUsername) {
                                    return res.status(409).json({ error: 'Username is already in use' });
                                }

                                if (username != null) {
                                    existingUser.username = username;
                                }
                                if (imageBytes != null) {
                                    existingUser.profile_picture = imageBytes;
                                }
                                existingUser.save()
                                    .then(updatedUser => {
                                        return res.status(200).json(updatedUser);
                                    })
                                    .catch(err => {
                                        console.error(err);
                                        return res.status(500).json({ error: 'Failed to update username' });
                                    });
                            })
                            .catch(err => {
                                console.error(err);
                                return res.status(500).json({ error: 'Internal server error' });
                            });
                    } else {
                        // Check if the username is already used by another user.
                        User.findOne({ username: username })
                            .then(existingUsername => {
                                if (existingUsername) {
                                    return res.status(409).json({ error: 'Username is already in use' });
                                }

                                // Create a new User object using the provided fields.
                                const newUser = new User({
                                    email: decoded.email,
                                    user_sub: decoded.sub,
                                    routes: [],
                                    likes: [],
                                });

                                if (username != null) {
                                    newUser.username = username;
                                }

                                if (imageBytes != null) {
                                    newUser.profile_picture = imageBytes;
                                }

                                // Save the new user to the database.
                                newUser.save()
                                    .then(savedUser => {
                                        return res.status(201).json(savedUser);
                                    })
                                    .catch(err => {
                                        console.error(err);
                                        return res.status(500).json({ error: 'Failed to create user' });
                                    });
                            })
                            .catch(err => {
                                console.error(err);
                                return res.status(500).json({ error: 'Internal server error' });
                            });
                    }
                })
                .catch(err => {
                    console.error(err);
                    return res.status(500).json({ error: 'Internal server error' });
                });
        })
        .catch(err => {
            console.error(err);
            return res.status(500).json({ error: 'Database connection error' });
        });
});

router.get('/check/:username', function (req, res) {
    const username = req.params.username.toLowerCase();

    // Connect to the database.
    mongoose.connect(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
        .then(() => {
            // Check if the username is already used by another user.
            User.findOne({ username: username })
                .then(existingUser => {
                    if (existingUser) {
                        // Username is not available, as it's already used by another user.
                        res.status(409).json({ message: 'Username is not available' });
                    } else {
                        // Username is available.
                        res.status(200).json({ message: 'Username is available' });
                    }
                })
                .catch(err => {
                    console.error(err);
                    res.status(500).json({ error: 'Internal server error' });
                });
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ error: 'Database connection error' });
        });
});

router.delete('/', JwtAuth, function (req, res) {
    const token = req.headers.authorization.replace('Bearer ', '');
    const decoded = jsonwebtoken.decode(token);

    deleteUser(decoded.sub)
        .then(successMessage => {
            deleteUserAndAssociatedData(decoded.sub)
                .then(successMessage => {
                    res.status(200).json({ message: successMessage })
                })
                .catch(errorMessage => {
                    console.error(errorMessage);
                    res.status(500).json({ error: errorMessage })
                });
        })
        .catch(errorMessage => {
            console.error(errorMessage);
            res.status(500).json({ error: errorMessage })
        });
});

module.exports = router;
