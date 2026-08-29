const express = require('express');
const router = express.Router();
const http = require('http');

// Proxy POST /api/pipeline/process to Python pipeline service at http://127.0.0.1:8003/process
router.post('/process', (req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 8013,
    path: '/process' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''),
    method: 'POST',
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxyReq, { end: true });

  proxyReq.on('error', (err) => {
    console.error('[Node Pipeline Proxy Error]:', err.message);
    res.status(502).json({ 
      success: false, 
      error: 'Failed to connect to Python Pipeline Orchestrator. Ensure it is running on port 8013.' 
    });
  });
});

// Proxy GET /api/pipeline/status/:id to Python pipeline service at http://127.0.0.1:8003/status/:id
router.get('/status/:id', (req, res) => {
  const options = {
    hostname: '127.0.0.1',
    port: 8013,
    path: `/status/${req.params.id}`,
    method: 'GET'
  };

  const proxyReq = http.request(options, (proxyRes) => {
    let rawData = '';
    proxyRes.on('data', (chunk) => { rawData += chunk; });
    proxyRes.on('end', () => {
      try {
        res.status(proxyRes.statusCode).json(JSON.parse(rawData));
      } catch (err) {
        res.status(502).json({ success: false, error: 'Malformed response from pipeline orchestrator.' });
      }
    });
  });

  proxyReq.on('error', (err) => {
    console.error('[Node Pipeline Status Proxy Error]:', err.message);
    res.status(502).json({ 
      success: false, 
      error: 'Failed to connect to Python Pipeline Orchestrator. Ensure it is running on port 8013.' 
    });
  });

  proxyReq.end();
});

module.exports = { router };
