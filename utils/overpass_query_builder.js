class OverpassHelper {
    static getPoiForPolyQuery(coordinates) {
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

    static getOverpassQueryForCoordinates(scanRadius, coordinates) {
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
}

module.exports = OverpassHelper;
