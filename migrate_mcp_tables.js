/**
 * Database migration script for Zapier MCP integration
 * 
 * This script:
 * 1. Creates the necessary MCP tables if they don't exist
 * 2. Adds MCP fields to the existing columns and cards tables
 */

import { sql } from 'drizzle-orm';
import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';

// Parse DB URL from environment
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/uplevel_kanban';

async function main() {
  console.log('Starting MCP database migration...');
  
  // Connect to the database
  const pool = new Pool({ connectionString: DB_URL });
  const db = drizzle(pool);
  
  try {
    // Check if the mcpActions table exists
    const { rows: tables } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('mcp_actions', 'column_mcp_actions', 'mcp_logs');
    `);
    
    const existingTables = tables.map(t => t.table_name);
    console.log('Existing MCP tables:', existingTables);
    
    // Create mcpActions table if it doesn't exist
    if (!existingTables.includes('mcp_actions')) {
      console.log('Creating mcp_actions table...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS mcp_actions (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          display_name TEXT NOT NULL,
          description TEXT,
          enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);
      console.log('Created mcp_actions table');
    }
    
    // Create columnMcpActions table if it doesn't exist
    if (!existingTables.includes('column_mcp_actions')) {
      console.log('Creating column_mcp_actions table...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS column_mcp_actions (
          id SERIAL PRIMARY KEY,
          column_id INTEGER NOT NULL REFERENCES columns(id),
          action_name TEXT NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);
      console.log('Created column_mcp_actions table');
    }
    
    // Create mcpLogs table if it doesn't exist
    if (!existingTables.includes('mcp_logs')) {
      console.log('Creating mcp_logs table...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS mcp_logs (
          id SERIAL PRIMARY KEY,
          direction TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          request_id TEXT,
          request_body TEXT,
          response_body TEXT,
          status_code INTEGER,
          duration INTEGER,
          error TEXT,
          card_id INTEGER REFERENCES cards(id),
          column_id INTEGER REFERENCES columns(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
        );
      `);
      console.log('Created mcp_logs table');
    }
    
    // Check if the required columns exist in the cards table
    const { rows: cardColumns } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'cards' 
      AND column_name IN ('external_id', 'external_url', 'source');
    `);
    
    const existingCardColumns = cardColumns.map(c => c.column_name);
    console.log('Existing card MCP columns:', existingCardColumns);
    
    // Add external_id column to cards table if it doesn't exist
    if (!existingCardColumns.includes('external_id')) {
      console.log('Adding external_id column to cards table...');
      await pool.query(`
        ALTER TABLE cards
        ADD COLUMN external_id TEXT;
      `);
      console.log('Added external_id column to cards table');
    }
    
    // Add external_url column to cards table if it doesn't exist
    if (!existingCardColumns.includes('external_url')) {
      console.log('Adding external_url column to cards table...');
      await pool.query(`
        ALTER TABLE cards
        ADD COLUMN external_url TEXT;
      `);
      console.log('Added external_url column to cards table');
    }
    
    // Add source column to cards table if it doesn't exist
    if (!existingCardColumns.includes('source')) {
      console.log('Adding source column to cards table...');
      await pool.query(`
        ALTER TABLE cards
        ADD COLUMN source TEXT;
      `);
      console.log('Added source column to cards table');
    }
    
    // Check if the required columns exist in the columns table
    const { rows: columnColumns } = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'columns' 
      AND column_name IN ('mcp_enabled', 'mcp_auto_trigger');
    `);
    
    const existingColumnColumns = columnColumns.map(c => c.column_name);
    console.log('Existing column MCP columns:', existingColumnColumns);
    
    // Add mcp_enabled column to columns table if it doesn't exist
    if (!existingColumnColumns.includes('mcp_enabled')) {
      console.log('Adding mcp_enabled column to columns table...');
      await pool.query(`
        ALTER TABLE columns
        ADD COLUMN mcp_enabled BOOLEAN DEFAULT FALSE;
      `);
      console.log('Added mcp_enabled column to columns table');
    }
    
    // Add mcp_auto_trigger column to columns table if it doesn't exist
    if (!existingColumnColumns.includes('mcp_auto_trigger')) {
      console.log('Adding mcp_auto_trigger column to columns table...');
      await pool.query(`
        ALTER TABLE columns
        ADD COLUMN mcp_auto_trigger BOOLEAN DEFAULT TRUE;
      `);
      console.log('Added mcp_auto_trigger column to columns table');
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

main();