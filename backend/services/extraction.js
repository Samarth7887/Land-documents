const express = require('express');
const router = express.Router();

// Placeholder for Extraction Service
// Responsible for running OCR and structured key-value extraction on digitized documents.
router.post('/extract', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        documentId: 'doc_12345',
        extractedFields: {
          survey_number: '101/A',
          owner_name: 'Jane Doe',
          area_acres: 2.5
        }
      },
      message: 'Extraction completed successfully (placeholder response)'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router };
