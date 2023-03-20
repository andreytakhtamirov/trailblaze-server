# Clone the repo

Clone this repository into a local folder using git.

Issue an `npm install` command so npm downloads the necessary modules.

# Setup necessary files

You need a `.env` file in the `root` directory of the server code. This file need not to have a name, and in its contents there should be:

- `TRAILBLAZE_APP_TOKEN='`**`{secret token here}`**`'`

as well as the MapBox API key

- `MAPBOX_API_KEY='`**`{api key goes here}`**`'`

both in separate lines.

**In your Android project:**
You should:

- make sure the `<string name="mapbox_access_token">`**`{super secret key here}`**`</string>` element is present in the developer-config.xml file in the Trailblaze Android application project.
- change the string pointed to by the `getInstance` function in the `RequestClient.kt` file
  - from `server_endpoint` into `server_dev_endpoint`.

# ngrok

You need `ngrok` to direct the Android app to your local server

- Install `ngrok` as a command line program.

This application will allow requests from the locally-run Trailblaze app to reach the locally-run Trailblaze server

# Running the server

1. Run the Trailblaze server with `npm start`.
2. Start ngrok with `ngrok http 3000`
3. ngrok will output a subdomain `e.g.: https://hiphenatedAlphaNumericCode.ngrok.io`, copy this subdomain and paste it into your Android project's `strings.xml` file, inside the `server_dev_endpoint`'s value
4. Run the Trailblaze Android application from Android Studio.

You should be able to reach the Trailblaze server locally now.
