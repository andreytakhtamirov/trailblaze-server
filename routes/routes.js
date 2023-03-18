var express = require('express');
var router = express.Router();
const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require('jwks-rsa');
const fetch = require("node-fetch");
const turf = require("@turf/turf");
const polyline = require('@mapbox/polyline');

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

// Middleware for checking for the app token. Should be checked in all endpoints.
const verifyAppToken = (req, res, next) => {
    const token = req.get('TRAILBLAZE-APP-TOKEN')
    if (!token || token !== process.env.TRAILBLAZE_APP_TOKEN) {
        return res.status(401).json({ message: 'Unauthorized' })
    }
    next()
}

router.post('/create-route', verifyAppToken, checkJwt, function (req, res) {
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

router.post('/route-metrics', verifyAppToken, function (req, res) {
    try {
        const parsedData = JSON.parse(JSON.stringify(req.body));
        getInfoAboutRoute(parsedData)
            .then(metrics => {
                res.status(200).send(metrics);
            })
            .catch(error => {
                console.error(error);
                res.status(500).send('Error fetching route metrics');
            });
    } catch (e) {
        console.log("Error getting route metrics: " + e);
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
            'duration'
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

async function getInfoAboutRoute(data) {
    if (data.legs == null || data.legs.length == 0) {
        console.log("Can't get route info: data doesn't have any legs");
        return null;
    }

    // These are needed to be able to parse long routes in a reasonable amount of time.
    let scalingFactor = Math.max(1, Math.round(data.distance / 3000));
    let pointDistanceThreshold = scalingFactor * 100;   // Rough distance between elevation measurement points.

    let coordinateLookupInterval = Math.round(scalingFactor / 2);   // Interval for coordinate surface lookup.

    let coordinatesEveryInterval = [];
    let lastCoordinate = [];

    const surfaceAggregates = {};

    for (const leg of data.legs) {
        const steps = leg.steps;

        // Loop through the steps array to get the coordinates
        for (const step of steps) {
            const geometry = step.geometry;
            const coordinates = polyline.decode(geometry, 6);

            // Aggregate coordinates every interval (scaled to route 
            //  distance) to fetch elevation later.
            for (let i = 0; i < coordinates.length; i++) {
                const coordinate = coordinates[i];

                if (lastCoordinate.length == 0) {
                    lastCoordinate = coordinate;
                    coordinatesEveryInterval.push(lastCoordinate);
                }

                if (lastCoordinate !== coordinate) {
                    let distance = turf.distance(lastCoordinate, coordinate, { units: 'meters' });
                    if (distance >= pointDistanceThreshold) {
                        lastCoordinate = coordinate;
                        coordinatesEveryInterval.push(lastCoordinate);
                    }
                }
            }

            // Calculate surface types along route. It's too costly to look
            //  up every single step so we can skip more in between if the 
            //  route is longer.
            let inferredSurfaceValue = "";
            let lastSetSurfaceValue = "";
            for (let i = 0; i < coordinates.length; i += coordinateLookupInterval) {
                const coordinate = coordinates[i];

                let surface = null;
                if (lastSetSurfaceValue === "") {
                    surface = await getSurfaceFromCoordinate(coordinate);
                }

                if (surface == null) {
                    if (lastSetSurfaceValue == "") {
                        surface = 'undefined';
                        inferredSurfaceValue = surface;
                        i += 1;
                    } else {
                        surface = lastSetSurfaceValue;
                    }
                } else {
                    inferredSurfaceValue = surface;
                    break;
                }
            }

            const mostCommonSurface = inferredSurfaceValue;
            const distance = step.distance;

            if (!surfaceAggregates[mostCommonSurface]) {
                surfaceAggregates[mostCommonSurface] = 0;
            }
            surfaceAggregates[mostCommonSurface] += distance;
        };
    }

    // Build the surface metrics JSON object.
    // eg. {"paved":1984.73,"undefined":941.32}
    const surfaceMetrics = Object.entries(surfaceAggregates)
        .sort((a, b) => b[1] - a[1])
        .reduce((acc, [surface, distance]) => {
            acc[surface] = distance;
            return acc;
        }, {});

    // For elevation there is an API where we can batch lookup coordinates.
    let elevationMetrics = {};
    elevationMetrics.elevations = await getElevationsFromCoordinates(coordinatesEveryInterval);
    elevationMetrics.pointDistance = pointDistanceThreshold;

    const metrics = {
        "surfaceMetrics": surfaceMetrics,
        "elevationMetrics": elevationMetrics
    };

    return metrics;
}

// Uses Mapbox Tilequery API to retrieve the surface type (if any) for a given coordinate.
async function getSurfaceFromCoordinate(coordinates) {
    const accessToken = process.env.MAPBOX_API_KEY;
    const strCoordinates = `${coordinates[1]},${coordinates[0]}`;
    const options = {
        radius: 5,
        limit: 1,
        geometry: 'linestring',
    };

    try {
        const response = await fetch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/${strCoordinates}.json?access_token=${accessToken}&${new URLSearchParams(options)}`);
        const data = await response.json();
        if (response.status !== 200) {
            console.log("Querying surface failed. Mapbox response status: " + response.status);
            console.log(data);
        }

        let surface = null;
        if (data != null && data.features != null && data.features.length > 0) {
            surface = data.features[0].properties.surface;
        }

        return surface;
    } catch (error) {
        return console.error(error);
    }
}

// Uses Open Topo Data API to fetch elevation values for a batch of coordinates.
async function getElevationsFromCoordinates(coordinates) {
    const joinedCoordinates = coordinates.map(coord => coord.join(',')).join('|');

    try {
        const response = await fetch(`https://api.opentopodata.org/v1/test-dataset?locations=${joinedCoordinates}`);
        const data = await response.json();
        if (response.status !== 200) {
            console.log(data);
        }

        let elevations = null;
        if (data != null && data.results != null && data.results.length > 0) {
            // Round all elevation values to 2 decimal places.
            elevations = data.results.map(result => Math.round(result.elevation * 100) / 100);
        }

        return elevations;
    } catch (error) {
        return console.error(error);
    }
}

module.exports = router;
