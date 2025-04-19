/**
 * Port 3000 Starter Script
 * 
 * This script forces the application to use port 3000 by setting the PORT
 * environment variable before starting the application.
 */

const { spawn } = require('child_process');
const path = require('path');

// Set environment variables
process.env.PORT = '3000';
process.env.MCP_ENABLED = 'true';

console.log('🚀 Starting application on PORT 3000...');

// Start the application with npm run dev
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npm, ['run', 'dev'], {
  env: process.env,
  stdio: 'inherit'
});

child.on('error', (error) => {
  console.error(`Error starting the application: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  console.log(`Application process exited with code ${code}`);
  process.exit(code);
});