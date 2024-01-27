const { HttpStatusCode } = require('axios');
const CustomModelGravelCycling = require('../custom_routing/bike_gravel.json')

// Use local '.env' if not in production.
// Production environment variables are defined in App Service Settings.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const GRAPHHOPPER_ENDPOINT = process.env.GRAPHHOPPER_ENDPOINT;

class GraphhopperHelper {
    static async getGraphhopperRoute(parsedData) {
        const waypoints = [];
        for (const feature of parsedData.waypoints) {
            const center = JSON.parse(feature).center;
            waypoints.push([center[0], center[1]]);
        }

        const query = JSON.stringify(getGraphhopperOptions(waypoints));

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

function getGraphhopperOptions(waypoints) {
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
        // heading: 0,
        // heading_penalty: 120,
        // pass_through: false,
        algorithm: 'alternative_route', //astarbi round_trip alternative_route
        'ch.disable': 'false',
        // 'round_trip.distance': '5000',
        // 'round_trip.seed': '0',
        'alternative_route.max_paths': 2,
        'alternative_route.max_weight_factor': 3.5,
        'alternative_route.max_share_factor': 1.4,
        custom_model: CustomModelGravelCycling
    }
}

module.exports = GraphhopperHelper;
