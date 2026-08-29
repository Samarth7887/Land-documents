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
const recordsService = require('./services/records');
const verificationMarkService = require('./services/verification-mark');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Land Records Backend is active' });
});

// Setup mount points/routes for service modules if needed
app.use('/api/preprocessing', preprocessingService.router);
app.use('/api/extraction', extractionService.router);
app.use('/api/validation', validationService.router);
app.use('/api/verification', verificationService.router);
app.use('/api/records', recordsService.router);
app.use('/api/verification-mark', verificationMarkService.router);

// Public verification landing page: GET /verify/:document_id
app.get('/verify/:document_id', async (req, res) => {
  const docId = req.params.document_id;
  const { db } = require('./db/connection');
  const record = db.records.find(r => r.document_id === docId);

  // Styling helper function
  const renderPage = (title, message, isVerified, details = '') => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Terravision Registry - Verify Digital Mark</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center p-6 font-sans">
      <div class="max-w-md w-full bg-slate-950 border ${isVerified ? 'border-emerald-500/30' : 'border-rose-500/30'} rounded-2xl p-6 shadow-2xl space-y-6">
        
        <div class="flex flex-col items-center text-center space-y-4">
          <div class="w-16 h-16 rounded-full flex items-center justify-center ${isVerified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
            ${isVerified 
              ? '<svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>'
              : '<svg class="w-10 h-10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>'
            }
          </div>
          <div>
            <h2 class="text-xl font-bold tracking-tight">${title}</h2>
            <p class="text-xs text-slate-400 mt-1">Registry Document ID: ${docId}</p>
          </div>
        </div>

        <div class="p-4 rounded-xl text-sm leading-relaxed text-center ${isVerified ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'}">
          ${message}
        </div>

        ${details}

        <div class="border-t border-slate-900 pt-4 text-center">
          <p class="text-[10px] text-slate-500 font-mono">TERRAVISION DIGITAL REGISTRY SYSTEM &copy; 2026</p>
        </div>
      </div>
    </body>
    </html>
  `;

  if (!record) {
    return res.status(404).send(renderPage(
      "Mismatch - Record Missing",
      "The requested document signature has been invalidated or does not exist.",
      false
    ));
  }

  // Re-verify signature against current field values using python signer
  let isValid = false;
  
  // Call the python verification-mark microservice to verify
  const http = require('http');
  const checkSignature = () => new Promise((resolve) => {
    if (!record.signature) return resolve(false);
    const payload = JSON.stringify({ fields: record.fields, signature: record.signature });
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
          resolve(!!JSON.parse(data).verified);
        } catch (e) { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.write(payload);
    req.end();
  });

  isValid = await checkSignature();

  if (isValid) {
    const approvalLog = db.audit_log.find(l => l.record_id === record.id && l.new_state === "approved");
    const approvalDate = approvalLog ? new Date(approvalLog.timestamp).toLocaleString() : "unknown date";
    const reviewer = db.users.find(u => u.id === approvalLog?.actor_id)?.name || "Supervisor Sita";

    const fieldsDetails = `
      <div class="space-y-3 border-t border-slate-900 pt-4 text-xs font-mono">
        <div class="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">Registry Snapshot:</div>
        <div class="grid grid-cols-2 gap-y-1.5 gap-x-4 bg-slate-900 p-3.5 rounded-xl border border-slate-850">
          <div><span class="text-slate-500 font-sans">Owner:</span> <span class="text-slate-200 font-bold">${record.fields.owner_name.value}</span></div>
          <div><span class="text-slate-500 font-sans">Survey:</span> <span class="text-slate-200 font-bold">${record.fields.survey_number.value}</span></div>
          <div><span class="text-slate-500 font-sans">Area:</span> <span class="text-slate-200 font-bold">${record.fields.area.value} ${record.fields.area_unit.value}</span></div>
          <div><span class="text-slate-500 font-sans">Village:</span> <span class="text-slate-200 font-bold">${record.fields.village.value}</span></div>
        </div>
      </div>
    `;

    return res.send(renderPage(
      "Document Verified",
      `Verified - signed by ${reviewer} on ${approvalDate}, record unaltered`,
      true,
      fieldsDetails
    ));
  } else {
    return res.send(renderPage(
      "Signature Mismatch",
      "Mismatch - record has changed since signing",
      false
    ));
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
