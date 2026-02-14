const { pool } = require('../../config/database');

class Message {
  static async create(messageData) {
    const { senderId, content, chatType, chatRoomId, image, buttonText, buttonUrl } = messageData;
    
    const result = await pool.query(
      `INSERT INTO messages ("senderId", content, "chatType", "chatRoomId", image, button_text, button_url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [senderId, content, chatType, chatRoomId, image || null, buttonText || null, buttonUrl || null]
    );
    
    return this.findById(result.rows[0].id);
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT m.*, u.id as sender_id, u.username, u.avatar 
       FROM messages m 
       LEFT JOIN users u ON m."senderId" = u.id 
       WHERE m.id = $1`,
      [id]
    );
    
    if (result.rows[0]) {
      result.rows[0].readBy = await this.getReadBy(id);
      result.rows[0].sender = {
        _id: result.rows[0].senderId,
        id: result.rows[0].senderId,
        username: result.rows[0].username,
        avatar: result.rows[0].avatar
      };
    }
    
    return result.rows[0] || null;
  }

  static async findByChatRoom(chatType, chatRoomId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT m.*, u.id as sender_id, u.username, u.avatar, u.role as sender_role
       FROM messages m 
       LEFT JOIN users u ON m."senderId" = u.id 
       WHERE m."chatType" = $1 AND m."chatRoomId" = $2 AND m."isDeleted" = FALSE
       ORDER BY m."createdAt" DESC 
       LIMIT $3 OFFSET $4`,
      [chatType, chatRoomId, limit, offset]
    );
    
    for (const message of result.rows) {
      message.readBy = await this.getReadBy(message.id);
      message.sender = {
        _id: message.senderId,
        id: message.senderId,
        username: message.username,
        avatar: message.avatar,
        role: message.sender_role
      };
    }
    
    return result.rows.reverse();
  }

  static async findPrivateChat(userId1, userId2, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT m.*, u.id as sender_id, u.username, u.avatar, u.role as sender_role
       FROM messages m 
       LEFT JOIN users u ON m."senderId" = u.id 
       WHERE m."chatType" = 'private' 
       AND ((m."chatRoomId" = $1 AND m."senderId" = $2) OR (m."chatRoomId" = $2 AND m."senderId" = $1))
       AND m."isDeleted" = FALSE
       ORDER BY m."createdAt" ASC 
       LIMIT $3 OFFSET $4`,
      [userId1, userId2, limit, offset]
    );
    
    for (const message of result.rows) {
      message.readBy = await this.getReadBy(message.id);
      message.sender = {
        _id: message.senderId,
        id: message.senderId,
        username: message.username,
        avatar: message.avatar,
        role: message.sender_role
      };
    }
    
    return result.rows;
  }

  static async update(id, updateData) {
    const allowedFields = ['content', 'editedAt', 'isDeleted'];
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
      `UPDATE messages SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0] ? this.findById(id) : null;
  }

  static async markAsRead(messageId, userId) {
    try {
      await pool.query(
        'INSERT INTO message_reads ("messageId", "userId") VALUES ($1, $2)',
        [messageId, userId]
      );
    } catch (e) {
      // Ignore duplicate
    }
    return true;
  }

  static async markMultipleAsRead(messageIds, userId) {
    if (messageIds.length === 0) return null;
    
    for (const messageId of messageIds) {
      await this.markAsRead(messageId, userId);
    }
    return true;
  }

  static async getReadBy(messageId) {
    const result = await pool.query(
      `SELECT mr.*, u.username 
       FROM message_reads mr 
       LEFT JOIN users u ON mr."userId" = u.id 
       WHERE mr."messageId" = $1`,
      [messageId]
    );
    return result.rows;
  }

  static async getUnreadCount(chatType, chatRoomId, userId) {
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM messages m 
       WHERE m."chatType" = $1 AND m."chatRoomId" = $2 AND m."senderId" != $3 
       AND m.id NOT IN (
         SELECT mr."messageId" FROM message_reads mr WHERE mr."userId" = $4
       ) AND m."isDeleted" = FALSE`,
      [chatType, chatRoomId, userId, userId]
    );
    return parseInt(result.rows[0].count);
  }

  static async getPrivateChatRoom(userId1, userId2) {
    return Math.min(userId1, userId2);
  }

  static async delete(id) {
    const result = await pool.query(
      'UPDATE messages SET "isDeleted" = TRUE WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  static async findBroadcasts() {
    const result = await pool.query(
      `SELECT m.*, u.id as sender_id, u.username, u.avatar 
       FROM messages m 
       LEFT JOIN users u ON m."senderId" = u.id 
       WHERE m."chatType" = 'broadcast' AND m."isDeleted" = FALSE
       ORDER BY m."createdAt" DESC`
    );
    
    for (const message of result.rows) {
      message.readBy = [];
      message.sender = {
        _id: message.senderId,
        id: message.senderId,
        username: message.username,
        avatar: message.avatar
      };
    }
    
    return result.rows;
  }
}

module.exports = Message;
