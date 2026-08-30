/**
 * documents.js — Express router for the end-to-end document pipeline API with PostgreSQL persistence.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const http = require('http');
const { pool, checkDbConnection } = require('../db/connection');

// ---------------------------------------------------------------------------
// Multer — memory storage, 50 MB limit, PDF/TIFF/ZIP only
// ---------------------------------------------------------------------------
const ALLOWED_EXTENSIONS = ['.pdf', '.tiff', '.tif', '.zip', '.jpg', '.jpeg', '.png'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: "${ext}". Please upload a PDF, TIFF, ZIP or image.`));
    }
  },
});

// Helper: proxy a buffered multipart file to the Python pipeline service
function sendFileToPipeline(fileBuffer, filename, mimeType, engine) {
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${Date.now().toString(16)}`;
    const CRLF = '\r\n';

    const header =
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
      `Content-Type: ${mimeType}${CRLF}` +
      `${CRLF}`;
    const footer = `${CRLF}--${boundary}--${CRLF}`;

    const headerBuf = Buffer.from(header, 'utf8');
    const footerBuf = Buffer.from(footer, 'utf8');
    const body = Buffer.concat([headerBuf, fileBuffer, footerBuf]);

    const options = {
      hostname: '127.0.0.1',
      port: 8013,
      path: `/process?engine=${encodeURIComponent(engine)}`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
        } catch {
          reject(new Error(`Malformed response from pipeline: ${raw.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(
        `Cannot reach the Pipeline Orchestrator on port 8013. ` +
        `Make sure all Python services are running (node run-dev.js). ` +
        `Original error: ${err.message}`
      ));
    });

    req.write(body);
    req.end();
  });
}

// Helper: fetch job status from Python pipeline service
function fetchJobStatus(jobId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 8013,
      path: `/status/${encodeURIComponent(jobId)}`,
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode === 404) {
          return reject({ notFound: true });
        }
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
        } catch {
          reject(new Error(`Malformed status response: ${raw.slice(0, 200)}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(
        `Cannot reach Pipeline Orchestrator on port 8013: ${err.message}`
      ));
    });

    req.end();
  });
}

// Helper to save job results into PostgreSQL records table
async function saveJobResultsToDb(jobId, results) {
  if (!results || !Array.isArray(results.records)) return;

  // Retrieve document_id for this jobId
  let docId = null;
  try {
    const jobRes = await pool.query('SELECT document_id FROM processing_jobs WHERE id = $1', [jobId]);
    docId = jobRes.rows[0]?.document_id || null;
  } catch (err) {
    console.error(`Error querying document_id for job ${jobId}:`, err.message);
  }

  for (const r of results.records) {
    const recordId = `${jobId}_p${r.page_number}`;
    const extractedFields = r.record;
    
    // Determine district from fields or fallback
    const district = extractedFields.district?.value || extractedFields.village?.value || 'Green Valley';
    
    try {
      await pool.query(`
        INSERT INTO records (id, status, district, extracted_fields, document_uuid)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO NOTHING
      `, [recordId, 'extracted', district, JSON.stringify(extractedFields), docId]);
      
      // Seed audit log
      await pool.query(`
        INSERT INTO audit_log (record_id, actor_id, previous_state, new_state)
        VALUES ($1, 'system-ai', NULL, 'extracted')
        ON CONFLICT DO NOTHING
      `, [recordId]);
    } catch (err) {
      console.error(`Failed to auto-insert pipeline record ${recordId} into PostgreSQL:`, err.message);
    }
  }

  // Update document status to preprocessed (which signifies ready for review)
  if (docId) {
    try {
      await pool.query(`UPDATE documents SET status = 'preprocessed', updated_at = NOW() WHERE id = $1`, [docId]);
    } catch (err) {
      console.error(`Failed to update document status for ${docId}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// GET /api/documents
// List all documents in the database with join statistics.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const dbOnline = await checkDbConnection();
  if (!dbOnline) {
    return res.status(503).json({ success: false, error: "Database unavailable" });
  }

  try {
    const resDocs = await pool.query(`
      SELECT 
        d.id, 
        d.filename, 
        d.created_at, 
        d.status as doc_status,
        j.id as job_id,
        j.status as job_status,
        j.progress,
        j.message as job_message,
        (SELECT COUNT(*) FROM records r WHERE r.document_uuid = d.id) as record_count,
        (SELECT COUNT(*) FROM records r WHERE r.document_uuid = d.id AND r.status = 'approved') as approved_count,
        (SELECT COUNT(*) FROM records r WHERE r.document_uuid = d.id AND r.status = 'corrected') as corrected_count
      FROM documents d
      LEFT JOIN processing_jobs j ON j.document_id = d.id
      ORDER BY d.created_at DESC
    `);
    return res.json({
      success: true,
      documents: resDocs.rows
    });
  } catch (err) {
    console.error('[GET /api/documents Error]:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/documents
// Upload a document PDF/Image and start a background pipeline job.
// ---------------------------------------------------------------------------
router.post('/', upload.single('file'), async (req, res) => {
  const dbOnline = await checkDbConnection();
  if (!dbOnline) {
    return res.status(503).json({ success: false, error: "Database unavailable" });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file received. Send a multipart/form-data request with field name "file".',
    });
  }

  const engine = (req.query.engine || req.body?.engine || 'gemini').toLowerCase();
  if (!['gemini', 'paddleocr'].includes(engine)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid engine. Must be "gemini" or "paddleocr".',
    });
  }

  try {
    // 1. Insert file into documents table
    const docRes = await pool.query(
      `INSERT INTO documents (filename, status) VALUES ($1, 'pending') RETURNING id`,
      [req.file.originalname]
    );
    const docId = docRes.rows[0].id;

    // 2. Dispatch to orchestrator
    const result = await sendFileToPipeline(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype || 'application/pdf',
      engine
    );

    if (result.statusCode !== 200) {
      await pool.query(`UPDATE documents SET status = 'failed' WHERE id = $1`, [docId]);
      return res.status(result.statusCode).json({
        success: false,
        error: result.body?.detail || result.body?.error || 'Pipeline rejected the file.',
        detail: result.body,
      });
    }

    const jobId = result.body.job_id;

    // 3. Register job in processing_jobs table with document_id link
    await pool.query(`
      INSERT INTO processing_jobs (id, status, progress, message, document_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [jobId, 'pending', 0, 'Pipeline started', docId]);

    await pool.query(`UPDATE documents SET status = 'processing' WHERE id = $1`, [docId]);

    return res.status(202).json({
      success: true,
      job_id: jobId,
      message: result.body.message || 'Pipeline processing started.',
      poll_url: `/api/documents/jobs/${jobId}`,
      results_url: `/api/documents/jobs/${jobId}/results`,
    });

  } catch (err) {
    console.error('[POST /api/documents Error]:', err.message);
    return res.status(502).json({
      success: false,
      error: err.message,
    });
  }
});

// Multer error handler (file size / type violations)
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/documents/jobs/:jobId
// Poll the live status and progress of a pipeline job.
// ---------------------------------------------------------------------------
router.get('/jobs/:jobId', async (req, res) => {
  const dbOnline = await checkDbConnection();
  if (!dbOnline) {
    return res.status(503).json({ success: false, error: "Database unavailable" });
  }

  const jobId = req.params.jobId;

  try {
    let statusCode, body;
    try {
      const liveRes = await fetchJobStatus(jobId);
      statusCode = liveRes.statusCode;
      body = liveRes.body;
      
      // Update PostgreSQL cache
      await pool.query(`
        UPDATE processing_jobs
        SET status = $1, progress = $2, message = $3, results = $4, updated_at = NOW()
        WHERE id = $5
      `, [
        body.status, 
        body.progress || 0, 
        body.message || '', 
        body.status === 'completed' ? JSON.stringify(body.results) : null,
        jobId
      ]);

      if (body.status === 'completed' && body.results) {
        await saveJobResultsToDb(jobId, body.results);
      }
    } catch (fetchErr) {
      console.warn(`[Pipeline Poll Warning] Falling back to PostgreSQL for job ${jobId}: ${fetchErr.message}`);
      
      // Query PostgreSQL cache
      const jobRes = await pool.query('SELECT * FROM processing_jobs WHERE id = $1', [jobId]);
      const cachedJob = jobRes.rows[0];
      
      if (!cachedJob) {
        return res.status(404).json({ success: false, error: `Job "${jobId}" not found.` });
      }

      body = {
        status: cachedJob.status,
        progress: cachedJob.progress,
        message: cachedJob.message,
        results: cachedJob.results
      };
    }

    return res.status(200).json({
      job_id: jobId,
      status: body.status,
      progress: body.progress,
      message: body.message,
      has_results: body.status === 'completed',
    });

  } catch (err) {
    console.error('[GET /api/documents/jobs/:id Error]:', err.message);
    return res.status(502).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/documents/jobs/:jobId/results
// Returns the completed results. 202 if still processing.
// ---------------------------------------------------------------------------
router.get('/jobs/:jobId/results', async (req, res) => {
  const dbOnline = await checkDbConnection();
  if (!dbOnline) {
    return res.status(503).json({ success: false, error: "Database unavailable" });
  }

  const jobId = req.params.jobId;

  try {
    // Authoritative check from PostgreSQL
    const jobRes = await pool.query('SELECT * FROM processing_jobs WHERE id = $1', [jobId]);
    const job = jobRes.rows[0];

    if (!job) {
      return res.status(404).json({ success: false, error: `Job "${jobId}" not found.` });
    }

    if (job.status === 'pending' || job.status === 'processing') {
      return res.status(202).json({
        job_id: jobId,
        status: job.status,
        progress: job.progress,
        message: 'Job is still processing. Poll /api/documents/jobs/:jobId for updates.',
      });
    }

    if (job.status === 'failed') {
      return res.status(200).json({
        job_id: jobId,
        status: 'failed',
        error: job.message,
        results: null,
      });
    }

    return res.status(200).json({
      job_id: jobId,
      status: 'completed',
      results: job.results,
    });

  } catch (err) {
    console.error('[GET /api/documents/jobs/:id/results Error]:', err.message);
    return res.status(502).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/documents/:id
// Get full details, history, and status elements of a document.
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res) => {
  const docId = req.params.id;
  const dbOnline = await checkDbConnection();
  if (!dbOnline) {
    return res.status(503).json({ success: false, error: "Database unavailable" });
  }

  try {
    // 1. Doc info
    const docRes = await pool.query('SELECT * FROM documents WHERE id = $1', [docId]);
    const document = docRes.rows[0];
    if (!document) {
      return res.status(404).json({ success: false, error: "Document not found" });
    }

    // 2. Processing Jobs info
    const jobsRes = await pool.query('SELECT id, status, progress, message, created_at, updated_at FROM processing_jobs WHERE document_id = $1 ORDER BY created_at DESC', [docId]);
    const jobs = jobsRes.rows;

    // 3. Extracted records
    const recordsRes = await pool.query('SELECT id, status, district, extracted_fields, signature, public_key, qr_code, document_id_code FROM records WHERE document_uuid = $1 ORDER BY created_at DESC', [docId]);
    const records = recordsRes.rows;

    // 4. Corrections (Review History)
    const correctionsRes = await pool.query(`
      SELECT c.id, c.record_id, c.reviewer_id, u.name as reviewer_name, c.field_name, c.original_value, c.corrected_value, c.timestamp
      FROM corrections c
      LEFT JOIN users u ON c.reviewer_id = u.id
      WHERE c.record_id IN (SELECT id FROM records WHERE document_uuid = $1)
      ORDER BY c.timestamp ASC
    `, [docId]);
    const corrections = correctionsRes.rows;

    // 5. Approvals History
    const approvalsRes = await pool.query(`
      SELECT a.id, a.record_id, a.supervisor_id, u.name as supervisor_name, a.signature, a.approved_at
      FROM approvals a
      LEFT JOIN users u ON a.supervisor_id = u.id
      WHERE a.record_id IN (SELECT id FROM records WHERE document_uuid = $1)
      ORDER BY a.approved_at ASC
    `, [docId]);
    const approvals = approvalsRes.rows;

    // 6. Audit logs (state transitions)
    const auditRes = await pool.query(`
      SELECT l.id, l.record_id, l.actor_id, u.name as actor_name, l.previous_state, l.new_state, l.timestamp
      FROM audit_log l
      LEFT JOIN users u ON l.actor_id = u.id
      WHERE l.record_id IN (SELECT id FROM records WHERE document_uuid = $1)
      ORDER BY l.timestamp ASC
    `, [docId]);
    const auditLogs = auditRes.rows;

    return res.json({
      success: true,
      document,
      jobs,
      records,
      corrections,
      approvals,
      auditLogs
    });

  } catch (err) {
    console.error(`[GET /api/documents/${docId} Error]:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = { router };
