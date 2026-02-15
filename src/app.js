const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { testConnection, initDatabase, pool } = require('./config/database');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./modules/auth/routes');
const userRoutes = require('./modules/users/routes');
const groupRoutes = require('./modules/groups/routes');
const chatRoutes = require('./modules/chats/routes');
const messageRoutes = require('./modules/messages/routes');
const adminRoutes = require('./modules/admin/routes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

// Rate limiting configuration
const limiterConfig = {
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
};

const limiter = process.env.NODE_ENV === 'production' 
  ? rateLimit(limiterConfig) 
  : (req, res, next) => next();

app.use(helmet());
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize database connection and tables
testConnection();
initDatabase();

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);

app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

app.use(errorHandler);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Public stats endpoint (no auth required)
app.get('/api/public/stats', async (req, res) => {
  try {
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    const groupCount = await pool.query('SELECT COUNT(*) as count FROM groups');
    const messageCount = await pool.query('SELECT COUNT(*) as count FROM messages');
    const onlineUsers = await pool.query('SELECT COUNT(*) as count FROM users WHERE "isOnline" = true');
    
    res.json({
      success: true,
      data: {
        totalUsers: parseInt(userCount.rows[0].count),
        totalGroups: parseInt(groupCount.rows[0].count),
        totalMessages: parseInt(messageCount.rows[0].count),
        onlineUsers: parseInt(onlineUsers.rows[0].count)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});

module.exports = app;