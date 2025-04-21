/**
 * Google Docs MCP Action Script
 * 
 * This script adds a Google Docs "Find Document" action to the MCP actions table
 * for integration with our Zapier MCP implementation.
 */

import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('Adding Google Docs Find Document action to MCP actions...');

  try {
    // Check if action already exists
    const checkResult = await pool.query(
      'SELECT * FROM mcp_actions WHERE name = $1',
      ['google_docs.find_document']
    );

    if (checkResult.rows.length > 0) {
      console.log('Google Docs action already exists, updating...');
      
      // Update the existing action
      await pool.query(
        'UPDATE mcp_actions SET display_name = $1, description = $2, enabled = $3 WHERE name = $4',
        [
          'Find Google Document', 
          'Search for a Google Document by name or keywords',
          true,
          'google_docs.find_document'
        ]
      );
      
      console.log('Google Docs action updated successfully!');
    } else {
      // Insert the new action
      await pool.query(
        'INSERT INTO mcp_actions (name, display_name, description, enabled) VALUES ($1, $2, $3, $4)',
        [
          'google_docs.find_document', 
          'Find Google Document', 
          'Search for a Google Document by name or keywords',
          true
        ]
      );
      
      console.log('Google Docs action added successfully!');
    }

    // Now check for our test action (ping)
    const pingCheckResult = await pool.query(
      'SELECT * FROM mcp_actions WHERE name = $1',
      ['ping']
    );

    if (pingCheckResult.rows.length === 0) {
      // Add a simple ping action for testing
      await pool.query(
        'INSERT INTO mcp_actions (name, display_name, description, enabled) VALUES ($1, $2, $3, $4)',
        [
          'ping', 
          'Test Connection', 
          'Simple action to test the Zapier MCP connection',
          true
        ]
      );
      
      console.log('Ping test action added successfully!');
    }

    console.log('MCP actions setup complete!');
  } catch (error) {
    console.error('Error setting up MCP actions:', error);
  } finally {
    pool.end();
  }
}

main();