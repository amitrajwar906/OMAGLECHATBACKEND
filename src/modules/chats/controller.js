const User = require('../users/model');
const Group = require('../groups/model');
const { pool } = require('../../config/database');

const getUserChats = async (req, res, next) => {
  try {
    // Get all users except current user (for private chat)
    const allUsersResult = await pool.query(
      'SELECT id, username, email, avatar, "isOnline", "lastSeen" FROM users WHERE id != $1 ORDER BY "isOnline" DESC, "lastSeen" DESC LIMIT 50',
      [req.user.userId]
    );
    
    // Get groups
    const groups = await Group.findByMember(req.user.userId);

    const chats = {
      private: allUsersResult.rows.map(user => ({
        _id: user.id,
        name: user.username,
        avatar: user.avatar,
        type: 'private',
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
      })),
      groups: groups.map(group => ({
        _id: group.id,
        name: group.name,
        avatar: group.avatar,
        type: 'group',
        memberCount: group.members?.length || 0,
        admin: group.admin,
        members: group.members
      }))
    };

    res.json({
      success: true,
      data: { chats }
    });
  } catch (error) {
    console.error('Error in getUserChats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load chats',
      error: error.message
    });
  }
};

const getPrivateChat = async (req, res, next) => {
  try {
    const { userId: targetUserId } = req.params;
    
    const user = await User.findById(targetUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        chat: {
          _id: targetUserId,
          name: user.username,
          avatar: user.avatar,
          type: 'private',
          isOnline: user.isOnline,
          lastSeen: user.lastSeen
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserChats,
  getPrivateChat
};
