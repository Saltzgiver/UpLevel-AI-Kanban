/**
 * Create a test image attachment with a simple red square image
 */
import pg from 'pg';
const { Pool } = pg;

// Base64 encoded 1x1 red pixel PNG - this is a minimal valid PNG image
const redPixelBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function createSimpleImage() {
  try {
    // Create a connection to the database
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Create a test image attachment with a simple red pixel
    const result = await pool.query(
      `INSERT INTO attachments (card_id, filename, file_type, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [94, 'red-pixel.png', 'image/png', redPixelBase64]
    );

    const id = result.rows[0].id;
    console.log(`Created red pixel test image attachment with ID: ${id}`);
    console.log(`You can view this image at: /api/attachments/${id}`);

    await pool.end();
  } catch (error) {
    console.error('Error creating test image:', error);
  }
}

createSimpleImage();