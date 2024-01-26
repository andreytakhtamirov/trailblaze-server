var express = require('express');
var router = express.Router();
const GraphhopperHelper = require('../../utils/graphhopper');

// Use local '.env' if not in production.
// Production environment variables are defined in App Service Settings.
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

router.post('/create-route-graphhopper', function (req, res) {
    try {
        const parsedData = JSON.parse(JSON.stringify(req.body));
        GraphhopperHelper.getGraphhopperRoute(parsedData)
            .then(data => {
                if (typeof data != 'number') {
                    data.routeOptions = {
                        "profile": parsedData.profile,
                        "waypoints": parsedData.waypoints
                    };

                    res.status(200).send(data);
                } else {
                    // Pass status code from Graphhopper as response.
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

module.exports = router;
