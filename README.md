# About
trailblaze-server is the backend component of the Trailblaze project. It provides a REST API that works in conjunction with [trailblaze-flutter](https://github.com/andreytakhtamirov/trailblaze-flutter) (the frontend app) to enable functionalities like fetching routes and reading/writing user-generated content.

# Installation

Clone this repository into a local folder using git.

Run `npm install` so npm downloads the necessary modules.

# Environment Variables

You need a `.env` file in the root directory of the server code. In this file, specify the following variables:
```
TRAILBLAZE_APP_TOKEN={secret token here}
MAPBOX_API_KEY={api key goes here}
DB_CONNECTION_STRING={mongodb://... address here}
OVERPASS_MAIN_INSTANCE={address of main OSM overpass instance}
OVERPASS_FALLBACK_INSTANCE={address of secondary OSM overpass instance (used if main is busy)}
GRAPHHOPPER_ENDPOINT={address of graphhopper instance}
```

# Usage

`npm start` to run the server.

# API Reference

For detailed information on how to use the API, including endpoint descriptions, request/response formats, and examples, please refer to the [API Documentation](https://github.com/andreytakhtamirov/trailblaze-server/blob/main/api-docs.md).

