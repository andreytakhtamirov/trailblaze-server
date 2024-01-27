const mongoose = require('mongoose');
const User = require('../models/user');
const Route = require('../models/route');
const {
    kMaxRouteTitleLength,
} = require('../constants/input');

// Use local '.env' if not in production.
// Production environment variables are defined in App Service Settings.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const DB_URI = process.env.DB_CONNECTION_STRING;

class UserService {
    constructor() {
        this._connectToDatabase();
    }

    async _connectToDatabase() {
        try {
            await mongoose.connect(DB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
        } catch (error) {
            console.error('Database connection error:', error);
            throw new Error('Database connection error');
        }
    }

    async getUserProfile(decoded, res) {
        try {
            const existingUser = await User.findOne({ user_sub: decoded.sub });

            if (existingUser) {
                // User exists, return info.
                const userProfile = {
                    id: existingUser._id,
                    username: existingUser.username,
                    profile_picture: existingUser.profile_picture,
                };
                res.status(200).json(userProfile);
            } else {
                // User does not exist, create profile.
                const newUserProfile = await this.createUserProfile(decoded);
                res.status(201).json(newUserProfile);
            }
        } catch (error) {
            console.error('Error getting user:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async createUserProfile(decoded) {
        try {
            const newUser = new User({
                email: decoded.email,
                user_sub: decoded.sub,
            });

            // Save the new user to the database.
            const savedUser = await newUser.save();
            return savedUser;
        } catch (error) {
            console.error('Error creating user:', error);
            throw new Error('Failed to create user');
        }
    }

    async saveRoute(userId, parsedData, res) {
        try {
            if (parsedData.title.length > kMaxRouteTitleLength) {
                return res.status(400).json({ error: 'Title is too long' });
            }

            if (parsedData.imageUrl == null) {
                return res.status(400).json({ error: 'Route must include static map image URL' });
            }

            let isGraphhopperRoute = false;
            if (parsedData.routeOptions.profile == 'gravel_cycling') {
                isGraphhopperRoute = true;
            }

            const route = new Route({
                title: parsedData.title,
                type: isGraphhopperRoute ? 'gh' : 'mb',
                route: parsedData.route,
                imageUrl: parsedData.imageUrl,
                routeOptions: parsedData.routeOptions,
            });

            route.save().then(savedRoute => {
                User.findOne({ _id: userId })
                    .then(existingUser => {
                        if (existingUser) {
                            // We have an existing user. Update to include new route ID.
                            existingUser.routes.push(savedRoute);
                            return existingUser.save();
                        } else {
                            console.error('User not found when saving route');
                            res.status(404).json({ error: 'User not found' });
                        }
                    })
                    .then(savedUser => {
                        res.status(201).json(savedRoute.id);
                    })
                    .catch(err => {
                        console.error(err);
                        res.status(500).send('Internal server error');
                    });
            });
        } catch (error) {
            console.error('Error saving route:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async deleteRoute(userId, routeId, res) {
        try {
            Route.deleteOne({ _id: routeId })
                .then(() => {
                    User.findOne({ _id: userId })
                        .then(existingUser => {
                            if (existingUser) {
                                existingUser.routes.pull(routeId);
                                return existingUser.save();
                            } else {
                                console.error('User not found when deleting route');
                                res.status(404).json({ error: 'User not found' });
                            }
                        })
                        .then(savedUser => {
                            res.status(204).send();
                        })
                        .catch(err => {
                            console.error(err);
                            res.status(500).send('Internal server error');
                        });
                });
        } catch (error) {
            console.error('Error saving route:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = new UserService();
