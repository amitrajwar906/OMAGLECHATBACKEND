const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'omagledb',
};

const args = process.argv.slice(2);
const username = args[0];
const action = args[1] || 'admin';

async function manageAdmin() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    if (action === 'admin') {
      await connection.execute('UPDATE users SET role = "admin" WHERE username = ?', [username]);
      console.log(`User "${username}" is now an admin!`);
    } else if (action === 'user') {
      await connection.execute('UPDATE users SET role = "user" WHERE username = ?', [username]);
      console.log(`User "${username}" is now a regular user!`);
    }
    
  } catch (error) {
    console.log('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (!username) {
  console.log('Usage: node make-admin.js <username> [admin|user]');
  console.log('Example: node make-admin.js john admin');
} else {
  manageAdmin();
}
