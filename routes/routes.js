var express = require('express');
var router = express.Router();
const JwtAuth = require('../middleware/jwt');
const fetch = require("node-fetch");
const turf = require("@turf/turf");
const polyline = require('@mapbox/polyline');
const User = require('../models/user');
const Route = require('../models/route');
const jsonwebtoken = require('jsonwebtoken');
const mongoose = require('mongoose');
const OverpassHelper = require('../utils/overpass_query_builder');
const MapboxHelper = require('../utils/mapbox');

// Max number of coordinates which Optimization V1 (route calculation API) will take.
const MAX_WAYPOINTS_COUNT = 12;

// Collected all paved surface types from https://wiki.openstreetmap.org/wiki/Key:surface
const SURFACES_PAVED = ["asphalt", "paved", "concrete", "compacted", "paving_stones", "chipseal", "concrete:plates", "concrete:lanes", "sett", "unhewn_cobblestone", "cobblestone", "metal", "wood", "rubber"];
const SURFACE_PAVED_LABEL = "paved";
const SURFACE_UNPAVED_LABEL = "unpaved";
const SURFACE_UNKNOWN_LABEL = "unknown";

// Use local '.env' if not in production.
// Production environment variables are defined in App Service Settings.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const DB_URI = process.env.DB_CONNECTION_STRING;
const mapboxHelper = new MapboxHelper(process.env.MAPBOX_API_KEY);

router.post('/features', function (req, res) {
    const parsedData = JSON.parse(JSON.stringify(req.body));

    mapboxHelper.getIsochronePoly(parsedData.center, parsedData.distance).then(data => {
        if (data.features == null) {
            res.status(404).send({ message: "No routes available around this location." });
            return;
        }

        const query = OverpassHelper.getPoiForPolyQuery(data.features[0].geometry.coordinates);
        if (query == null) {
            res.status(404).send({ message: "No points found." });
            return;
        }

        getOsmResults(query).then(data => {
            data.sort((a, b) => b.nodes.length - a.nodes.length);
            // Send back the top 10 points, sorted by number of nodes (how many paths they have).
            // TODO: This may not be a reliable way to order parks.
            const top10Data = data.slice(0, 10);
            res.status(200).send({ features: top10Data });
        })
            .catch(error => {
                console.error(error);
                res.status(500).send('Error fetching points from Overpass');
            });
    })
        .catch(error => {
            console.error(error);
            res.status(500).send('Error fetching isochrone poly from Mapbox');
        });
});

router.post('/create-route', function (req, res) {
    try {
        const parsedData = JSON.parse(JSON.stringify(req.body));

        let improveRoute = false;
        if (JSON.stringify(parsedData.profile).includes("_plus")) {
            // Check if the user wants an improved route (including nearby parks).
            parsedData.profile = parsedData.profile.substring(0, parsedData.profile.length - "_plus".length);
            improveRoute = true;
        }
        mapboxHelper.getMapboxRoute(parsedData)
            .then(data => {
                if (typeof data == 'number') {
                    res.status(data).send('Error creating route');
                    return;
                }

                if (!improveRoute) {
                    // If user doesn't want improved route, we can simply send the mapbox-generated route.
                    data.routeOptions = {
                        "profile": parsedData.profile,
                        "waypoints": parsedData.waypoints
                    };

                    res.status(200).send(data);
                    return;
                }

                getPoiAlongRoute(data.routes[0], parsedData.waypoints.length)
                    .then(pointsOfInterest => {
                        mapboxHelper.getMapboxOptimizationPlusWaypoints(parsedData, pointsOfInterest)
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

router.post('/create-route-pathsense', function (req, res) {
    try {
        const parsedData = JSON.parse(JSON.stringify(req.body));
        getPathsenseRoute(parsedData)
            .then(data => {
                if (typeof data != 'number') {
                    data.routeOptions = {
                        "profile": parsedData.profile,
                        "waypoints": parsedData.waypoints
                    }

                    res.status(200).send(data);
                } else {
                    // Pass status code from Pathsense as response.
                    res.sendStatus(data);
                }
            })
            .catch(error => {
                console.error(error);
                res.status(500).send('Error fetching route.');
            });
    } catch (e) {
        console.log("Error creating route: " + e);
    }
});

router.post('/update-route', function (req, res) {
    try {
        const parsedData = JSON.parse(JSON.stringify(req.body));
        mapboxHelper.getMapboxOptimizationForWaypoints(parsedData)
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
                console.error(error);
                res.status(500).send('Error fetching route from Mapbox');
            });
    } catch (e) {
        console.log("Error updating route: " + e);
    }
});

router.post('/route-metrics', function (req, res) {
    try {
        const parsedData = JSON.parse(JSON.stringify(req.body));
        getInfoAboutRoute(parsedData)
            .then(metrics => {
                if (metrics == null) {
                    res.status(400).send(metrics);
                    return;
                }

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

router.post('/save-route', JwtAuth, function (req, res) {
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

router.get('/get-routes', JwtAuth, async (req, res) => {
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

router.get('/get-routes-count', JwtAuth, async (req, res) => {
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

async function getPathsenseRoute(parsedData) {
    // For now pathsense only supports 1 profile
    const profile = parsedData.profile;

    const centerList = [];
    for (const feature of parsedData.waypoints) {
        const center = JSON.parse(feature).center;
        const longitude = center[0];
        const latitude = center[1];
        centerList.push({ longitude, latitude });
    }

    const request_body = {
        origin: centerList.at(0),
        destination: centerList.at(1)
    };

    try {
        const response = await fetch("https://trailblaze-pathsense.azurewebsites.net/api/FindRoute", {
            method: "POST",
            body: JSON.stringify(request_body),
            headers: {
                "Content-Type": "application/json"
            }
        });

        console.log("Trailblaze response status (Pathsense API): " + response.status);
        let data = null;
        if (response.status == 200) {
            data = await response.json();
        } else if (response.status !== 200) {
            data = await response.status;
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

    let query = getOverpassQueryForCoordinates(pointDistanceThreshold, coordinatesEveryInterval);
    let points = await getOsmResults(query);
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

    // Query for getting a geometry of the route with OSM.
    let query = "[out:json];(";

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

                query += `way["highway"](around:2, ${coordinate[0]}, ${coordinate[1]});`;

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
        }
    }

    query += ");out geom;";

    // Get a geometry of the route from OSM. 
    //  This includes road data such as names and surface types.
    const osmGeometry = await getOsmResults(query);
    const surfaceAggregates = {};

    // Match each coordinate with a surface type using OSM data.
    for (const leg of data.legs) {
        for (const step of leg.steps) {
            const geometry = step.geometry;
            const coordinates = polyline.decode(geometry, 6);

            let inferredSurfaceValue = "";
            for (let i = 0; i < coordinates.length; i++) {
                const coordinate = coordinates[i];

                let surface = findNearestSurfaceType(osmGeometry, coordinate);

                if (surface == null) {
                    surface = SURFACE_UNKNOWN_LABEL;
                    inferredSurfaceValue = surface;
                } else {
                    if (SURFACES_PAVED.includes(surface)) {
                        inferredSurfaceValue = SURFACE_PAVED_LABEL;
                    } else {
                        inferredSurfaceValue = SURFACE_UNPAVED_LABEL;
                    }
                    break;
                }
            }

            const distance = step.distance;
            if (!surfaceAggregates[inferredSurfaceValue]) {
                surfaceAggregates[inferredSurfaceValue] = 0;
            }

            surfaceAggregates[inferredSurfaceValue] += distance;
        }
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

function findNearestSurfaceType(osmGeometry, coord) {
    let nearestDist = Infinity;
    let nearestSurfaceType = null;

    for (let way of osmGeometry) {
        // Get the minimum distance from a point to a lineString (road).
        // We can assume that the point lies on that road and infer the 
        //  surface type from it.
        const coords = way.geometry.map(node => [node.lat, node.lon]);
        const dist = turf.pointToLineDistance(turf.point(coord), turf.lineString(coords));

        if (dist < nearestDist) {
            nearestDist = dist;
            nearestSurfaceType = way.tags?.surface ?? null;
        }
    }

    return nearestSurfaceType;
}

function getOverpassQueryForCoordinates(scanRadius, coordinates) {
    const overpassQuery = `
    [out:json];
    (
      ${coordinates.map(coordinate => `
        way["leisure"="park"](around:${scanRadius},${coordinate[0]},${coordinate[1]});
        way["leisure"="nature_reserve"](around:${scanRadius},${coordinate[0]},${coordinate[1]});
        way["landuse"="recreation_ground"](around:${scanRadius},${coordinate[0]},${coordinate[1]});
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

async function getOsmResults(query) {
    const url = process.env.OVERPASS_MAIN_INSTANCE;

    try {
        let response = await fetch(url, {
            method: 'POST',
            body: query
        });

        let data = null;

        try {
            data = await response.json();
        }
        catch (e) {
            console.log("Failed to parse overpass response: " + response.status);
        }

        if (response.status !== 200) {
            console.log("Querying points failed. OpenStreetMap response status: " + response.status);
            console.log(data);
        }

        if (response.status >= 500 && response.status < 600) {
            // If this request failed, attempt a second one using a different instance.
            console.log("Server error. Let's try the fallback instance.");
            response = await getOverpassQueryFallback(query);
            data = await response.json();
        }

        let elements = null;
        if (data != null) {
            elements = data.elements;
        }

        return elements;
    } catch (error) {
        console.error(error);
    }
}

async function getOverpassQueryFallback(query) {
    const url = process.env.OVERPASS_FALLBACK_INSTANCE;

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: query
        });

        return response;
    } catch (error) {
        console.error(error);
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
