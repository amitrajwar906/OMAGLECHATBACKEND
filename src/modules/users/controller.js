const User = require('./model');

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get friends
    const friends = await User.getFriends(req.user.userId);
    user.friends = friends;

    res.json({
      success: true,
      data: { user: User.toJSON(user) }
    });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { username, bio, avatar } = req.body;
    console.log('Update profile request:', { username, bio, avatar, userId: req.user.userId });
    
    const updateData = {};
    if (username) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (avatar !== undefined) updateData.avatar = avatar;

    const user = await User.update(req.user.userId, updateData);
    console.log('Updated user:', user);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: User.toJSON(user) }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const { query } = req.query;
    console.log('Search query:', query, 'User:', req.user.userId);
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const { pool } = require('../../config/database');
    const result = await pool.query(
      `SELECT id, username, avatar, "isOnline", bio, role
       FROM users 
       WHERE id != $1 AND (username LIKE $2 OR email LIKE $3) 
       LIMIT 20`,
      [req.user.userId, `%${query}%`, `%${query}%`]
    );

    console.log('Found users:', result.rows.length);
    res.json({
      success: true,
      data: { users: result.rows }
    });
  } catch (error) {
    console.error('Search error:', error);
    next(error);
  }
};

const addFriend = async (req, res, next) => {
  try {
    const { friendId } = req.params;
    
    if (friendId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add yourself as a friend'
      });
    }

    const user = await User.findById(req.user.userId);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already friends
    const friends = await User.getFriends(req.user.userId);
    const isAlreadyFriend = friends.some(f => f.id == friendId);
    
    if (isAlreadyFriend) {
      return res.status(400).json({
        success: false,
        message: 'Already friends with this user'
      });
    }

    await User.addFriend(req.user.userId, friendId);

    res.json({
      success: true,
      message: 'Friend added successfully'
    });
  } catch (error) {
    next(error);
  }
};

const getOnlineUsers = async (req, res, next) => {
  try {
    const { pool } = require('../../config/database');
    const result = await pool.query(
      'SELECT id, username, avatar, role FROM users WHERE "isOnline" = TRUE AND id != $1',
      [req.user.userId]
    );

    res.json({
      success: true,
      data: { users: result.rows }
    });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { pool } = require('../../config/database');
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.avatar, u."isOnline", u."lastSeen" 
       FROM users u 
       WHERE u.id != $1 
       AND u.id NOT IN (
         SELECT DISTINCT gm."userId" 
         FROM group_members gm 
         WHERE gm."groupId" IN (
           SELECT g.id 
           FROM groups g 
           WHERE g.admin = $2
         )
       )
       ORDER BY u."isOnline" DESC, u."lastSeen" DESC`,
      [req.user.userId, req.user.userId]
    );
    
    res.json({
      success: true,
      data: { users: result.rows }
    });
  } catch (error) {
    next(error);
  }
};

const sendFriendRequest = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const senderId = req.user.userId;

    if (senderId === parseInt(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend request to yourself'
      });
    }

    const User = require('./model');
    await User.sendFriendRequest(senderId, parseInt(userId));

    res.json({
      success: true,
      message: 'Friend request sent successfully'
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to send friend request'
    });
  }
};

const getFriendRequests = async (req, res, next) => {
  try {
    const User = require('./model');
    const requests = await User.getPendingRequests(req.user.userId);
    
    res.json({
      success: true,
      data: { requests }
    });
  } catch (error) {
    next(error);
  }
};

const acceptFriendRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const User = require('./model');
    await User.acceptFriendRequest(parseInt(requestId), req.user.userId);
    
    res.json({
      success: true,
      message: 'Friend request accepted'
    });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to accept friend request'
    });
  }
};

const rejectFriendRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const User = require('./model');
    await User.rejectFriendRequest(parseInt(requestId), req.user.userId);
    
    res.json({
      success: true,
      message: 'Friend request rejected'
    });
  } catch (error) {
    next(error);
  }
};

const getFriends = async (req, res, next) => {
  try {
    const User = require('./model');
    const friends = await User.getFriendsWithStatus(req.user.userId);
    
    res.json({
      success: true,
      data: { friends }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  searchUsers,
  addFriend,
  getOnlineUsers,
  getAllUsers,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends
};