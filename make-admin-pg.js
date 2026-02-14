const { pool } = require('./src/config/database');

async function makeAdmin() {
  try {
    const result = await pool.query('UPDATE users SET role = $1 WHERE username = $2', ['admin', 'amitxdev']);
    console.log('Updated:', result.rowCount, 'row(s)');
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit();
  }
}

makeAdmin();
