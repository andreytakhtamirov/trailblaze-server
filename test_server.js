// test_server.js

const app = require('./app');
const http = require('http');

const port = process.env.PORT || '3000';
app.set('port', port);

const test_server = http.createServer(app);

function startServer() {
  test_server.listen(port, () => {
    console.log(`Test server running at http://localhost:${port}`);
    if (process.env.NODE_ENV.toString().trim() === "test") {
      app.emit('ready');
    }
  });
}

module.exports = { app, startServer };
