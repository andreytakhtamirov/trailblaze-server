const { HttpStatusCode } = require('axios');
const CustomModelGravelCycling = require('../custom_routing/bike_gravel.json')
const CustomModelNormalCycling = require('../custom_routing/bike_normal.json')
const CustomModelHike = require('../custom_routing/hike.json')

// Use local '.env' if not in production.
// Production environment variables are defined in App Service Settings.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const GRAPHHOPPER_ENDPOINT = process.env.GRAPHHOPPER_ENDPOINT;

class GraphhopperHelper {
    static async getRoute(parsedData) {
        const waypoints = [];
        for (const feature of parsedData.waypoints) {
            const center = JSON.parse(feature).center;
            waypoints.push([center[0], center[1]]);
        }

        const isRoundTrip = parsedData.mode == 'round_trip';
        let options = !isRoundTrip ? getOptions(waypoints) : getOptionsRoundTrip(waypoints, parsedData.distance);
        
        if (parsedData.profile == 'cycling') {
            options.custom_model = CustomModelNormalCycling;
        } else if (parsedData.profile == 'gravel_cycling') {
            options.custom_model = CustomModelGravelCycling;
        } else if (parsedData.profile == 'walking') {
            options.custom_model = CustomModelHike;
        }
        
        const query = JSON.stringify(options);

        try {
            const response = await fetch(
                `${GRAPHHOPPER_ENDPOINT}/route`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: query,
                }
            );

            console.log(`Graphhopper response status: ${response.status}`);
            let data = null;

            if (response.status == 200) {
                data = await response.json();
            } else if (response.status !== 200) {
                console.log(`Graphhopper instance: ${GRAPHHOPPER_ENDPOINT}`);
                const message = (await response.json()).message;
                if (message.toLowerCase().includes('cannot find')) {
                    console.log(`Requested point is outside of allowed range. ${message}`);
                    data = HttpStatusCode.NotAcceptable;
                } else if (message.toLowerCase().includes('too far')) {
                    console.log(`Requested points are too far apart. ${message}`);
                    data = HttpStatusCode.UnprocessableEntity;
                } else {
                    console.log(`Other Graphhopper error: ${message}`);
                    data = response.status;
                }
            }
            return data;
        } catch (error) {
            console.error(error)
            return HttpStatusCode.ServiceUnavailable;
        }
    }
}

function getOptions(waypoints) {
    return {
        profile: 'bike_gravel',
        points: waypoints,
        snap_preventions: [
            'motorway',
            'ferry',
            'tunnel'
        ],
        details: ['road_class', 'surface', 'leg_distance', 'leg_time'],
        locale: 'en',
        instructions: true,
        calc_points: true,
        elevation: true,
        optimize: false,
        debug: false,
        points_encoded: true,
        algorithm: 'alternative_route', //astarbi round_trip alternative_route
        'ch.disable': 'false',
        'alternative_route.max_paths': 2,
        'alternative_route.max_weight_factor': 3.5,
        'alternative_route.max_share_factor': 1.4,
    }
}

function getOptionsRoundTrip(waypoints, distance) {
    // Integer seed to randomize calculation.
    let seed = Math.floor(Math.random() * 1000);
    return {
        profile: 'bike_gravel',
        points: waypoints,
        snap_preventions: [
            'motorway',
            'ferry',
            'tunnel'
        ],
        details: ['road_class', 'surface', 'leg_distance', 'leg_time'],
        locale: 'en',
        instructions: true,
        calc_points: true,
        elevation: true,
        optimize: false,
        debug: false,
        points_encoded: true,
        algorithm: 'round_trip',
        'ch.disable': true,
        'round_trip.distance': distance,
        'round_trip.seed': seed,
    }
}

module.exports = GraphhopperHelper;
