/*
 * One-time utility script to convert null API keys to "from_env" 
 * for all columns with GPT assigned.
 */

import pg from 'pg';
const { Pool } = pg;

// Use the DATABASE_URL from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    console.log('Starting API key migration to "from_env"...');
    
    // Get all columns with GPT assigned but no API key
    const { rows: columnsToUpdate } = await pool.query(`
      SELECT id, name 
      FROM columns 
      WHERE gpt_assigned = true 
        AND (api_key IS NULL OR api_key = '')
    `);
    
    console.log(`Found ${columnsToUpdate.length} columns to update with missing API keys:`);
    
    // Update each column with the "from_env" value
    for (const column of columnsToUpdate) {
      console.log(`- Updating column ${column.id} ("${column.name}") with "from_env" API key`);
      
      await pool.query(`
        UPDATE columns 
        SET api_key = 'from_env' 
        WHERE id = $1
      `, [column.id]);
    }
    
    console.log('Migration completed successfully!');
    
    // Get all GPT-enabled columns to verify
    const { rows: allGptColumns } = await pool.query(`
      SELECT id, name, api_key 
      FROM columns 
      WHERE gpt_assigned = true 
      ORDER BY id
    `);
    
    console.log('\nCurrent GPT-enabled columns:');
    for (const column of allGptColumns) {
      console.log(`- Column ${column.id} ("${column.name}"): API key = ${column.api_key || 'NULL'}`);
    }
    
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the script
main();