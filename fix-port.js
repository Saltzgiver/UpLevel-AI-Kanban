/**
 * Fix Port Usage Script
 * 
 * This script helps resolve port conflicts by modifying the port
 * used by the application temporarily to avoid the EADDRINUSE error.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

console.log('🚀 Starting port conflict resolution script...');

// Find a file containing port configuration
const findPortConfiguration = () => {
  try {
    const serverIndexPath = path.resolve('server/index.ts');
    const fileContent = fs.readFileSync(serverIndexPath, 'utf8');
    
    console.log('Checking server/index.ts for port configuration...');
    return { 
      path: serverIndexPath, 
      content: fileContent 
    };
  } catch (error) {
    console.error('Could not find server/index.ts:', error.message);
    process.exit(1);
  }
};

try {
  // Try to start with a new port
  const portToUse = 3000;
  console.log(`Attempting to use port ${portToUse} instead of 5000...`);
  
  // We'll use the environment to override any hardcoded port
  console.log('Starting application with PORT environment variable...');
  execSync(`PORT=${portToUse} npm run dev`, { 
    stdio: 'inherit',
    env: { ...process.env, PORT: portToUse.toString() }
  });
} catch (error) {
  console.error('Error occurred during application startup:', error.message);
  console.log('\nSuggestions:');
  console.log('1. Try restarting your Replit workspace');
  console.log('2. Check server/index.ts to verify it uses process.env.PORT || 5000');
  console.log('3. Use a manual workflow to run with: PORT=3000 npm run dev');
  process.exit(1);
}