const { Pool } = require('pg');
const http = require('http');

const poolConfig = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'land_records',
  connectionTimeoutMillis: 3000 // 3 seconds timeout
};

const pool = new Pool(poolConfig);

// Diagnostic connection test function
async function checkDbConnection() {
  let client;
  try {
    client = await pool.connect();
    return true;
  } catch (err) {
    console.error("Database connection failure:", err.message);
    return false;
  } finally {
    if (client) client.release();
  }
}

// Simulated Row Level Security validator
async function validateRLS(client, actorId, recordDistrict) {
  const userRes = await client.query('SELECT * FROM users WHERE id = $1', [actorId]);
  const user = userRes.rows[0];
  
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

// Fetch signature from Python signing microservice.
// IMPORTANT: This function REJECTS (throws) if the service is unreachable or
// returns an error.  The approval flow must never store a fake/mock signature.
function fetchSignatureFromService(fields, verifyUrl) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ fields, verify_url: verifyUrl });
    const options = {
      hostname: '127.0.0.1',
      port: 8014,
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
          const parsed = JSON.parse(data);
          if (!parsed.success || !parsed.signature) {
            return reject(new Error('Signing service returned an error or empty signature.'));
          }
          resolve(parsed);
        } catch (e) {
          reject(new Error('Signing service returned non-JSON response.'));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Signing service unavailable: ${err.message}`));
    });

    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error('Signing service timed out after 8 s.'));
    });

    req.write(payload);
    req.end();
  });
}

// Get all records in the database
async function getRecords() {
  const isOnline = await checkDbConnection();
  if (!isOnline) throw new Error("Database unavailable");
  
  const res = await pool.query(`
    SELECT id, status as "overallStatus", district, extracted_fields as fields, 
           signature, public_key, qr_code, document_id_code as document_id 
    FROM records
    ORDER BY created_at DESC
  `);
  return res.rows;
}

// Get specific record by ID
async function getRecordById(recordId) {
  const isOnline = await checkDbConnection();
  if (!isOnline) throw new Error("Database unavailable");

  const res = await pool.query(`
    SELECT id, status as "overallStatus", district, extracted_fields as fields, 
           signature, public_key, qr_code, document_id_code as document_id 
    FROM records
    WHERE id = $1
  `, [recordId]);
  return res.rows[0];
}

// Save corrections helper using DB transaction
async function saveFieldCorrections(recordId, correctionsList, actorId) {
  const isOnline = await checkDbConnection();
  if (!isOnline) throw new Error("Database unavailable");

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch active record
    const recordRes = await client.query('SELECT * FROM records WHERE id = $1', [recordId]);
    const record = recordRes.rows[0];
    if (!record) {
      throw new Error(`Record ${recordId} not found.`);
    }

    // Verify RLS policy
    await validateRLS(client, actorId, record.district);

    const previousState = record.status;
    const wasApproved = previousState === "approved";
    const fields = record.extracted_fields;

    // Log to corrections table
    for (const c of correctionsList) {
      if (!c.field || c.original_value === undefined || c.corrected_value === undefined) {
        throw new Error("Bad Request: Missing correction field values.");
      }

      await client.query(`
        INSERT INTO corrections (record_id, reviewer_id, field_name, original_value, corrected_value)
        VALUES ($1, $2, $3, $4, $5)
      `, [recordId, actorId, c.field, String(c.original_value), String(c.corrected_value)]);

      // Update field values in local JSON object
      if (fields[c.field]) {
        fields[c.field].value = c.corrected_value;
        fields[c.field].confidence = 0.99; // high confidence for manual edits
        if (fields[c.field].issue) {
          delete fields[c.field].issue;
        }
      }
    }

    // Update records status to corrected and invalidate signature if previously approved
    let signature = record.signature;
    let public_key = record.public_key;
    let qr_code = record.qr_code;
    let document_id_code = record.document_id_code;

    if (wasApproved) {
      signature = null;
      public_key = null;
      qr_code = null;
      document_id_code = null;

      // Log invalidation audit
      await client.query(`
        INSERT INTO audit_log (record_id, actor_id, previous_state, new_state)
        VALUES ($1, $2, 'approved', 'invalidated')
      `, [recordId, actorId]);
    }

    // Update record row in PostgreSQL
    await client.query(`
      UPDATE records 
      SET status = 'corrected', extracted_fields = $1, signature = $2, 
          public_key = $3, qr_code = $4, document_id_code = $5, updated_at = NOW()
      WHERE id = $6
    `, [JSON.stringify(fields), signature, public_key, qr_code, document_id_code, recordId]);

    // Log corrected audit trail
    await client.query(`
      INSERT INTO audit_log (record_id, actor_id, previous_state, new_state)
      VALUES ($1, $2, $3, 'corrected')
    `, [recordId, actorId, previousState]);

    await client.query('COMMIT');

    // Retrieve and return updated record
    return await getRecordById(recordId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Approve record helper using DB transaction.
// SECURITY: If the signing microservice is unavailable the entire transaction
// is rolled back and an error is returned.  Fake signatures are never stored.
async function approveRecord(recordId, actorId) {
  const isOnline = await checkDbConnection();
  if (!isOnline) throw new Error("Database unavailable");

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch active record
    const recordRes = await client.query('SELECT * FROM records WHERE id = $1', [recordId]);
    const record = recordRes.rows[0];
    if (!record) {
      throw new Error(`Record ${recordId} not found.`);
    }

    // Verify RLS policy
    await validateRLS(client, actorId, record.district);

    const previousState = record.status;

    // Generate a stable public document ID using crypto UUID
    const { randomUUID } = require('crypto');
    const verificationUUID = randomUUID();
    const docId = verificationUUID; // public-facing verification ID
    const verifyUrl = `${process.env.PUBLIC_BASE_URL || 'http://localhost:5176'}/public-verify/${docId}`;

    // Call signing service – throws if unavailable or returns bad data
    let signResult;
    try {
      signResult = await fetchSignatureFromService(record.extracted_fields, verifyUrl);
    } catch (signingErr) {
      throw new Error(`Signing service error: ${signingErr.message}. Approval aborted – no fake signature will be stored.`);
    }

    const { signature, public_key, qr_code } = signResult;

    // Update records row status to approved and store real signature blocks
    await client.query(`
      UPDATE records 
      SET status = 'approved', signature = $1, public_key = $2, 
          qr_code = $3, document_id_code = $4, updated_at = NOW()
      WHERE id = $5
    `, [signature, public_key, qr_code, docId, recordId]);

    // Insert dedicated verifications row for the public verification page
    await client.query(`
      INSERT INTO verifications (record_id, verification_id, signature, public_key, qr_code)
      VALUES ($1, $2::uuid, $3, $4, $5)
      ON CONFLICT (record_id) DO UPDATE
        SET verification_id = EXCLUDED.verification_id,
            signature       = EXCLUDED.signature,
            public_key      = EXCLUDED.public_key,
            qr_code         = EXCLUDED.qr_code,
            verified_at     = NOW()
    `, [recordId, verificationUUID, signature, public_key, qr_code]);

    // Insert into approvals
    await client.query(`
      INSERT INTO approvals (record_id, supervisor_id, signature)
      VALUES ($1, $2, $3)
    `, [recordId, actorId, signature]);

    // Log approved state transition
    await client.query(`
      INSERT INTO audit_log (record_id, actor_id, previous_state, new_state)
      VALUES ($1, $2, $3, 'approved')
    `, [recordId, actorId, previousState]);

    await client.query('COMMIT');

    return await getRecordById(recordId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Look up a verification by its public UUID for the public verification page
async function getVerificationByDocId(verificationId) {
  const isOnline = await checkDbConnection();
  if (!isOnline) throw new Error("Database unavailable");

  const res = await pool.query(`
    SELECT
      v.verification_id,
      v.signature,
      v.public_key,
      v.qr_code,
      v.verified_at,
      r.id          AS record_id,
      r.status,
      r.district,
      r.extracted_fields AS fields
    FROM verifications v
    JOIN records r ON r.id = v.record_id
    WHERE v.verification_id = $1::uuid
  `, [verificationId]);
  return res.rows[0] || null;
}

// Retrieve audit logs + corrections combined trail
async function getRecordHistory(recordId) {
  const isOnline = await checkDbConnection();
  if (!isOnline) throw new Error("Database unavailable");

  const auditRes = await pool.query(`
    SELECT id, record_id, actor_id, previous_state, new_state, timestamp
    FROM audit_log 
    WHERE record_id = $1 
    ORDER BY timestamp ASC
  `, [recordId]);

  const corrRes = await pool.query(`
    SELECT id, record_id, reviewer_id, field_name, original_value, corrected_value, timestamp
    FROM corrections 
    WHERE record_id = $1 
    ORDER BY timestamp ASC
  `, [recordId]);

  return {
    state_transitions: auditRes.rows,
    field_corrections: corrRes.rows
  };
}

module.exports = {
  pool,
  checkDbConnection,
  getRecords,
  getRecordById,
  saveFieldCorrections,
  approveRecord,
  getRecordHistory,
  getVerificationByDocId,
  validateRLS
};
