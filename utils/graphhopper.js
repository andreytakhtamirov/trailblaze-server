const { HttpStatusCode } = require('axios');
const OptionsResolver = require('./options_resolver.js')

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

        const resolver = new OptionsResolver(parsedData, waypoints);
        const query = JSON.stringify(resolver.resolveOptions());
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

module.exports = GraphhopperHelper;
