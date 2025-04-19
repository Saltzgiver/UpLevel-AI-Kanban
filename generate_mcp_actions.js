/**
 * Generate MCP actions
 * 
 * This script populates the mcp_actions table with example actions
 * for common publishing platforms like LinkedIn, Twitter, etc.
 */

import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';

// Example MCP actions to create
const SAMPLE_ACTIONS = [
  {
    name: 'linkedin_post',
    displayName: 'Post to LinkedIn',
    description: 'Publish this card as a post on LinkedIn'
  },
  {
    name: 'twitter_tweet',
    displayName: 'Tweet on X',
    description: 'Post this card as a tweet on X/Twitter'
  },
  {
    name: 'slack_message',
    displayName: 'Send to Slack',
    description: 'Send this card as a message to a Slack channel'
  },
  {
    name: 'wordpress_post',
    displayName: 'Publish to WordPress',
    description: 'Create a new WordPress post from this card'
  },
  {
    name: 'notion_page',
    displayName: 'Create Notion Page',
    description: 'Create a new Notion page from this card'
  },
  {
    name: 'email_notification',
    displayName: 'Send Email',
    description: 'Send an email notification about this card'
  },
  {
    name: 'ping',
    displayName: 'Ping (Test Connection)',
    description: 'Test the connection to the Zapier MCP integration'
  }
];

// Parse DB URL from environment
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/uplevel_kanban';

async function main() {
  console.log('Starting MCP actions generation...');
  
  // Connect to the database
  const pool = new Pool({ connectionString: DB_URL });
  
  try {
    // Check if the mcpActions table exists
    const { rows: tables } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'mcp_actions';
    `);
    
    if (tables.length === 0) {
      console.log('The mcp_actions table does not exist. Run the migrate_mcp_tables.js script first.');
      return;
    }
    
    // Get existing actions
    const { rows: existingActions } = await pool.query(`
      SELECT name FROM mcp_actions;
    `);
    
    const existingActionNames = existingActions.map(a => a.name);
    console.log('Existing MCP actions:', existingActionNames);
    
    // Insert each sample action if it doesn't already exist
    for (const action of SAMPLE_ACTIONS) {
      if (!existingActionNames.includes(action.name)) {
        console.log(`Adding action: ${action.name} (${action.displayName})`);
        
        await pool.query(`
          INSERT INTO mcp_actions (name, display_name, description, enabled)
          VALUES ($1, $2, $3, TRUE);
        `, [action.name, action.displayName, action.description]);
        
        console.log(`Added action: ${action.name}`);
      } else {
        console.log(`Action already exists: ${action.name}`);
      }
    }
    
    // Verify the actions were created
    const { rows: finalActions } = await pool.query(`
      SELECT name, display_name FROM mcp_actions ORDER BY id;
    `);
    
    console.log('\nAll MCP actions:');
    finalActions.forEach(action => {
      console.log(`- ${action.name}: ${action.display_name}`);
    });
    
    console.log('\nAction generation completed successfully!');
  } catch (error) {
    console.error('Action generation failed:', error);
  } finally {
    await pool.end();
  }
}

main();