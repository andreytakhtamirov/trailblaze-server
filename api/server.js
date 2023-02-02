// set dependencies
const express = require('express');
const app = express();
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const cors = require('cors');
const bodyParser = require('body-parser');

// Enable CORS
app.use(cors());

// Create middleware for checking the JWT
const checkJwt = jwt({ // FILIPE: The problem is this. I have no clue why it thinks this is not a function.
  // Dynamically provide a signing key based on the kid in the header and the signing keys provided by the JWKS endpoint
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://dev-trailblaze.us.auth0.com/.well-known/jwks.json`
  }),

  
  // Validate the audience and the issuer
  audience: '{YOUR_API_IDENTIFIER}', //replace with your API's audience, available at Dashboard > APIs
  issuer: 'https://dev-trailblaze.us.auth0.com/', 
  algorithms: [ 'RS256' ]
});

// Enable the use of request body parsing middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// create timesheets API endpoint - code omitted
app.post('/timesheets', checkJwt, function(req, res){
  var timesheet = req.body;

  // Save the timesheet to the database...

  //send the response
  res.status(201).send(timesheet);
});

var port = normalizePort(process.env.PORT || '3000');

// Launch the API Server at localhost:3000
app.listen(port);




/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}