

async function getIsochronePoly(center, contourMeters) {
    const accessToken = process.env.MAPBOX_API_KEY;

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

module.exports = getIsochronePoly;