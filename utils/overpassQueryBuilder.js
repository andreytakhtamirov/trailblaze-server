
function getPoiForPolyQuery(coordinates) {
    if (coordinates.length == 0) {
        return null;
    }

    const coordinateString = coordinates
        .flat() // Flatten the nested array
        .map(coord => coord.reverse().join(' ')) // Reverse and join latitude and longitude
        .join(' ');

    const query = `[out:json];
                    (
                        way["leisure"="park"]["name"](poly:"${coordinateString}");
                        way["leisure"="nature_reserve"]["name"](poly:"${coordinateString}");
                        way["landuse"="recreation_ground"]["name"](poly:"${coordinateString}");
                    );
                    out center;`;
    return query;
}

module.exports = getPoiForPolyQuery;
