// Mock PostgreSQL/Supabase database memory manager
// Simulates the schema tables, RLS policies, and audit triggers for local dev/demo safety.

const http = require('http');

const db = {
  users: [
    { id: "rev-clerk-001", name: "Clerk Ram", role: "clerk", district: "Green Valley" },
    { id: "rev-super-002", name: "Supervisor Sita", role: "supervisor", district: "All" },
    { id: "rev-admin-003", name: "Admin Laxman", role: "admin", district: "All" }
  ],
  records: [
    {
      id: "rec_9011",
      village: "Green Valley",
      district: "Green Valley",
      overallStatus: "needs_review",
      fields: {
        owner_name: { value: "Johnathan Smith", confidence: 0.95, original_value: "Johnathan Smith" },
        survey_number: { value: "404-B / Part 2", confidence: 0.52, original_value: "404-B / Part 2", issue: "Duplicate survey number detected in Green Valley" },
        khasra_or_khata_number: { value: "KH-88902", confidence: 0.85, original_value: "KH-88902" },
        area: { value: 55.75, confidence: 0.95, original_value: "55.75", issue: "Plausible maximum size exceeded. Area 55.75 exceeds limit of 50.0" },
        area_unit: { value: "Acres", confidence: 0.98, original_value: "Acres" },
        village: { value: "Green Valley", confidence: 0.90, original_value: "Green Valley" },
        taluk: { value: "East Taluk", confidence: 0.85, original_value: "East Taluk" },
        district: { value: "River District", confidence: 0.95, original_value: "River District" },
        land_classification: { value: "Agricultural (Wet Land)", confidence: 0.92, original_value: "Agricultural (Wet Land)" },
        khata_type: { value: "A", confidence: 0.88, original_value: "A" },
        tenancy_status: { value: "Owner-cultivated", confidence: 0.90, original_value: "Owner-cultivated" },
        liabilities: { value: ["Bank Mortgage of 500,000 INR"], confidence: 0.80, original_value: ["Bank Mortgage of 500,000 INR"] },
        tax_status: { value: "Paid", confidence: 0.95, original_value: "Paid" }
      },
      signature: null,
      public_key: null,
      qr_code: null,
      document_id: null
    }
  ],
  corrections: [],
  audit_log: [
    {
      id: "log-init-001",
      record_id: "rec_9011",
      actor_id: "system-ai",
      previous_state: null,
      new_state: "extracted",
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    }
  ]
};

// Simulated Row Level Security validator
function validateRLS(actorId, recordDistrict, action = "select") {
  const user = db.users.find(u => u.id === actorId);
  if (!user) {
    throw new Error(`Unauthorized: User ID ${actorId} not found.`);
  }

  // Admins & Supervisors can do anything
  if (user.role === "admin" || user.role === "supervisor") {
    return true;
  }

  // Clerks can only interact with records matching their assigned district
  if (user.role === "clerk") {
    if (user.district.toLowerCase() === recordDistrict.toLowerCase()) {
      return true;
    } else {
      throw new Error(`Access Denied: Clerk ${user.name} is restricted to district '${user.district}'. Cannot access '${recordDistrict}' records.`);
    }
  }

  throw new Error("Unauthorized role.");
}

// Fetch signature from Python service helper
function fetchSignatureFromService(fields, verifyUrl) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ fields, verify_url: verifyUrl });
    const options = {
      hostname: '127.0.0.1',
      port: 8004,
      path: '/sign',
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
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      resolve(null); // Fallback to mock locally
    });

    req.write(payload);
    req.end();
  });
}

// Save corrections helper simulating DB transaction
function saveFieldCorrections(recordId, correctionsList, actorId) {
  const record = db.records.find(r => r.id === recordId);
  if (!record) {
    throw new Error(`Record ${recordId} not found.`);
  }

  // Verify RLS policy
  validateRLS(actorId, record.district, "update");

  const timestamp = new Date().toISOString();
  let wasApproved = record.overallStatus === "approved";

  // Log to corrections table
  correctionsList.forEach(c => {
    // DB Constraint simulation
    if (!c.field || c.original_value === undefined || c.corrected_value === undefined) {
      throw new Error("Bad Request: Missing correction field values.");
    }

    db.corrections.push({
      id: `corr-${Math.random().toString(36).substring(2, 8)}`,
      record_id: recordId,
      reviewer_id: actorId,
      field_name: c.field,
      original_value: String(c.original_value),
      corrected_value: String(c.corrected_value),
      timestamp
    });

    // Update field value on record
    if (record.fields[c.field]) {
      record.fields[c.field].value = c.corrected_value;
      record.fields[c.field].confidence = 0.99; // Manually corrected = high confidence
      if (record.fields[c.field].issue) {
        delete record.fields[c.field].issue;
      }
    }
  });

  // Log state change to audit_log
  const previousState = record.overallStatus;
  record.overallStatus = "corrected";
  record.updated_at = timestamp;

  // RULE 5: Invalidate old signature and QR code if edited after approval
  if (wasApproved) {
    record.signature = null;
    record.public_key = null;
    record.qr_code = null;
    record.document_id = null;

    db.audit_log.push({
      id: `log-inv-${Math.random().toString(36).substring(2, 8)}`,
      record_id: recordId,
      actor_id: actorId,
      previous_state: "approved",
      new_state: "invalidated",
      timestamp
    });
  }

  db.audit_log.push({
    id: `log-${Math.random().toString(36).substring(2, 8)}`,
    record_id: recordId,
    actor_id: actorId,
    previous_state: previousState,
    new_state: "corrected",
    timestamp
  });

  return record;
}

// Approve record helper simulating DB transaction
async function approveRecord(recordId, actorId) {
  const record = db.records.find(r => r.id === recordId);
  if (!record) {
    throw new Error(`Record ${recordId} not found.`);
  }

  // Verify RLS policy
  validateRLS(actorId, record.district, "update");

  const timestamp = new Date().toISOString();
  const previousState = record.overallStatus;

  // Generate unique document id
  const docId = `doc_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const verifyUrl = `http://localhost:5000/verify/${docId}`;

  // Call the python verification-mark microservice to sign
  const signResult = await fetchSignatureFromService(record.fields, verifyUrl);

  if (signResult && signResult.success) {
    record.signature = signResult.signature;
    record.public_key = signResult.public_key;
    record.qr_code = signResult.qr_code;
    record.document_id = docId;
  } else {
    // Local fallback for robust demo environments if signing microservice is not online
    record.signature = "MOCK_RSA_PSS_SHA256_SIGNATURE_HEX_BASE64_VALUE";
    record.public_key = "MOCK_RSA_PUBLIC_KEY_PEM";
    record.qr_code = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; // dummy pixel
    record.document_id = docId;
  }

  record.overallStatus = "approved";
  record.updated_at = timestamp;

  // Log state change to audit_log (Append-only)
  db.audit_log.push({
    id: `log-${Math.random().toString(36).substring(2, 8)}`,
    record_id: recordId,
    actor_id: actorId,
    previous_state: previousState,
    new_state: "approved",
    timestamp
  });

  return record;
}

// Retrieve audit logs + corrections combined trail
function getRecordHistory(recordId) {
  const logs = db.audit_log.filter(l => l.record_id === recordId);
  const corrs = db.corrections.filter(c => c.record_id === recordId);
  
  // Return unified trails chronological sorted
  return {
    state_transitions: logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
    field_corrections: corrs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  };
}

module.exports = {
  db,
  saveFieldCorrections,
  approveRecord,
  getRecordHistory,
  validateRLS
};
