/**
 * Set Default Port to 3000
 * 
 * This script creates a .env file with PORT=3000 to override
 * the default port (5000) in the application.
 */

import fs from 'fs/promises';

async function createEnvFile() {
  try {
    // Create basic .env file with PORT=3000
    const envContent = 'PORT=3000\n';
    
    // Check if .env already exists
    try {
      const existingEnv = await fs.readFile('.env', 'utf8');
      
      // If PORT is already in the file, just update it
      if (existingEnv.includes('PORT=')) {
        const updatedEnv = existingEnv.replace(/PORT=\d+/g, 'PORT=3000');
        await fs.writeFile('.env', updatedEnv);
        console.log('Updated existing .env file with PORT=3000');
      } else {
        // Append to existing file
        await fs.appendFile('.env', '\n' + envContent);
        console.log('Added PORT=3000 to existing .env file');
      }
    } catch (error) {
      // File doesn't exist, create new one
      await fs.writeFile('.env', envContent);
      console.log('Created new .env file with PORT=3000');
    }
    
    console.log('Application is now configured to run on port 3000.');
    console.log('Run with npm run dev or node start-on-port-3000.js');
  } catch (error) {
    console.error('Error setting up port:', error);
  }
}

createEnvFile();