const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL if provided, otherwise fall back to individual config
let dbConfig;

if (process.env.DATABASE_URL) {
  const connectionUrl = new URL(process.env.DATABASE_URL);
  dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    host: connectionUrl.hostname,
    port: parseInt(connectionUrl.port) || 5432,
    database: connectionUrl.pathname.replace('/', ''),
    user: connectionUrl.username,
    password: connectionUrl.password,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
} else {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'omagledb',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

const pool = new Pool(dbConfig);

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL connected successfully');
    client.release();
  } catch (error) {
    console.error('PostgreSQL connection error:', error.message);
    process.exit(1);
  }
}

async function initDatabase() {
  const client = await pool.connect();
  
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(30) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar TEXT,
        bio VARCHAR(200) DEFAULT '',
        "isOnline" BOOLEAN DEFAULT FALSE,
        "lastSeen" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create groups table
    await client.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        description VARCHAR(200) DEFAULT '',
        avatar TEXT,
        admin INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "isPrivate" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create group_members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        id SERIAL PRIMARY KEY,
        "groupId" INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "joinedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("groupId", "userId")
      )
    `);

    // Create messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        "senderId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        "chatType" VARCHAR(20) NOT NULL,
        "chatRoomId" INTEGER NOT NULL,
        "replyToId" INTEGER REFERENCES messages(id) ON DELETE SET NULL,
        "editedAt" TIMESTAMP,
        "isDeleted" BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add replyToId column if it doesn't exist (for existing databases)
    try {
      await client.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS "replyToId" INTEGER REFERENCES messages(id) ON DELETE SET NULL
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_replytoid ON messages("replyToId")
      `);
    } catch (e) {
      // Ignore if column already exists
    }

    // Add isImage column if it doesn't exist (for existing databases)
    try {
      await client.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS "isImage" BOOLEAN DEFAULT FALSE
      `);
    } catch (e) {
      // Ignore if column already exists
    }

    // Create message_reads table
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_reads (
        id SERIAL PRIMARY KEY,
        "messageId" INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "readAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("messageId", "userId")
      )
    `);

    // Create friendships table
    await client.query(`
      CREATE TABLE IF NOT EXISTS friendships (
        id SERIAL PRIMARY KEY,
        "userId1" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "userId2" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("userId1", "userId2"),
        CHECK ("userId1" < "userId2")
      )
    `);

    // Create friend_requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id SERIAL PRIMARY KEY,
        "senderId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "receiverId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE("senderId", "receiverId")
      )
    `);

    // Create role column for users
    try {
      await client.query(`ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'`);
    } catch (e) {
      // Column might already exist
    }

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_chatroom_created ON messages("chatRoomId", "createdAt" DESC)`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages("senderId")`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members("groupId")`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members("userId")`).catch(() => {});

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Helper to run queries with automatic parameter handling
const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  initDatabase
};
