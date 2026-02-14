const { pool } = require('../../config/database');

class Group {
  static async create(groupData) {
    const { name, description = '', avatar = '', admin, isPrivate = false } = groupData;
    
    const result = await pool.query(
      `INSERT INTO groups (name, description, avatar, admin, "isPrivate") 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [name, description, avatar, admin, isPrivate]
    );
    
    const group = result.rows[0];
    
    await this.addMember(group.id, admin);
    
    return this.findById(group.id);
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT g.*, u.username as admin_username, u.email as admin_email 
       FROM groups g 
       LEFT JOIN users u ON g.admin = u.id 
       WHERE g.id = $1`,
      [id]
    );
    
    if (result.rows[0]) {
      result.rows[0].members = await this.getMembers(id);
    }
    
    return result.rows[0] || null;
  }

  static async findByAdmin(adminId) {
    const result = await pool.query(
      'SELECT * FROM groups WHERE admin = $1',
      [adminId]
    );
    
    for (const group of result.rows) {
      group.members = await this.getMembers(group.id);
    }
    
    return result.rows;
  }

  static async findByMember(userId) {
    const result = await pool.query(
      `SELECT g.*, gm."joinedAt" as joined_at
       FROM groups g 
       INNER JOIN group_members gm ON g.id = gm."groupId" 
       WHERE gm."userId" = $1`,
      [userId]
    );
    
    for (const group of result.rows) {
      group.members = await this.getMembers(group.id);
    }
    
    return result.rows;
  }

  static async update(id, updateData) {
    const allowedFields = ['name', 'description', 'avatar', 'isPrivate'];
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
      `UPDATE groups SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    return result.rows[0] ? this.findById(id) : null;
  }

  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM groups WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  }

  static async addMember(groupId, userId) {
    try {
      await pool.query(
        'INSERT INTO group_members ("groupId", "userId") VALUES ($1, $2)',
        [groupId, userId]
      );
      return true;
    } catch (error) {
      if (error.code === '23505') return false;
      throw error;
    }
  }

  static async removeMember(groupId, userId) {
    const result = await pool.query(
      'DELETE FROM group_members WHERE "groupId" = $1 AND "userId" = $2',
      [groupId, userId]
    );
    return result.rowCount > 0;
  }

  static async getMembers(groupId) {
    const result = await pool.query(
      `SELECT u.*, gm."joinedAt" as joined_at 
       FROM users u 
       INNER JOIN group_members gm ON u.id = gm."userId" 
       WHERE gm."groupId" = $1 
       ORDER BY gm."joinedAt"`,
      [groupId]
    );
    return result.rows;
  }

  static async isMember(groupId, userId) {
    const result = await pool.query(
      'SELECT 1 FROM group_members WHERE "groupId" = $1 AND "userId" = $2',
      [groupId, userId]
    );
    return result.rows.length > 0;
  }

  static async findPublic(limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT g.*, u.username as admin_username, u.email as admin_email 
       FROM groups g 
       LEFT JOIN users u ON g.admin = u.id 
       WHERE g."isPrivate" = false 
       ORDER BY g."createdAt" DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    for (const group of result.rows) {
      group.members = await this.getMembers(group.id);
    }
    
    return result.rows;
  }

  static async isAdmin(groupId, userId) {
    const result = await pool.query(
      'SELECT 1 FROM groups WHERE id = $1 AND admin = $2',
      [groupId, userId]
    );
    return result.rows.length > 0;
  }

  static async getUserGroups(userId) {
    const result = await pool.query(
      `SELECT g.*, u.username as admin_name
       FROM groups g
       JOIN group_members gm ON g.id = gm."groupId"
       LEFT JOIN users u ON g.admin = u.id
       WHERE gm."userId" = $1
       ORDER BY g."createdAt" DESC`,
      [userId]
    );
    return result.rows;
  }

  static async getPublicGroups(limit = 50, offset = 0) {
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM groups WHERE "isPrivate" = false'
    );
    
    const result = await pool.query(
      `SELECT g.*, u.username as admin_name,
       (SELECT COUNT(*) FROM group_members WHERE "groupId" = g.id) as member_count
       FROM groups g
       LEFT JOIN users u ON g.admin = u.id
       WHERE g."isPrivate" = false
       ORDER BY g."createdAt" DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      groups: result.rows,
      total: parseInt(countResult.rows[0].total)
    };
  }

  static async findAll(limit = 50, offset = 0) {
    const countResult = await pool.query('SELECT COUNT(*) as total FROM groups');
    
    const result = await pool.query(
      `SELECT g.*, u.username as admin_name,
       (SELECT COUNT(*) FROM group_members WHERE "groupId" = g.id) as member_count
       FROM groups g
       LEFT JOIN users u ON g.admin = u.id
       ORDER BY g."createdAt" DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      groups: result.rows,
      total: parseInt(countResult.rows[0].total)
    };
  }
}

module.exports = Group;
