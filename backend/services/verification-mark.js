const express = require('express');
const router = express.Router();
const http = require('http');

// Proxy POST /api/verification-mark/sign to Python service on port 8004
router.post('/sign', (req, res) => {
  const payloadString = JSON.stringify(req.body);

  const options = {
    hostname: '127.0.0.1',
    port: 8004,
    path: '/sign',
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
        res.status(502).json({ success: false, error: 'Malformed response from signing service.' });
      }
    });
  });

  proxyReq.on('error', (err) => {
    console.error('[Node Sign Proxy Error]:', err.message);
    res.status(502).json({ 
      success: false, 
      error: 'Failed to connect to Python Signer microservice. Ensure it is running on port 8004.' 
    });
  });

  proxyReq.write(payloadString);
  proxyReq.end();
});

// Proxy POST /api/verification-mark/verify to Python service on port 8004
router.post('/verify', (req, res) => {
  const payloadString = JSON.stringify(req.body);

  const options = {
    hostname: '127.0.0.1',
    port: 8004,
    path: '/verify',
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
        res.status(502).json({ success: false, error: 'Malformed response from verification service.' });
      }
    });
  });

  proxyReq.on('error', (err) => {
    console.error('[Node Verify Proxy Error]:', err.message);
    res.status(502).json({ 
      success: false, 
      error: 'Failed to connect to Python Signer microservice. Ensure it is running on port 8004.' 
    });
  });

  proxyReq.write(payloadString);
  proxyReq.end();
});

module.exports = { router };
