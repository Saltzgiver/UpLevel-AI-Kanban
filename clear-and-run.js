/**
 * Enhanced application starter
 * 
 * This script provides a solution to port conflicts by:
 * 1. Using a different port (3000 instead of 5000)
 * 2. Running the application with the PORT environment variable
 */

import { spawn } from 'child_process';

console.log('🚀 Starting AI Kanban board application with enhanced port handling...');

// Choose a different port to avoid conflicts
const PORT = 3000;
console.log(`Using port ${PORT} instead of the default 5000...`);

try {
  // Start the application with the PORT environment variable
  console.log(`Starting application with PORT=${PORT}...`);
  
  // Execute tsx directly with the PORT environment variable
  const proc = spawn('npx', ['tsx', 'server/index.ts'], { 
    stdio: 'inherit',
    env: { ...process.env, PORT: PORT.toString() }
  });
  
  proc.on('error', (err) => {
    console.error('Failed to start process:', err);
  });
  
  // Handle process exit
  proc.on('close', (code) => {
    if (code !== 0) {
      console.log(`Process exited with code ${code}`);
    }
  });
} catch (error) {
  console.error('Error starting application:', error.message);
  process.exit(1);
}