const express = require('express');
const router = express.Router();
const http = require('http');
const { saveFieldCorrections, approveRecord, getRecordHistory, db } = require('../db/connection');

const MOCK_ACTOR_ID = "rev-clerk-001"; 

// 1. Correct record fields: POST /records/:id/correct
router.post('/:id/correct', (req, res) => {
  const recordId = req.params.id;
  const corrections = req.body; 

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

// 2. Approve record: POST /records/:id/approve (ASYNC version)
router.post('/:id/approve', async (req, res) => {
  const recordId = req.params.id;
  const supervisorActorId = "rev-super-002"; 

  try {
    const approvedRecord = await approveRecord(recordId, supervisorActorId);
    return res.json({
      success: true,
      message: "Record approved successfully and finalized with digital signature.",
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

// Helper function to call the Python verify service
function verifySignatureWithService(fields, signature) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ fields, signature });
    const options = {
      hostname: '127.0.0.1',
      port: 8004,
      path: '/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(!!parsed.verified);
        } catch (e) {
          resolve(false);
        }
      });
    });

    req.on('error', () => {
      resolve(false); // Fallback
    });

    req.write(payload);
    req.end();
  });
}

// 4. Verification Landing Page: GET /verify/:document_id
// (Returns verification status and visual indicators as HTML or JSON. We will return a beautiful JSON status metadata payload, which is ideal for the frontend UI check).
router.get('/verify-id/:document_id', async (req, res) => {
  const docId = req.params.document_id;
  const record = db.records.find(r => r.document_id === docId);

  if (!record) {
    return res.status(404).json({
      verified: false,
      status: "Mismatch - record not found",
      message: "The requested document signature has been invalidated or does not exist."
    });
  }

  // Get approval date from audit logs
  const approvalLog = db.audit_log.find(l => l.record_id === record.id && l.new_state === "approved");
  const approvalDate = approvalLog ? new Date(approvalLog.timestamp).toLocaleDateString() : "unknown date";
  const reviewer = db.users.find(u => u.id === approvalLog?.actor_id)?.name || "Supervisor";

  // Re-verify signature against current field values using python signer
  let isValid = false;
  if (record.signature) {
    isValid = await verifySignatureWithService(record.fields, record.signature);
  }

  if (isValid) {
    return res.json({
      verified: true,
      status: "Verified",
      message: `Verified - signed by ${reviewer} on ${approvalDate}, record unaltered`,
      record: {
        id: record.id,
        village: record.village,
        fields: record.fields
      }
    });
  } else {
    return res.json({
      verified: false,
      status: "Mismatch",
      message: "Mismatch - record has changed since signing",
      record: {
        id: record.id,
        village: record.village
      }
    });
  }
});

module.exports = { router };
