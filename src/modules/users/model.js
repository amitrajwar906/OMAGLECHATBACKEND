const { pool } = require('../../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { username, email, password, avatar = '', bio = '' } = userData;
    
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const result = await pool.query(
      `INSERT INTO users (username, email, password, avatar, bio, "lastSeen") 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING *`,
      [username, email, hashedPassword, avatar, bio]
    );
    
    return this.findById(result.rows[0].id);
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    return result.rows[0] || null;
  }

  static async findByUsername(username) {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    return result.rows[0] || null;
  }

  static async update(id, updateData) {
    const allowedFields = ['username', 'email', 'avatar', 'bio', 'isOnline', 'lastSeen'];
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`"${key}" = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    if (updates.length === 0) return null;
    
    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0] ? this.findById(id) : null;
  }

  static async updateLastSeen(userId) {
    const result = await pool.query(
      'UPDATE users SET "lastSeen" = NOW() WHERE id = $1 RETURNING *',
      [userId]
    );
    return result.rows[0];
  }

  static async updateLastSeenBatch(userIds) {
    if (userIds.length === 0) return null;
    
    const result = await pool.query(
      `UPDATE users SET "lastSeen" = NOW() WHERE id = ANY($1)`,
      [userIds]
    );
    return result;
  }

  static async comparePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async getFriends(userId) {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.avatar, u."isOnline", u."lastSeen" 
       FROM users u 
       INNER JOIN friendships f ON (u.id = f."userId1" OR u.id = f."userId2")
       WHERE (f."userId1" = $1 OR f."userId2" = $1) AND u.id != $1`,
      [userId]
    );

    return result.rows;
  }

  static async removeFriend(userId1, userId2) {
    const result = await pool.query(
      'DELETE FROM friendships WHERE ("userId1" = $1 AND "userId2" = $2) OR ("userId1" = $2 AND "userId2" = $1)',
      [Math.min(userId1, userId2), Math.max(userId1, userId2)]
    );
    return result;
  }

  static async addFriend(userId1, userId2) {
    const result = await pool.query(
      'INSERT INTO friendships ("userId1", "userId2") VALUES ($1, $2)',
      [Math.min(userId1, userId2), Math.max(userId1, userId2)]
    );
    return result;
  }

  static async sendFriendRequest(senderId, receiverId) {
    const existing = await pool.query(
      'SELECT * FROM friendships WHERE ("userId1" = $1 AND "userId2" = $2) OR ("userId1" = $2 AND "userId2" = $1)',
      [Math.min(senderId, receiverId), Math.max(senderId, receiverId)]
    );
    if (existing.rows.length > 0) {
      throw new Error('Already friends');
    }

    const existingRequest = await pool.query(
      'SELECT * FROM friend_requests WHERE ("senderId" = $1 AND "receiverId" = $2) OR ("senderId" = $2 AND "receiverId" = $1)',
      [senderId, receiverId]
    );
    if (existingRequest.rows.length > 0) {
      if (existingRequest.rows[0].status === 'pending') {
        throw new Error('Friend request already sent');
      }
      if (existingRequest.rows[0].status === 'accepted') {
        throw new Error('Already friends');
      }
      await pool.query(
        'UPDATE friend_requests SET "senderId" = $1, "receiverId" = $2, status = $3, "createdAt" = NOW() WHERE id = $4',
        [senderId, receiverId, 'pending', existingRequest.rows[0].id]
      );
      return { id: existingRequest.rows[0].id };
    }

    const result = await pool.query(
      'INSERT INTO friend_requests ("senderId", "receiverId", status) VALUES ($1, $2, $3) RETURNING *',
      [senderId, receiverId, 'pending']
    );
    return result.rows[0];
  }

  static async getPendingRequests(userId) {
    const result = await pool.query(
      `SELECT fr.*, u.username, u.avatar, u."isOnline", u.role
       FROM friend_requests fr 
       JOIN users u ON fr."senderId" = u.id 
       WHERE fr."receiverId" = $1 AND fr.status = 'pending'
       ORDER BY fr."createdAt" DESC`,
      [userId]
    );
    return result.rows;
  }

  static async getSentRequests(userId) {
    const result = await pool.query(
      `SELECT fr.*, u.username, u.avatar, u."isOnline", u.role
       FROM friend_requests fr 
       JOIN users u ON fr."receiverId" = u.id 
       WHERE fr."senderId" = $1 AND fr.status = 'pending'
       ORDER BY fr."createdAt" DESC`,
      [userId]
    );
    return result.rows;
  }

  static async acceptFriendRequest(requestId, userId) {
    const request = await pool.query(
      'SELECT * FROM friend_requests WHERE id = $1 AND "receiverId" = $2 AND status = $3',
      [requestId, userId, 'pending']
    );
    
    if (request.rows.length === 0) {
      throw new Error('Request not found');
    }

    await pool.query(
      'UPDATE friend_requests SET status = $1 WHERE id = $2',
      ['accepted', requestId]
    );

    await this.addFriend(request.rows[0].senderId, request.rows[0].receiverId);
    return true;
  }

  static async rejectFriendRequest(requestId, userId) {
    const result = await pool.query(
      'UPDATE friend_requests SET status = $1 WHERE id = $2 AND "receiverId" = $3',
      ['rejected', requestId, userId]
    );
    return result;
  }

  static async getFriendsWithStatus(userId) {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.avatar, u."isOnline", u."lastSeen", u.bio, u.role,
        CASE 
          WHEN f.id IS NOT NULL THEN 'friends'
          WHEN fr_s.id IS NOT NULL AND fr_s.status = 'pending' THEN 'request_sent'
          WHEN fr_r.id IS NOT NULL AND fr_r.status = 'pending' THEN 'request_received'
          ELSE 'none'
        END as friendstatus
       FROM users u
       LEFT JOIN friendships f ON (f."userId1" = u.id AND f."userId2" = $1) OR (f."userId2" = u.id AND f."userId1" = $1)
       LEFT JOIN friend_requests fr_s ON fr_s."senderId" = u.id AND fr_s."receiverId" = $1 AND fr_s.status = 'pending'
       LEFT JOIN friend_requests fr_r ON fr_r."senderId" = $1 AND fr_r."receiverId" = u.id AND fr_r.status = 'pending'
       WHERE u.id != $1`,
      [userId]
    );
    return result.rows.map(row => ({
      ...row,
      friendStatus: row.friendstatus
    }));
  }

  static toJSON(user) {
    const { password, ...userWithoutPassword } = user;
    return {
      _id: userWithoutPassword.id,
      ...userWithoutPassword
    };
  }
}

module.exports = User;
