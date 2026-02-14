const Message = require('./model');
const User = require('../users/model');
const Group = require('../groups/model');
const { pool } = require('../../config/database');
const { onlineUsers } = require('../../sockets/socketHandler');

const getGroupMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!groupId) {
      return res.status(400).json({
        success: false,
        message: 'Group ID is required'
      });
    }

    const isMember = await Group.isMember(groupId, req.user.userId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these messages'
      });
    }

    const offset = (page - 1) * limit;
    const messages = await Message.findByChatRoom('group', groupId, parseInt(limit), offset);
    
    const broadcastMessages = await Message.findBroadcasts();
    
    const allMessages = [...messages, ...broadcastMessages].sort((a, b) => 
      new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt)
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM messages WHERE "chatType" = $1 AND "chatRoomId" = $2 AND "isDeleted" = FALSE',
      ['group', groupId]
    );
    const total = parseInt(countResult.rows[0].total) + broadcastMessages.length;

    res.json({
      success: true,
      data: allMessages
    });
  } catch (error) {
    next(error);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const { chatId, type } = req.query;
    const { page = 1, limit = 50 } = req.query;

    if (!chatId || !type) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and type are required'
      });
    }

    if (type === 'group') {
      const isMember = await Group.isMember(chatId, req.user.userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view these messages'
        });
      }
    }

    if (type === 'private') {
      const otherUserId = parseInt(chatId);
      const currentUserId = req.user.userId;
      const messages = await Message.findPrivateChat(otherUserId, currentUserId, parseInt(limit), (page - 1) * limit);
      const broadcastMessages = await Message.findBroadcasts();
      
      const allMessages = [...messages, ...broadcastMessages].sort((a, b) => 
        new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt)
      );
      
      const countResult = await pool.query(
        'SELECT COUNT(*) as total FROM messages WHERE "chatType" = $1 AND (("chatRoomId" = $2 AND "senderId" = $3) OR ("chatRoomId" = $4 AND "senderId" = $5)) AND "isDeleted" = FALSE',
        ['private', otherUserId, currentUserId, currentUserId, otherUserId]
      );
      const total = parseInt(countResult.rows[0].total) + broadcastMessages.length;

      return res.json({
        success: true,
        data: {
          messages: allMessages,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    }

    const offset = (page - 1) * limit;
    const messages = await Message.findByChatRoom(type, chatId, parseInt(limit), offset);
    const broadcastMessages = await Message.findBroadcasts();
    
    const allMessages = [...messages, ...broadcastMessages].sort((a, b) => 
      new Date(a.created_at || a.createdAt) - new Date(b.created_at || b.createdAt)
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM messages WHERE "chatType" = $1 AND "chatRoomId" = $2 AND "isDeleted" = FALSE',
      [type, chatId]
    );
    const total = parseInt(countResult.rows[0].total) + broadcastMessages.length;

    res.json({
      success: true,
      data: {
        messages: allMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    let { content, chatType, chatRoom, groupId } = req.body;

    console.log('sendMessage called:', { content, chatType, chatRoom, groupId, userId: req.user?.userId });

    if (groupId) {
      chatType = 'group';
      chatRoom = groupId;
    }

    if (!content || !chatType || !chatRoom) {
      return res.status(400).json({
        success: false,
        message: 'Content, chat type, and chat room are required'
      });
    }

    const chatRoomId = parseInt(chatRoom);
    if (isNaN(chatRoomId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat room ID'
      });
    }

    if (chatType === 'group') {
      const isMember = await Group.isMember(chatRoomId, req.user.userId);
      if (!isMember) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to send messages to this group'
        });
      }
    }

    const message = await Message.create({
      senderId: req.user.userId,
      content,
      chatType,
      chatRoomId
    });

    console.log('Message created:', message);

    if (!message) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create message'
      });
    }

    let io = req.app.get('io');
    if (!io) {
      io = global.io;
    }
    console.log('IO object:', io);
    if (!io) {
      console.error('IO is undefined! req.app:', req.app);
      return res.status(500).json({
        success: false,
        message: 'Socket IO not configured'
      });
    }
    const roomName = chatType === 'private' 
      ? `private_${[req.user.userId, chatRoomId].sort().join('_')}`
      : `group_${chatRoomId}`;
    
    io.to(roomName).emit('newMessage', message);

    if (chatType === 'private' && onlineUsers) {
      const recipientSocket = onlineUsers.get(chatRoomId.toString());
      if (recipientSocket) {
        io.to(recipientSocket.socketId).emit('newMessage', message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send message'
    });
  }
};

const editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (message.senderId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this message'
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit deleted message'
      });
    }

    const updatedMessage = await Message.update(messageId, {
      content,
      editedAt: new Date()
    });

    const io = req.app.get('io');
    const roomName = message.chatType === 'private'
      ? `private_${[message.senderId, message.chatRoomId].sort().join('_')}`
      : `group_${message.chatRoomId}`;

    io.to(roomName).emit('messageEdited', updatedMessage);

    res.json({
      success: true,
      message: 'Message updated successfully',
      data: { message: updatedMessage }
    });
  } catch (error) {
    next(error);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (message.senderId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    await Message.delete(messageId);

    const io = req.app.get('io');
    const roomName = message.chatType === 'private'
      ? `private_${[message.senderId, message.chatRoomId].sort().join('_')}`
      : `group_${message.chatRoomId}`;

    io.to(roomName).emit('messageDeleted', { messageId });

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMessages,
  getGroupMessages,
  sendMessage,
  editMessage,
  deleteMessage
};
