const express = require('express');
const router = express.Router();
const http = require('http');

// Proxy /api/validation/validate requests to the Python microservice at http://127.0.0.1:8002/validate
router.post('/validate', (req, res) => {
  // Adaptation logic: if the request isn't already formatted, format it as a ValidationRequest
  let payload = req.body;
  if (!payload || !payload.record) {
    payload = {
      record: req.body || {},
      existing_records: []
    };
  }

  const payloadString = JSON.stringify(payload);

  const options = {
    hostname: '127.0.0.1',
    port: 8012,
    path: '/validate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadString)
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let rawData = '';
    proxyRes.on('data', (chunk) => { rawData += chunk; });
    proxyRes.on('end', () => {
      try {
        res.status(proxyRes.statusCode).json(JSON.parse(rawData));
      } catch (err) {
        res.status(502).json({ success: false, error: 'Malformed response from validation microservice.' });
      }
    });
  });

  proxyReq.on('error', (err) => {
    console.error('[Node Validation Proxy Error]:', err.message);
    res.status(502).json({ 
      success: false, 
      error: 'Failed to connect to Python Validation microservice. Ensure it is running on port 8012.' 
    });
  });

  proxyReq.write(payloadString);
  proxyReq.end();
});

module.exports = { router };
