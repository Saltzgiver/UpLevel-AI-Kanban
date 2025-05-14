/**
 * Create a test image attachment with valid image data
 */
import pg from 'pg';
const { Pool } = pg;

// Test image data - this is a small valid PNG image (100x100 blue square)
const testImageBase64 = `iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnklEQVR42u3RAQ0AAAgDIN8/9K3hIGzAQAIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiKyF3qXAMR++0wqAAAAAElFTkSuQmCC`;

async function createTestImage() {
  try {
    // Create a connection to the database
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Create a test image attachment
    const result = await pool.query(
      `INSERT INTO attachments (card_id, filename, file_type, content, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [94, 'test-image.png', 'image/png', testImageBase64]
    );

    const id = result.rows[0].id;
    console.log(`Created test image attachment with ID: ${id}`);
    console.log(`You can view this image at: /api/attachments/${id}`);

    await pool.end();
  } catch (error) {
    console.error('Error creating test image:', error);
  }
}

createTestImage();