const mongoose = require('mongoose');

const routeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    route: { type: Object, required: true },
    imageUrl: { type: String, default: null },
    routeOptions: { type: Object, required: true },
});

module.exports = mongoose.model('Route', routeSchema, "Routes");