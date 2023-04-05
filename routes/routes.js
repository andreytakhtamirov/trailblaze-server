var express = require('express');
var router = express.Router();
const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require('jwks-rsa');
const fetch = require("node-fetch");
const turf = require("@turf/turf");
const polyline = require('@mapbox/polyline');
const User = require('../models/user');
const Route = require('../models/route');
const jsonwebtoken = require('jsonwebtoken');
const mongoose = require('mongoose');

// Max number of coordinates which Optimization V1 (route calculation API) will take.
const MAX_WAYPOINTS_COUNT = 12;

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

router.post('/create-route', verifyAppToken, function (req, res) {
    try {
        const parsedData = JSON.parse(JSON.stringify(req.body));
        getMapboxRoute(parsedData)
            .then(data => {
                getPoiAlongRoute(data.routes[0], parsedData.waypoints.length)
                    .then(pointsOfInterest => {
                        getMapboxOptimizationPlusWaypoints(parsedData, pointsOfInterest)
                            .then(optimizedData => {
                                // Optimize API returns routes inside a "trips" array.
                                // Rename this field to "routes" so our client can process it.
                                optimizedData.routes = optimizedData.trips;
                                delete optimizedData.trips;

                                optimizedData.routeOptions = {
                                    "profile": parsedData.profile,
                                    "waypoints": parsedData.waypoints
                                }

                                res.status(200).send(optimizedData);
                            })
                            .catch(error => {
                                // If we fail to create a route with improvements,
                                //  we might be able to return the normal route instead.
                                console.error(error);
                                res.status(500).send('Error fetching route improvements.');
                            });
                    })
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

router.post('/save-route', verifyAppToken, checkJwt, function (req, res) {
    const token = req.headers.authorization.replace('Bearer ', '');
    const decoded = jsonwebtoken.decode(token);

    const user = {
        email: decoded.email,
        username: decoded.name,
        user_sub: decoded.sub,
    };

    const parsedData = JSON.parse(JSON.stringify(req.body));
    let imageUrl = null;

    if (parsedData.imageUrl != null) {
        imageUrl = parsedData.imageUrl;
    }

    // Connect to database.
    mongoose.connect(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
        .then(() => {
            // Save route from request body data.
            const route = new Route({
                title: parsedData.title,
                route: parsedData.route,
                imageUrl: imageUrl,
                routeOptions: parsedData.routeOptions
            });

            return route.save();
        })
        .then(savedRoute => {
            // Once we have a saved route, find or create a user.
            // user_sub is the more unique field, since users can sign in with the same
            //  email address from multiple sources (google as well as auth0 database).
            User.findOne({ user_sub: user.user_sub })
                .then(existingUser => {
                    if (existingUser) {
                        // We have an existing user. Update to include new route ID.
                        existingUser.routes.push(savedRoute);
                        return existingUser.save();
                    } else {
                        // Create a new user including the new route ID.
                        const newUser = new User({
                            email: user.email,
                            username: user.username,
                            user_sub: user.user_sub,
                            routes: savedRoute._id,
                            likes: [],
                        });

                        return newUser.save();
                    }
                })
                .then(savedUser => {
                    res.status(200).json(savedRoute);
                })
                .catch(err => {
                    console.error(err);
                    res.status(500).send('Internal server error');
                });
        }).catch(err => {
            console.error(err);
            // Potential improvement: Mention the specific part that was invalid.
            res.status(500).send('Incomplete route data');
        });
});

router.get('/get-routes', verifyAppToken, checkJwt, async (req, res) => {
    mongoose.connect(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
        .then(() => {
            try {
                const token = req.headers.authorization.replace('Bearer ', '');
                const decoded = jsonwebtoken.decode(token);

                User.findOne({ user_sub: decoded.sub }).populate('routes')
                    .then((user) => {
                        if (!user) {
                            return res.status(404).send('User not found');
                        }

                        const page = parseInt(req.query.page) || 1;
                        const limit = 5;
                        const startIndex = (page - 1) * limit;

                        Route.find({ _id: { $in: user.routes } })
                            .sort({ _id: -1 })
                            .skip(startIndex)
                            .limit(limit)
                            .then((routes) => {
                                res.json(routes);
                            });
                    });
            } catch (error) {
                console.error(error);
                res.status(500).send('Server error');
            }
        });
});

router.get('/get-routes-count', verifyAppToken, checkJwt, async (req, res) => {
    mongoose.connect(DB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
        .then(() => {
            try {
                const token = req.headers.authorization.replace('Bearer ', '');
                const decoded = jsonwebtoken.decode(token);

                User.findOne({ user_sub: decoded.sub })
                    .then((user) => {
                        if (!user) {
                            return res.status(404).send('User not found');
                        }

                        const routesCount = user.routes.length;
                        res.json({ count: routesCount });
                    });
            } catch (error) {
                console.error(error);
                res.status(500).send('Server error');
            }
        });
});

async function getMapboxRoute(parsedData) {
    const accessToken = process.env.MAPBOX_API_KEY;
    const profile = parsedData.profile;

    const centerList = [];
    for (const feature of parsedData.waypoints) {
        const center = JSON.parse(feature).center;
        centerList.push(center.join(','));
    }

    const waypoints = centerList.join(';');

    const routeOptions = {
        annotations: [
            'distance',
            'duration'
        ],
        exclude: ['ferry'],
        steps: true,
        // We don't need alternatives anymore since we'll be
        //  making improvements to the first route we get.
        alternatives: false,
        overview: 'full',
        geometries: 'polyline6'
    };

    try {
        const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${waypoints}?access_token=${accessToken}&${new URLSearchParams(routeOptions)}`);
        console.log("Mapbox response status (Directions API): " + response.status);
        const data = await response.json();
        if (response.status !== 200) {
            console.log(data);
        }
        return data;
    } catch (error) {
        return console.error(error);
    }
}

async function getMapboxOptimizationPlusWaypoints(parsedData, pointsOfInterest) {
    // The Optimization API differs from the Directions API since it aims to optimize
    //  navigation for the waypoints provided. We'll no longer need to ask the user to
    //  specify the waypoints in any particular order.
    const accessToken = process.env.MAPBOX_API_KEY;
    const profile = parsedData.profile;
    const roundTrip = false; // This could be set by the client.

    const centerList = [];
    for (const feature of parsedData.waypoints) {
        const center = JSON.parse(feature).center;
        centerList.push(center.join(','));
    }

    let finalWaypointsString;
    const additionalWaypointsString = pointsOfInterest.map((wp) => {
        return `${wp.coordinates[0]},${wp.coordinates[1]}`;
    }).join(';');
    if (centerList.length === 2) {
        // If there are only 2 waypoints (origin and destination), treat he second 
        //  point as the true destination (destination: 'last') in our route options.
        if (additionalWaypointsString) {
            finalWaypointsString = `${centerList[0]};${additionalWaypointsString};${centerList[1]}`;
        } else {
            finalWaypointsString = `${centerList[0]};${centerList[1]}`;
        }
    } else {
        finalWaypointsString = centerList.join(';');
        if (additionalWaypointsString) {
            finalWaypointsString += `;${additionalWaypointsString}`;
        }
    }

    const routeOptions = {
        annotations: [
            'distance',
            'duration'
        ],
        steps: true,
        overview: 'full',
        geometries: 'polyline6',
        source: 'first',
        destination: 'last',
        roundtrip: roundTrip
    };

    try {
        const response = await fetch(`https://api.mapbox.com/optimized-trips/v1/mapbox/${profile}/${finalWaypointsString}?access_token=${accessToken}&${new URLSearchParams(routeOptions)}`);
        console.log("Mapbox response status (Optimization API): " + response.status);
        const data = await response.json();
        if (response.status !== 200) {
            console.log(data);
        }
        return data;
    } catch (error) {
        return console.error(error);
    }
}

async function getPoiAlongRoute(route, userWaypointsLength) {
    if (route.legs == null || route.legs.length == 0) {
        console.log("Can't get route info: route doesn't have any legs");
        return null;
    }

    // Will take points every 1km to look up features in a 1km radius around them.
    let pointDistanceThreshold = 1000;

    let coordinatesEveryInterval = [];
    let distancesEveryInterval = [];
    let lastCoordinate = [];

    for (const leg of route.legs) {
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
                    distancesEveryInterval.push(0);
                }

                if (lastCoordinate !== coordinate) {
                    let distance = turf.distance(lastCoordinate, coordinate, { units: 'meters' });
                    if (distance >= pointDistanceThreshold) {
                        lastCoordinate = coordinate;
                        coordinatesEveryInterval.push(lastCoordinate);

                        // Round associated distance to 2 decimal places.
                        distancesEveryInterval.push(Math.round(distance * 100) / 100);
                    }
                }
            }
        };
    }

    let query = getOverpassQueryForCoordinates(coordinatesEveryInterval);
    let points = await getPointsFromQuery(query);
    if (points == null) {
        console.log("Error. No points returned from OSM.");
        return;
    }

    // Aggregate all the coordinates for every named trail/park.
    // We'll also grab the number of tags (added by OpenStreetMap users)
    //  for that feature. It's assumed that the more tags a feature has,
    //  the more important it is.
    const count = {};
    points.forEach(point => {
        const name = point.tags.name;
        if (name in count) {
            count[name].count += 1;
            count[name].coordinates.push([point.center.lon, point.center.lat]);
            count[name].numTags.push(Object.keys(point.tags).length);
        } else {
            count[name] = {
                count: 1,
                coordinates: [[point.center.lon, point.center.lat]],
                numTags: [Object.keys(point.tags).length]
            }
        }
    });

    const trails = Object.entries(count)
        .map(([name, { count, coordinates, numTags }]) => ({ name, count, coordinates: coordinates.toString(), numTags }));

    // The trails that we retrieve may have multiple coordinates for a given name.
    //  Below we'll iterate through and set the coordinates of each trail by the highest
    //  quality match (quality just means more tags on OSM).
    const trailCoords = [];
    for (const trail of trails) {
        const coordsArray = trail.coordinates.split(',');
        let maxNumberOfTags = 0;
        let bestCoordPair;

        if (coordsArray.length < 4 && coordsArray.length > 0) {
            bestCoordPair = [parseFloat(coordsArray[0]), parseFloat(coordsArray[1])];
        }

        let tagIterator = 0;
        for (let i = 0; i < coordsArray.length; i += 2) {
            const toCoord = [parseFloat(coordsArray[i]), parseFloat(coordsArray[i + 1])];
            let numberOfTags = trail.numTags[tagIterator];
            tagIterator++;

            if (!toCoord[0] || !toCoord[1]) {
                continue;
            }

            if (numberOfTags > maxNumberOfTags) {
                maxNumberOfTags = numberOfTags;
                bestCoordPair = toCoord;
            }
        }

        trailCoords.push({ name: trail.name, coordinates: bestCoordPair, quality: trail.numTags.reduce((a, b) => a + b) });
    }

    trailCoords.sort((a, b) => b.quality - a.quality);

    // Calculate the average quality.
    let total = 0;
    for (let i = 0; i < trailCoords.length; i++) {
        total += trailCoords[i].quality;
    }

    let avg = total / trailCoords.length;

    // Filter the trails with a quality higher than the average quality.
    //  We'll take only the trails that stand out from the rest.
    let filteredTrails = trailCoords.filter(obj => obj.quality > avg);

    // We can include up to 12 waypoints in the Optimization request.
    let numOfPOIs = 0;
    if (userWaypointsLength < MAX_WAYPOINTS_COUNT) {
        numOfPOIs = MAX_WAYPOINTS_COUNT - userWaypointsLength;
    }

    return filteredTrails.slice(0, numOfPOIs);
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
    let distancesEveryInterval = [];
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
                    distancesEveryInterval.push(0);
                }

                if (lastCoordinate !== coordinate) {
                    let distance = turf.distance(lastCoordinate, coordinate, { units: 'meters' });
                    if (distance >= pointDistanceThreshold) {
                        lastCoordinate = coordinate;
                        coordinatesEveryInterval.push(lastCoordinate);

                        // Round associated distance to 2 decimal places.
                        distancesEveryInterval.push(Math.round(distance * 100) / 100);
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
                    // Commented out fetching surface types for now to reduce API usage limits.
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
    elevationMetrics.distances = distancesEveryInterval;

    const metrics = {
        "surfaceMetrics": surfaceMetrics,
        "elevationMetrics": elevationMetrics
    };

    return metrics;
}

function getOverpassQueryForCoordinates(coordinates) {
    const radius = 1000;
    const overpassQuery = `
    [out:json];
    (
      ${coordinates.map(coordinate => `
        way["leisure"="park"](around:${radius},${coordinate[0]},${coordinate[1]});
        way["leisure"="nature_reserve"](around:${radius},${coordinate[0]},${coordinate[1]});
        way["landuse"="recreation_ground"](around:${radius},${coordinate[0]},${coordinate[1]});
      `).join('')}
    );
    (
      way["bicycle"="designated"][name](around:1);
      way["bicycle"="yes"][name](around:1);
    );
    (
      way["leisure"="park"][name](around:100);
      way["leisure"="nature_reserve"][name](around:100);
      way["landuse"="recreation_ground"][name](around:100);
    );
    out center;`;

    return overpassQuery;
}

async function getPointsFromQuery(query) {
    const url = 'https://overpass-api.de/api/interpreter';

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: query
        });

        const data = await response.json();
        if (response.status !== 200) {
            console.log("Querying points failed. OpenStreetMap response status: " + response.status);
            console.log(data);
        }

        let points = null;
        if (data != null) {
            points = data.elements;
        }

        return points;
    } catch (error) {
        console.error(error);
    }
}

// Uses Mapbox Tilequery API to retrieve the surface type (if any) for a given coordinate.
async function getSurfaceFromCoordinate(coordinate) {
    const accessToken = process.env.MAPBOX_API_KEY;
    const strCoordinates = `${coordinate[1]},${coordinate[0]}`;
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
        const response = await fetch(`https://api.opentopodata.org/v1/srtm30m?locations=${joinedCoordinates}`);
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
