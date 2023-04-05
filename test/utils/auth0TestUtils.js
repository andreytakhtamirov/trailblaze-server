// auth0TestUtils.js

// Some scaffolding for how we might be able to create a test user, but which is not in user right now

const jwt = require('jsonwebtoken');
const axios = require('axios');

async function createTestUser(email, password, connection) {
  const data = {
    email,
    password,
    connection,
  };

  const url = `https://${process.env.AUTH0_DOMAIN}/dbconnections/signup`;

  try {
    console.log('Request URL:', url);
    console.log('Request data:', data);

    const response = await axios.post(url, data);
    return response.data;
  } catch (error) {
    console.error('Error in createTestUser:', error.message);
    if (error.response) {
      console.error('Error response data:', error.response.data);
    }
  }
}

async function deleteTestUser(userId) {
  const token = jwt.sign(
    {
      iss: process.env.AUTH0_CLIENT_ID,
      aud: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
      iat: Math.floor(Date.now() / 1000),
      scope: 'delete:users',
    },
    process.env.AUTH0_CLIENT_SECRET,
    { algorithm: 'HS256' }
  );

  await axios.delete(`https://${process.env.AUTH0_DOMAIN}/api/v2/users/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function getIdToken(email, password, clientId, domain) {
  const data = {
    grant_type: 'password',
    username: email,
    password,
    audience: process.env.AUTH0_AUDIENCE,
    scope: 'openid email profile',
    client_id: clientId,
  };

  const response = await axios.post(`https://${domain}/oauth/token`, data);
  return response.data.id_token;
}

module.exports = { createTestUser, deleteTestUser, getIdToken };
