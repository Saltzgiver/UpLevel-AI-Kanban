import pg from 'pg';
const { Pool } = pg;

async function main() {
  // Use the DATABASE_URL environment variable
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  console.log('Starting migration for includeChatHistory...');

  try {
    // First check if the column already exists
    const checkColumnResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'cards' 
      AND column_name = 'include_chat_history';
    `);

    // If the new column already exists, we don't need to do anything
    if (checkColumnResult.rowCount > 0) {
      console.log('Column include_chat_history already exists, no migration needed.');
      return;
    }

    // Open a transaction
    const client = await pool.connect();

    try {
      // Start transaction
      await client.query('BEGIN');

      // Add the new column
      console.log('Adding include_chat_history column...');
      await client.query(`
        ALTER TABLE cards 
        ADD COLUMN IF NOT EXISTS include_chat_history BOOLEAN DEFAULT false;
      `);

      // Commit the transaction
      await client.query('COMMIT');
      console.log('Migration for includeChatHistory completed successfully!');
    } catch (e) {
      // If anything fails, roll back the transaction
      await client.query('ROLLBACK');
      console.error('Migration failed:', e);
      throw e;
    } finally {
      // Always release the client
      client.release();
    }
  } catch (err) {
    console.error('Error during migration:', err);
  } finally {
    // Close the pool
    await pool.end();
  }
}

main();