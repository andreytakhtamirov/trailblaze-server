// Use local '.env' if not in production.
// Production environment variables are defined in App Service Settings.
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

// Middleware for checking for the app token. Should be checked in all endpoints.
const verifyAppToken = (req, res, next) => {
  const token = req.get('TRAILBLAZE-APP-TOKEN')
  if (!token || (token !== process.env.TRAILBLAZE_APP_TOKEN && token !== process.env.TRAILBLAZE_APP_TOKEN_NEW)) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  next()
}

module.exports = verifyAppToken;