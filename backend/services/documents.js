/**
 * documents.js — Express router for the end-to-end document pipeline API.
 *
 * POST  /api/documents                  — Upload a PDF, start a pipeline job
 * GET   /api/jobs/:jobId                — Poll job status + progress
 * GET   /api/jobs/:jobId/results        — Get completed results (202 if still running)
 *
 * Streams the uploaded file directly to the Python pipeline service (port 8003)
 * using multer memoryStorage so no file ever hits disk on the Node side.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const http = require('http');

// ---------------------------------------------------------------------------
// Multer — memory storage, 50 MB limit, PDF/TIFF/ZIP only
// ---------------------------------------------------------------------------
const ALLOWED_MIMETYPES = [
  'application/pdf',
  'image/tiff',
  'application/zip',
  'application/x-zip-compressed',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.tiff', '.tif', '.zip'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: "${ext}". Please upload a PDF, TIFF, or ZIP of scans.`));
    }
  },
});

// ---------------------------------------------------------------------------
// Helper: proxy a buffered multipart file to the Python pipeline service
// ---------------------------------------------------------------------------
function sendFileToPipeline(fileBuffer, filename, mimeType, engine) {
  return new Promise((resolve, reject) => {
    // Build multipart/form-data body manually (avoid external form-data dep)
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
        `Cannot reach the Pipeline Orchestrator on port 8003. ` +
        `Make sure all Python services are running (node run-dev.js). ` +
        `Original error: ${err.message}`
      ));
    });

    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Helper: fetch job status from Python pipeline service
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// POST /api/documents
// Upload a document PDF and start a background pipeline job.
// ---------------------------------------------------------------------------
router.post('/', upload.single('file'), async (req, res) => {
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
    const result = await sendFileToPipeline(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype || 'application/pdf',
      engine
    );

    if (result.statusCode !== 200) {
      return res.status(result.statusCode).json({
        success: false,
        error: result.body?.detail || result.body?.error || 'Pipeline rejected the file.',
        detail: result.body,
      });
    }

    return res.status(202).json({
      success: true,
      job_id: result.body.job_id,
      message: result.body.message || 'Pipeline processing started.',
      poll_url: `/api/jobs/${result.body.job_id}`,
      results_url: `/api/jobs/${result.body.job_id}/results`,
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
// GET /api/jobs/:jobId
// Poll the live status and progress of a pipeline job.
// ---------------------------------------------------------------------------
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { statusCode, body } = await fetchJobStatus(req.params.jobId);

    // Map pipeline status to HTTP status
    const httpCode = body.status === 'failed' ? 200   // return 200 with failed body so frontend reads it
                   : statusCode;

    return res.status(httpCode).json({
      job_id: req.params.jobId,
      status: body.status,
      progress: body.progress,
      message: body.message,
      has_results: body.status === 'completed' && body.results !== null,
    });

  } catch (err) {
    if (err.notFound) {
      return res.status(404).json({ success: false, error: `Job "${req.params.jobId}" not found.` });
    }
    console.error('[GET /api/jobs/:id Error]:', err.message);
    return res.status(502).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/jobs/:jobId/results
// Returns the completed results. 202 if still processing.
// ---------------------------------------------------------------------------
router.get('/jobs/:jobId/results', async (req, res) => {
  try {
    const { body } = await fetchJobStatus(req.params.jobId);

    if (body.status === 'pending' || body.status === 'processing') {
      return res.status(202).json({
        job_id: req.params.jobId,
        status: body.status,
        progress: body.progress,
        message: 'Job is still processing. Poll /api/jobs/:jobId for updates.',
      });
    }

    if (body.status === 'failed') {
      return res.status(200).json({
        job_id: req.params.jobId,
        status: 'failed',
        error: body.message,
        results: null,
      });
    }

    // Completed
    return res.status(200).json({
      job_id: req.params.jobId,
      status: 'completed',
      results: body.results,
    });

  } catch (err) {
    if (err.notFound) {
      return res.status(404).json({ success: false, error: `Job "${req.params.jobId}" not found.` });
    }
    console.error('[GET /api/jobs/:id/results Error]:', err.message);
    return res.status(502).json({ success: false, error: err.message });
  }
});

module.exports = { router };
