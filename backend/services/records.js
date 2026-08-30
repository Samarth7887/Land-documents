const express = require('express');
const router = express.Router();
const http = require('http');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { 
  saveFieldCorrections, 
  approveRecord, 
  getRecordHistory, 
  getRecords, 
  getRecordById,
  getVerificationByDocId,
  pool,
  checkDbConnection
} = require('../db/connection');

const MOCK_ACTOR_ID = "rev-clerk-001"; 

// Get all records in the database: GET /api/records
router.get('/', asyncHandler(async (req, res) => {
  const records = await getRecords();
  return res.json({
    success: true,
    records
  });
}));

// Get specific record by ID
router.get('/:id', async (req, res) => {
  const recordId = req.params.id;
  try {
    const record = await getRecordById(recordId);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }
    return res.json({ success: true, record });
  } catch (error) {
    console.error('[Get Record By ID Endpoint Error]:', error.message);
    const code = error.message === "Database unavailable" ? 503 : 500;
    return res.status(code).json({ success: false, error: error.message });
  }
});

// 1. Correct record fields: POST /records/:id/correct
router.post('/:id/correct', async (req, res) => {
  const recordId = req.params.id;
  const corrections = req.body; 

  if (!Array.isArray(corrections)) {
    return res.status(400).json({ success: false, error: "Body must be an array of corrections." });
  }

  try {
    const updatedRecord = await saveFieldCorrections(recordId, corrections, MOCK_ACTOR_ID);
    return res.json({
      success: true,
      message: "Corrections saved successfully and logged to audit trail.",
      record: updatedRecord
    });
  } catch (error) {
    console.error("[Correct Record Endpoint Error]:", error.message);
    const code = error.message === "Database unavailable" ? 503 : 
                 error.message.includes("Access Denied") ? 403 : 500;
    return res.status(code).json({
      success: false,
      error: error.message
    });
  }
});

// 2. Approve record: POST /records/:id/approve
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
    const code = error.message === "Database unavailable" ? 503 : 500;
    return res.status(code).json({
      success: false,
      error: error.message
    });
  }
});

// 3. Get history trail: GET /records/:id/history
router.get('/:id/history', async (req, res) => {
  const recordId = req.params.id;

  try {
    const history = await getRecordHistory(recordId);
    return res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error("[Get History Endpoint Error]:", error.message);
    const code = error.message === "Database unavailable" ? 503 : 500;
    return res.status(code).json({
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
      port: 8014,
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
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

// 4. Verification Landing Page: GET /verify/:document_id
router.get('/verify-id/:document_id', async (req, res) => {
  const docId = req.params.document_id;

  const isOnline = await checkDbConnection();
  if (!isOnline) {
    return res.status(503).json({
      verified: false,
      status: "Database unavailable",
      message: "The database is offline. Cannot check signature validation."
    });
  }

  try {
    const recordRes = await pool.query('SELECT * FROM records WHERE document_id_code = $1', [docId]);
    const record = recordRes.rows[0];

    if (!record) {
      return res.status(404).json({
        verified: false,
        status: "Mismatch - record not found",
        message: "The requested document signature has been invalidated or does not exist."
      });
    }

    // Get approval date from audit logs
    const auditRes = await pool.query(`
      SELECT a.timestamp, u.name as reviewer
      FROM audit_log a
      LEFT JOIN users u ON a.actor_id = u.id
      WHERE a.record_id = $1 AND a.new_state = 'approved'
      ORDER BY a.timestamp DESC LIMIT 1
    `, [record.id]);
    
    const approvalLog = auditRes.rows[0];
    const approvalDate = approvalLog ? new Date(approvalLog.timestamp).toLocaleDateString() : "unknown date";
    const reviewer = approvalLog?.reviewer || "Supervisor";

    // Re-verify signature against current field values using python signer
    let isValid = false;
    if (record.signature) {
      isValid = await verifySignatureWithService(record.extracted_fields, record.signature);
    }

    if (isValid) {
      return res.json({
        verified: true,
        status: "Verified",
        message: `Verified - signed by ${reviewer} on ${approvalDate}, record unaltered`,
        record: {
          id: record.id,
          village: record.village,
          fields: record.extracted_fields
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
  } catch (err) {
    return res.status(500).json({
      verified: false,
      status: "Error",
      message: err.message
    });
  }
});

// 5. Public verification endpoint: GET /records/public-verify/:verificationId
// Returns sanitised public data + live signature re-check.
// NEVER returns the full extracted_fields object to avoid leaking PII at scale.
router.get('/public-verify/:verificationId', async (req, res) => {
  const { verificationId } = req.params;

  let verificationRow;
  try {
    verificationRow = await getVerificationByDocId(verificationId);
  } catch (err) {
    const code = err.message === 'Database unavailable' ? 503 : 500;
    return res.status(code).json({ success: false, error: err.message });
  }

  if (!verificationRow) {
    return res.status(404).json({
      success: false,
      verified: false,
      status: 'NOT_FOUND',
      message: 'No verified record found for this ID.'
    });
  }

  // Re-validate signature with the Python microservice
  let signatureValid = false;
  let signingServiceError = null;
  try {
    signatureValid = await verifySignatureWithService(
      verificationRow.fields,
      verificationRow.signature
    );
  } catch (err) {
    signingServiceError = err.message;
  }

  // If the signing service itself is offline, surface that as an explicit error
  if (signingServiceError) {
    return res.status(503).json({
      success: false,
      verified: false,
      status: 'SERVICE_UNAVAILABLE',
      message: `Signature verification service unavailable: ${signingServiceError}`
    });
  }

  // Build a sanitised record summary (only non-sensitive cadastral fields)
  const fields = verificationRow.fields || {};
  const summary = {};
  const ALLOWED_PUBLIC_FIELDS = [
    'survey_number', 'village', 'taluk', 'district', 'area', 'area_unit', 'land_type'
  ];
  for (const key of ALLOWED_PUBLIC_FIELDS) {
    if (fields[key] !== undefined) {
      const f = fields[key];
      summary[key] = typeof f === 'object' && f !== null && 'value' in f ? f.value : f;
    }
  }

  return res.json({
    success: true,
    verified: signatureValid,
    status: signatureValid ? 'VERIFIED' : 'TAMPERED',
    verificationId: verificationRow.verification_id,
    recordId: verificationRow.record_id,
    verifiedAt: verificationRow.verified_at,
    recordStatus: verificationRow.status,
    qrCode: verificationRow.qr_code,
    summary,
    message: signatureValid
      ? 'Record is authentic. Signature verified against the signed canonical hash.'
      : 'Signature mismatch – the record has been altered since it was signed.'
  });
});

module.exports = { router };
