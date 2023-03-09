var express = require('express');
var router = express.Router();
const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require('jwks-rsa');

// Use local '.env' if not in production.
// Production environment variables are defined in App Service Settings.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

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

router.post('/', checkJwt, function (req, res) {
    try {
        const parsedData = JSON.parse(JSON.stringify(req.body)).nameValuePairs;
        getMapboxRoute(parsedData)
            .then(data => {
                res.status(200).send(data);
            })
            .catch(error => {
                console.error(error);
                res.status(500).send('Error fetching route from Mapbox');
            });
    } catch (e) {
        console.log("Error creating route: " + e);
    }
});

async function getMapboxRoute(parsedData) {
    const accessToken = process.env.MAPBOX_API_KEY;
    const profile = parsedData.profile;
    const distance = parsedData.distance; // Unused for now

    const waypoints = parsedData.waypoints.values.map((wp) => {
        const { coordinates } = JSON.parse(wp);
        return `${coordinates[0]},${coordinates[1]}`;
    }).join(';');

    const routeOptions = {
        annotations: [
            'distance',
            'duration',
            'speed'
        ],
        exclude: ['ferry'],
        steps: true,
        alternatives: true,
        overview: 'full',
        geometries: 'polyline6'
    };

    try {
        const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${waypoints}?access_token=${accessToken}&${new URLSearchParams(routeOptions)}`);
        console.log("Mapbox response status: " + response.status);
        const data = await response.json();
        if (response.status !== 200) {
            console.log(data);
        }
        return data;
    } catch (error) {
        return console.error(error);
    }
}

module.exports = router;
