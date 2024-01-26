var express = require('express');
var router = express.Router();
const JwtAuth = require('../../middleware/jwt')
const userService = require('../../services/userService');
const jsonwebtoken = require('jsonwebtoken');

router.get('/', JwtAuth, function (req, res) {
    const token = req.headers.authorization.replace('Bearer ', '');
    const decoded = jsonwebtoken.decode(token);
    userService.getUserProfile(decoded, res);
});

router.post('/:userId/routes', JwtAuth, (req, res) => {
    const userId = req.params.userId;
    const parsedData = JSON.parse(JSON.stringify(req.body));
    userService.saveRoute(userId, parsedData, res);
});

router.delete('/:userId/routes/:routeId', JwtAuth, (req, res) => {
    const userId = req.params.userId;
    const routeId = req.params.routeId;
    userService.deleteRoute(userId, routeId, res);
});

module.exports = router;
