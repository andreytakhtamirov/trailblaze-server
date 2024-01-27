class MapboxHelper {
    constructor(apiKey) {
        this.MAPBOX_API_KEY = apiKey;
    }

    async getMapboxRoute(parsedData) {
        const accessToken = this.MAPBOX_API_KEY;
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
                return response.status;
            }
            return data;
        } catch (error) {
            return console.error(error);
        }
    }

    async getMapboxOptimizationPlusWaypoints(parsedData, pointsOfInterest) {
        // The Optimization API differs from the Directions API since it aims to optimize
        //  navigation for the waypoints provided. We'll no longer need to ask the user to
        //  specify the waypoints in any particular order.
        const accessToken = this.MAPBOX_API_KEY;
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

    async getMapboxOptimizationForWaypoints(parsedData) {
        // This method should be used to calculate a route with known points.
        //  (when we already know the points of interest). It will return the 
        //  shortest path between all of them.
        const accessToken = process.env.MAPBOX_API_KEY;
        const profile = parsedData.profile;
        const roundTrip = false; // This could be set by the client.

        const waypoints = parsedData.waypoints.map((waypoint) => {
            const parsedWaypoint = JSON.parse(waypoint);
            const [longitude, latitude] = parsedWaypoint.coordinates;
            return `${longitude},${latitude}`;
        });

        const finalWaypointsString = waypoints.join(';');

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

    async getIsochronePoly(center, contourMeters) {
        const accessToken = this.MAPBOX_API_KEY;

        const centerList = center.join(',');

        const options = {
            contours_meters: parseInt(contourMeters),
            polygons: true,
            denoise: 1,
            generalize: 500
        };

        try {
            const response = await fetch(`https://api.mapbox.com/isochrone/v1/mapbox/walking/${centerList}?access_token=${accessToken}&${new URLSearchParams(options)}`);
            console.log("Mapbox response status (Isochrone API): " + response.status);
            const data = await response.json();
            if (response.status !== 200) {
                console.log(data);
            }
            return data;
        } catch (error) {
            return console.error(error);
        }
    }
}

module.exports = MapboxHelper;
