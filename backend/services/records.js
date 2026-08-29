const express = require('express');
const router = express.Router();
const { saveFieldCorrections, approveRecord, getRecordHistory } = require('../db/connection');

// Mock User ID simulating logged-in Clerk / Supervisor for simplicity in the demo
const MOCK_ACTOR_ID = "rev-clerk-001"; 

// 1. Correct record fields: POST /records/:id/correct
router.post('/:id/correct', (req, res) => {
  const recordId = req.params.id;
  const corrections = req.body; // Expects array of corrections: [{ field: 'survey_number', original_value: '...', corrected_value: '...' }]

  if (!Array.isArray(corrections)) {
    return res.status(400).json({ success: false, error: "Body must be an array of corrections." });
  }

  try {
    const updatedRecord = saveFieldCorrections(recordId, corrections, MOCK_ACTOR_ID);
    return res.json({
      success: true,
      message: "Corrections saved successfully and logged to audit trail.",
      record: updatedRecord
    });
  } catch (error) {
    console.error("[Correct Record Endpoint Error]:", error.message);
    return res.status(error.message.includes("Access Denied") ? 403 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// 2. Approve record: POST /records/:id/approve
router.post('/:id/approve', (req, res) => {
  const recordId = req.params.id;
  
  // Supervise approval check override
  // For the demo, let's map the actor to the supervisor
  const supervisorActorId = "rev-super-002"; 

  try {
    const approvedRecord = approveRecord(recordId, supervisorActorId);
    return res.json({
      success: true,
      message: "Record approved successfully and finalized.",
      record: approvedRecord
    });
  } catch (error) {
    console.error("[Approve Record Endpoint Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 3. Get history trail: GET /records/:id/history
router.get('/:id/history', (req, res) => {
  const recordId = req.params.id;

  try {
    const history = getRecordHistory(recordId);
    return res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error("[Get History Endpoint Error]:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = { router };
