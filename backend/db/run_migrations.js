const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runMigrations() {
  const poolConfig = {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT) || 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'land_records',
  };

  console.log('--- Connecting to PostgreSQL database for migration run ---');
  console.log(`Host: ${poolConfig.host}:${poolConfig.port}, DB: ${poolConfig.database}`);

  const pool = new Pool(poolConfig);

  try {
    const client = await pool.connect();
    console.log('✓ Successfully connected to PostgreSQL.');

    const migrationFiles = [
      '001_init.sql',
      '002_supabase_schema.sql',
      '003_completions.sql',
      '004_job_doc_link.sql',
      '005_verifications_table.sql'
    ];


    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, 'migrations', file);
      console.log(`Applying migration: ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      await client.query(sql);
      console.log(`✓ Migration ${file} applied successfully.`);
    }

    // Seed initial users if they do not exist
    console.log('Seeding standard developer users...');
    const usersToSeed = [
      { id: "rev-clerk-001", name: "Clerk Ram", role: "clerk", district: "Green Valley" },
      { id: "rev-super-002", name: "Supervisor Sita", role: "supervisor", district: "All" },
      { id: "rev-admin-003", name: "Admin Laxman", role: "admin", district: "All" }
    ];

    for (const u of usersToSeed) {
      await client.query(`
        INSERT INTO users (id, name, role, district)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING
      `, [u.id, u.name, u.role, u.district]);
    }
    console.log('✓ Users seeded successfully.');

    // Seed initial test records if they do not exist
    console.log('Seeding initial land records...');
    const initialRecords = [
      {
        id: "rec_9011",
        status: "extracted",
        district: "Green Valley",
        extracted_fields: {
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
        }
      },
      {
        id: "rec_9012",
        status: "approved",
        district: "Sunny Hill",
        extracted_fields: {
          owner_name: { value: "Alice Margret", confidence: 0.98, original_value: "Alice Margret" },
          survey_number: { value: "1024/2", confidence: 0.92, original_value: "1024/2" },
          khasra_or_khata_number: { value: "KH-33104", confidence: 0.94, original_value: "KH-33104" },
          area: { value: 2.50, confidence: 0.97, original_value: "2.5" },
          area_unit: { value: "Acres", confidence: 0.99, original_value: "Acres" },
          village: { value: "Sunny Hill", confidence: 0.95, original_value: "Sunny Hill" },
          taluk: { value: "North Taluk", confidence: 0.91, original_value: "North Taluk" },
          district: { value: "Valley District", confidence: 0.96, original_value: "Valley District" },
          land_classification: { value: "Residential", confidence: 0.94, original_value: "Residential" },
          khata_type: { value: "A", confidence: 0.90, original_value: "A" },
          tenancy_status: { value: "Owner-cultivated", confidence: 0.95, original_value: "Owner-cultivated" },
          liabilities: { value: [], confidence: 0.92, original_value: [] },
          tax_status: { value: "Paid", confidence: 0.98, original_value: "Paid" }
        },
        signature: "MOCK_RSA_PSS_SHA256_SIGNATURE_HEX_BASE64_VALUE",
        public_key: "MOCK_RSA_PUBLIC_KEY_PEM",
        qr_code: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        document_id_code: "DOC_Hill102"
      },
      {
        id: "rec_9013",
        status: "corrected",
        district: "River Dale",
        extracted_fields: {
          owner_name: { value: "M...k D...n", confidence: 0.35, original_value: "M...k D...n", issue: "Illegible text detected" },
          survey_number: { value: "Unknown", confidence: 0.35, original_value: "Unknown", issue: "Unrecognized survey sequence" },
          khasra_or_khata_number: { value: "KH-90", confidence: 0.45, original_value: "KH-90", issue: "Faint ink - high ambiguity" },
          area: { value: 0.00, confidence: 0.30, original_value: "0.0", issue: "Area must be a positive number" },
          area_unit: { value: "Hectares", confidence: 0.85, original_value: "Hectares" },
          village: { value: "River Dale", confidence: 0.90, original_value: "River Dale" },
          taluk: { value: "West Taluk", confidence: 0.88, original_value: "West Taluk" },
          district: { value: "Coast District", confidence: 0.94, original_value: "Coast District" },
          land_classification: { value: "Wet Land", confidence: 0.82, original_value: "Wet Land" },
          khata_type: { value: null, confidence: 0.50, original_value: null, issue: "Khata verification failed" },
          tenancy_status: { value: "Leased", confidence: 0.87, original_value: "Leased" },
          liabilities: { value: [], confidence: 0.80, original_value: [] },
          tax_status: { value: "Outstanding", confidence: 0.92, original_value: "Outstanding" }
        }
      }
    ];

    for (const r of initialRecords) {
      await client.query(`
        INSERT INTO records (id, status, district, extracted_fields, signature, public_key, qr_code, document_id_code)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `, [
        r.id, 
        r.status, 
        r.district, 
        JSON.stringify(r.extracted_fields), 
        r.signature || null, 
        r.public_key || null, 
        r.qr_code || null, 
        r.document_id_code || null
      ]);
    }
    console.log('✓ Land records seeded successfully.');

    client.release();
  } catch (err) {
    console.error('✗ Migration/seeding failed:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations().catch(() => process.exit(1));
}

module.exports = { runMigrations };
