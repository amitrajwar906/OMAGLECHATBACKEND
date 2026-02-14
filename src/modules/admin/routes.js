const express = require('express');
const router = express.Router();
const User = require('../users/model');
const Group = require('../groups/model');
const { pool } = require('../../config/database');
const { authMiddleware } = require('../../middlewares/auth');

router.use(authMiddleware);

const adminAuth = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

router.use(adminAuth);

router.get('/users', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    
    let query = 'SELECT id, username, email, avatar, bio, "isOnline", "lastSeen", "createdAt", role FROM users';
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    const params = [];
    const countParams = [];
    
    if (search) {
      query += ' WHERE username LIKE $1 OR email LIKE $2';
      countQuery += ' WHERE username LIKE $1 OR email LIKE $2';
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY "createdAt" DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const countResult = await pool.query(countQuery, countParams);
    const usersResult = await pool.query(query, params);
    
    res.json({
      success: true,
      data: {
        users: usersResult.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

router.put('/users/:id/role', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    res.json({ success: true, message: `User role updated to ${role}` });
  } catch (error) {
    next(error);
  }
});

router.get('/groups', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const countResult = await pool.query('SELECT COUNT(*) as total FROM groups');
    const groupsResult = await pool.query(
      `SELECT g.*, u.username as admin_name,
       (SELECT COUNT(*) FROM group_members WHERE "groupId" = g.id) as member_count
       FROM groups g 
       LEFT JOIN users u ON g.admin = u.id 
       ORDER BY g."createdAt" DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const groups = groupsResult.rows.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      avatar: g.avatar,
      admin: g.admin,
      isPrivate: g.isPrivate,
      createdAt: g.createdAt,
      adminName: g.admin_name,
      memberCount: parseInt(g.member_count) || 0
    }));
    
    res.json({
      success: true,
      data: {
        groups,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/groups/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM groups WHERE id = $1', [id]);
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
});

router.post('/broadcast', async (req, res, next) => {
  try {
    const { content, image, buttonText, buttonUrl } = req.body;
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }
    
    const io = global.io;
    if (!io) {
      return res.status(500).json({ success: false, message: 'Socket not initialized' });
    }
    
    const senderId = req.user.userId;
    
    const result = await pool.query(
      'INSERT INTO messages ("senderId", content, "chatType", "chatRoomId", image, button_text, button_url) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [senderId, content, 'broadcast', 0, image || null, buttonText || null, buttonUrl || null]
    );
    
    const messageId = result.rows[0].id;
    const message = {
      id: messageId,
      content,
      image: image || null,
      buttonText: buttonText || null,
      buttonUrl: buttonUrl || null,
      chatType: 'broadcast',
      chatRoomId: 0,
      sender: {
        id: senderId,
        username: req.user.username,
        _id: senderId
      },
      createdAt: new Date().toISOString(),
      readBy: []
    };
    
    io.emit('newMessage', message);
    io.emit('broadcast', message);
    
    res.json({ success: true, message: 'Broadcast sent successfully', data: message });
  } catch (error) {
    next(error);
  }
});

router.get('/broadcasts', async (req, res, next) => {
  try {
    const broadcastsResult = await pool.query(
      `SELECT m.*, u.username as sender_username, u.avatar as sender_avatar 
       FROM messages m 
       LEFT JOIN users u ON m."senderId" = u.id 
       WHERE m."chatType" = 'broadcast' AND m."isDeleted" = FALSE
       ORDER BY m."createdAt" DESC`
    );
    
    const formattedBroadcasts = broadcastsResult.rows.map(b => ({
      id: b.id,
      content: b.content,
      image: b.image,
      buttonText: b.buttonText,
      buttonUrl: b.buttonUrl,
      createdAt: b.createdAt,
      sender: {
        id: b.senderId,
        username: b.sender_username,
        avatar: b.sender_avatar
      }
    }));
    
    res.json({
      success: true,
      data: { broadcasts: formattedBroadcasts }
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/broadcasts/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE messages SET "isDeleted" = TRUE WHERE id = $1 AND "chatType" = $2', [id, 'broadcast']);
    res.json({ success: true, message: 'Broadcast deleted successfully' });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
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
    next(error);
  }
});

module.exports = router;
