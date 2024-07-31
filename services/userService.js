const mongoose = require('mongoose');
const User = require('../models/user');
const Route = require('../models/route');
const {
    kMaxRouteTitleLength,
} = require('../constants/input');
const { HttpStatusCode } = require('axios');

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
                    id: existingUser.id,
                    username: existingUser.username,
                    profile_picture: existingUser.profile_picture,
                };
                res.status(HttpStatusCode.Ok).json(userProfile);
            } else {
                // User does not exist, create profile.
                const newUserProfile = await this.createUserProfile(decoded);
                const userProfile = {
                    id: newUserProfile.id,
                    username: newUserProfile.username,
                    profile_picture: newUserProfile.profile_picture,
                };
                res.status(HttpStatusCode.Created).json(userProfile);
            }
        } catch (error) {
            console.error('Error getting user:', error);
            res.status(HttpStatusCode.InternalServerError).json({ error: 'Internal server error' });
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

    async saveRoute(decoded, userId, parsedData, res) {
        try {
            if (parsedData.title.length > kMaxRouteTitleLength) {
                return res.status(HttpStatusCode.BadRequest).json({ error: 'Title is too long' });
            }
    
            if (parsedData.imageUrl == null) {
                return res.status(HttpStatusCode.BadRequest).json({ error: 'Route must include static map image URL' });
            }
    
            const existingUser = await User.findOne({ _id: userId });
    
            if (!existingUser) {
                console.error('User not found when saving route');
                return res.status(HttpStatusCode.NotFound).json({ error: 'User not found' });
            }
    
            if (decoded.sub !== existingUser.user_sub) {
                return res.status(HttpStatusCode.Forbidden).json({ error: 'Unauthorized' });
            }
    
            const route = new Route({
                title: parsedData.title,
                type: 'gh',
                route: parsedData.route,
                imageUrl: parsedData.imageUrl,
                routeOptions: parsedData.routeOptions,
            });
    
            const savedRoute = await route.save();
    
            // Update user's profile to include the new route ID
            existingUser.routes.push(savedRoute);
            await existingUser.save();
    
            return res.status(HttpStatusCode.Created).json(savedRoute.id);
        } catch (error) {
            console.error('Error saving route:', error);
            return res.status(HttpStatusCode.InternalServerError).json({ error: 'Internal server error' });
        }
    }    

    async deleteRoute(decoded, userId, routeId, res) {
        try {
            const existingUser = await User.findOne({ _id: userId });
    
            if (!existingUser) {
                console.error('User not found when deleting route');
                return res.status(HttpStatusCode.NotFound).json({ error: 'User not found' });
            }
    
            if (decoded.sub !== existingUser.user_sub) {
                return res.status(HttpStatusCode.Forbidden).json({ error: 'Unauthorized' });
            }
    
            // Check if the routeId exists in the user's routes
            const routeIndex = existingUser.routes.indexOf(routeId);
            if (routeIndex === -1) {
                return res.status(HttpStatusCode.NotFound).json({ error: 'Route not found in user routes' });
            }
    
            await Route.deleteOne({ _id: routeId });
            existingUser.routes.splice(routeIndex, 1);
            await existingUser.save();
    
            return res.status(HttpStatusCode.NoContent).send();
        } catch (error) {
            console.error('Error deleting route:', error);
            return res.status(HttpStatusCode.InternalServerError).json({ error: 'Internal server error' });
        }
    }    
}

module.exports = new UserService();
