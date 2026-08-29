const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Import service routes/controllers
const preprocessingService = require('./services/preprocessing');
const extractionService = require('./services/extraction');
const validationService = require('./services/validation');
const verificationService = require('./services/verification');
const pipelineService = require('./services/pipeline');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Land Records Backend is active' });
});

// Setup mount points/routes for service modules if needed
app.use('/api/preprocessing', preprocessingService.router);
app.use('/api/extraction', extractionService.router);
app.use('/api/validation', validationService.router);
app.use('/api/verification', verificationService.router);
app.use('/api/pipeline', pipelineService.router);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
