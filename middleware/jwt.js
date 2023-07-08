const { expressjwt: jwt } = require("express-jwt");
const jwksRsa = require('jwks-rsa');

// Middleware for checking the JWT
const checkJwt = jwt({
    // Dynamically provide a signing key based on the header 
    //  and the signing keys provided by the JWKS endpoint.
    secret: jwksRsa.expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://dev-trailblaze.us.auth0.com/.well-known/jwks.json`
    }),

    issuer: 'https://dev-trailblaze.us.auth0.com/',
    algorithms: ['RS256']
});

module.exports = checkJwt;