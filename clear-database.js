const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'omagledb',
};

async function clearDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    console.log('Connected to database, clearing all data...');
    
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    await connection.execute('TRUNCATE TABLE message_reads');
    console.log('Cleared message_reads');
    
    await connection.execute('TRUNCATE TABLE messages');
    console.log('Cleared messages');
    
    await connection.execute('TRUNCATE TABLE friend_requests');
    console.log('Cleared friend_requests');
    
    await connection.execute('TRUNCATE TABLE friendships');
    console.log('Cleared friendships');
    
    await connection.execute('TRUNCATE TABLE group_members');
    console.log('Cleared group_members');
    
    await connection.execute('TRUNCATE TABLE `groups`');
    console.log('Cleared groups');
    
    await connection.execute('TRUNCATE TABLE users');
    console.log('Cleared users');
    
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\nDatabase cleared successfully!');
    
  } catch (error) {
    console.error('Error clearing database:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

clearDatabase();
