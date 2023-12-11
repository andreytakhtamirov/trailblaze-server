const User = require('../models/user');
const Route = require('../models/route');
const Post = require('../models/post');
const mongoose = require('mongoose');

const DB_URI = process.env.DB_CONNECTION_STRING;

function deleteUser(decodedSub) {
    return new Promise((resolve, reject) => {
        fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: process.env.AUTH0_CLIENT_ID,
                client_secret: process.env.AUTH0_CLIENT_SECRET,
                audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
            }),
        })
            .then(response => response.json())
            .then((data) => {
                fetch(`https://${process.env.AUTH0_DOMAIN}/api/v2/users/${decodedSub}`, {
                    method: 'DELETE',
                    redirect: 'follow',
                    headers: { Authorization: `Bearer ${data.access_token}` },
                })
                    .then(response => {
                        const statusCode = response.status;
                        switch (statusCode) {
                            case 204:
                                resolve('User successfully deleted.');
                                break;
                            case 401:
                                reject('Invalid token.');
                                break;
                            case 403:
                                reject('Forbidden: Insufficient scope or mismatched user.');
                                break;
                            default:
                                reject(`Unhandled status code: ${statusCode}`);
                                break;
                        }
                        return response.text();
                    })
                    .catch(error => reject('Error deleting user: ' + error))
            })
            .catch(error => reject(error));
    });
}

function deleteUserAndAssociatedData(decodedSub) {
    return new Promise((resolve, reject) => {
        mongoose.connect(DB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        })
            .then(() => {
                User.findOneAndDelete({ user_sub: decodedSub })
                    .then(deletedUser => {
                        if (deletedUser) {
                            const deleteRoutes = Route.deleteMany({ _id: { $in: deletedUser.routes } });
                            const deletePosts = Post.deleteMany({ _id: { $in: deletedUser.posts } });
                            const decrementLikes = Post.updateMany(
                                { _id: { $in: deletedUser.likes } },
                                { $inc: { likes: -1 } }
                            );

                            Promise.all([deleteRoutes, deletePosts, decrementLikes])
                                .then(() => {
                                    resolve('User successfully deleted.');
                                })
                                .catch(err => {
                                    reject('Error performing deletion operations: ' + err);
                                });
                        } else {
                            resolve('User not found in database.');
                        }
                    })
                    .catch(err => {
                        reject('Internal server error: ' + err);
                    });
            })
            .catch(err => {
                reject('Database connection error: ' + err);
            });
    });
}

module.exports = {
    deleteUserAndAssociatedData,
    deleteUser
};
