const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'omagledb',
};

async function addAdminRole() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('Checking for role column...');
    const [columns] = await connection.execute('SHOW COLUMNS FROM users LIKE "role"');
    
    if (columns.length === 0) {
      console.log('Adding role column to users table...');
      await connection.execute('ALTER TABLE users ADD COLUMN role ENUM("user", "admin") DEFAULT "user"');
      console.log('Role column added successfully!');
    } else {
      console.log('Role column already exists.');
    }
    
    console.log('\nDatabase updated for admin functionality.');
    
  } catch (error) {
    console.log('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addAdminRole();
