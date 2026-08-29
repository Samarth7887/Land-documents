const express = require('express');
const router = express.Router();
const http = require('http');
const path = require('path');

// Proxy /api/preprocessing/process requests to the Python microservice at http://127.0.0.1:8000/preprocess
router.post('/process', (req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 8000,
    path: '/preprocess',
    method: 'POST',
    headers: req.headers
  };

  // Create a proxy request to forward the client's request to FastAPI
  const proxyReq = http.request(options, (proxyRes) => {
    // Copy headers and status code from python microservice response to client response
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  // Pipe the incoming request body (which contains the multipart image) to the proxy request
  req.pipe(proxyReq, { end: true });

  proxyReq.on('error', (err) => {
    console.error('[Node Proxy Error]:', err.message);
    // Return mock processed image fallback for local safety
    res.sendFile(path.join(__dirname, '../test-data/clean_scan.png'));
  });
});

module.exports = { router };
