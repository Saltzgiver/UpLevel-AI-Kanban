/**
 * Start Application on Alternate Port (3000)
 * 
 * This script starts the AI Kanban board application on port 3000 
 * instead of the default port 5000 to avoid port conflicts.
 * 
 * How to use:
 * 1. Run this script with: node start-on-port-3000.js
 * 2. Access the application at http://[replit-url]:3000
 */

import { spawn } from 'child_process';

console.log('🚀 Starting AI Kanban board on port 3000...');

// Execute tsx directly with the PORT environment variable
const proc = spawn('npx', ['tsx', 'server/index.ts'], { 
  stdio: 'inherit',
  env: { ...process.env, PORT: '3000' }
});

proc.on('error', (err) => {
  console.error('Failed to start process:', err);
  process.exit(1);
});

// Handle process exit
proc.on('close', (code) => {
  if (code !== 0) {
    console.log(`Process exited with code ${code}`);
    process.exit(code);
  }
});