const express = require('express');
const router = express.Router();
const http = require('http');

// Proxy /api/extraction/extract requests to the Python microservice at http://127.0.0.1:8001/extract
router.post('/extract', (req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 8001,
    path: '/extract' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''),
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
    console.error('[Node Extraction Proxy Error]:', err.message);
    res.status(502).json({ 
      success: false, 
      error: 'Failed to connect to Python Extraction microservice. Ensure it is running on port 8001.' 
    });
  });
});

module.exports = { router };
