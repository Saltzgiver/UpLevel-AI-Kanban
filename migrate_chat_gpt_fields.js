import pg from 'pg';
const { Pool } = pg;

async function main() {
  // Use the DATABASE_URL environment variable
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  console.log('Starting migration...');

  try {
    // First check if the columns already exist
    const checkColumnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'chats' 
      AND column_name IN ('gptname', 'gptcolor');
    `);

    // If the new columns already exist, we don't need to do anything
    if (checkColumnsResult.rowCount > 0) {
      console.log('Columns already exist, no migration needed.');
      return;
    }

    // Open a transaction
    const client = await pool.connect();

    try {
      // Start transaction
      await client.query('BEGIN');

      // Add the new columns
      console.log('Adding temporary gptName and gptColor columns...');
      await client.query(`
        ALTER TABLE chats 
        ADD COLUMN IF NOT EXISTS "gptname" TEXT, 
        ADD COLUMN IF NOT EXISTS "gptcolor" TEXT;
      `);

      // Copy data from old columns to new columns
      console.log('Migrating data from old columns to new columns...');
      await client.query(`
        UPDATE chats 
        SET 
          "gptname" = gpt_name,
          "gptcolor" = gpt_color;
      `);

      // Drop the old columns
      console.log('Dropping old columns...');
      await client.query(`
        ALTER TABLE chats 
        DROP COLUMN IF EXISTS gpt_name,
        DROP COLUMN IF EXISTS gpt_color;
      `);

      // Rename the new columns to the proper snake_case
      console.log('Renaming columns to standard format...');
      await client.query(`
        ALTER TABLE chats 
        RENAME COLUMN "gptname" TO gpt_name;
        
        ALTER TABLE chats 
        RENAME COLUMN "gptcolor" TO gpt_color;
      `);

      // Commit the transaction
      await client.query('COMMIT');
      console.log('Migration completed successfully!');
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