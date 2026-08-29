const { spawn } = require('child_process');
const path = require('path');

console.log('=== Starting Terravision Digitization Monorepo Services ===\n');

// Helper to spawn and log child process outputs
function startService(name, command, args, cwd) {
  const process = spawn(command, args, { cwd, shell: true });

  process.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line) console.log(`[${name}] ${line}`);
    });
  });

  process.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line) console.error(`[${name}-ERROR] ${line}`);
    });
  });

  process.on('close', (code) => {
    console.log(`[${name}] Process exited with code ${code}`);
  });

  return process;
}

// 1. Start Express Backend
const backendDir = path.join(__dirname, 'backend');
const backendProcess = startService('BackendAPI', 'node', ['index.js'], backendDir);

// 2. Start Vite Frontend on Port 5175
const frontendDir = path.join(__dirname, 'frontend');
const frontendProcess = startService('FrontendUI', 'npx', ['vite', '--port', '5175'], frontendDir);

// 3. Start Python Verification-Mark Signer
const signerDir = path.join(__dirname, 'backend', 'services', 'verification-mark');
// Check Windows vs Unix pathing for virtual env python executable
const pythonCmd = process.platform === 'win32' 
  ? path.join('.venv', 'Scripts', 'python') 
  : path.join('.venv', 'bin', 'python');

const signerProcess = startService(
  'SignerAPI', 
  pythonCmd, 
  ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8004'], 
  signerDir
);

// Graceful shutdown helper
process.on('SIGINT', () => {
  console.log('\nStopping all services...');
  backendProcess.kill();
  frontendProcess.kill();
  signerProcess.kill();
  process.exit();
});
