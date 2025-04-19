/**
 * Fix Startup Script
 * 
 * This script ensures the application starts correctly by forcing a clean restart
 * of the npm run dev command. It's designed to be run when the normal Run button
 * doesn't properly start the application.
 */

import { execSync } from 'child_process';

console.log('🚀 Starting application cleanup and restart...');

try {
  // Check if server is already running on port 5000
  console.log('Checking for existing processes on port 5000...');
  try {
    const portCheck = execSync('lsof -i :5000').toString();
    if (portCheck.includes('node')) {
      console.log('Found existing process on port 5000, killing it...');
      const lines = portCheck.split('\n');
      for (const line of lines) {
        if (line.includes('node')) {
          const pid = line.trim().split(/\s+/)[1];
          if (pid) {
            console.log(`Killing process ${pid}...`);
            execSync(`kill -9 ${pid}`);
          }
        }
      }
    }
  } catch (e) {
    // No process running on port 5000, which is fine
    console.log('No existing process on port 5000.');
  }

  // Start the application
  console.log('Starting application with npm run dev...');
  execSync('npm run dev', { stdio: 'inherit' });
} catch (error) {
  console.error('Error occurred during application startup:', error.message);
  process.exit(1);
}