const { spawn } = require('child_process');
const path = require('path');

console.log('=== Starting Terravision Digitization Monorepo Services ===\n');

// Helper to spawn and log child process outputs
function startService(name, command, args, cwd, useShell = false) {
  const proc = spawn(command, args, { cwd, shell: useShell });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line) console.log(`[${name}] ${line}`);
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line) console.error(`[${name}-ERROR] ${line}`);
    });
  });

  proc.on('close', (code) => {
    console.log(`[${name}] Process exited with code ${code}`);
  });

  return proc;
}

// Python venv python executable path (Windows vs Unix)
function pythonBin(serviceDir) {
  return process.platform === 'win32'
    ? path.join(serviceDir, '.venv', 'Scripts', 'python')
    : path.join(serviceDir, '.venv', 'bin', 'python');
}

// ──────────────────────────────────────────────────────────────────
// 1. Express Backend (Node.js) → port 5000
// ──────────────────────────────────────────────────────────────────
const backendDir = path.join(__dirname, 'backend');
const backendProcess = startService('BackendAPI', 'node', ['index.js'], backendDir);

// ──────────────────────────────────────────────────────────────────
// 2. Vite Frontend → port 5175
// ──────────────────────────────────────────────────────────────────
const frontendDir = path.join(__dirname, 'frontend');
const frontendProcess = startService('FrontendUI', 'npx', ['vite', '--port', '5175'], frontendDir, true);

// ──────────────────────────────────────────────────────────────────
// 3. Preprocessing Service (FastAPI) → port 8010
// ──────────────────────────────────────────────────────────────────
const preprocessingDir = path.join(__dirname, 'backend', 'services', 'preprocessing');
const preprocessingProcess = startService(
  'Preprocessing',
  pythonBin(preprocessingDir),
  ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8010'],
  preprocessingDir
);

// ──────────────────────────────────────────────────────────────────
// 4. Extraction Service (FastAPI) → port 8011
// ──────────────────────────────────────────────────────────────────
const extractionDir = path.join(__dirname, 'backend', 'services', 'extraction');
const extractionProcess = startService(
  'Extraction',
  pythonBin(extractionDir),
  ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8011'],
  extractionDir
);

// ──────────────────────────────────────────────────────────────────
// 5. Validation Service (FastAPI) → port 8012
// ──────────────────────────────────────────────────────────────────
const validationDir = path.join(__dirname, 'backend', 'services', 'validation');
const validationProcess = startService(
  'Validation',
  pythonBin(validationDir),
  ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8012'],
  validationDir
);

// ──────────────────────────────────────────────────────────────────
// 6. Pipeline Orchestrator (FastAPI) → port 8013
// ──────────────────────────────────────────────────────────────────
const pipelineDir = path.join(__dirname, 'backend', 'services', 'pipeline');
const pipelineProcess = startService(
  'Pipeline',
  pythonBin(pipelineDir),
  ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8013'],
  pipelineDir
);

// ──────────────────────────────────────────────────────────────────
// 7. Verification/Signing Service (FastAPI) → port 8014
// ──────────────────────────────────────────────────────────────────
const signerDir = path.join(__dirname, 'backend', 'services', 'verification-mark');
const signerProcess = startService(
  'SignerAPI',
  pythonBin(signerDir),
  ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8014'],
  signerDir
);

// ──────────────────────────────────────────────────────────────────
// Graceful shutdown — kill all child processes on Ctrl+C
// ──────────────────────────────────────────────────────────────────
const allProcesses = [
  backendProcess, frontendProcess,
  preprocessingProcess, extractionProcess,
  validationProcess, pipelineProcess, signerProcess
];

process.on('SIGINT', () => {
  console.log('\nStopping all services...');
  allProcesses.forEach(p => { try { p.kill(); } catch (e) {} });
  process.exit();
});
