const User = require('../modules/users/model');
const Group = require('../modules/groups/model');

const onlineUsers = new Map();

module.exports = { onlineUsers };

const initializeSocket = (io) => {
  const { authenticateSocket } = require('./auth');

  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    console.log(`User ${socket.username} connected with ID: ${socket.userId}`);
    
    // Add user info to socket for easier access
    socket.user = {
      id: socket.userId,
      username: socket.username
    };

    onlineUsers.set(socket.userId, {
      socketId: socket.id,
      username: socket.username,
      userId: socket.userId
    });

    await User.update(socket.userId, {
      isOnline: true,
      lastSeen: new Date()
    });

    socket.broadcast.emit('userOnline', {
      userId: socket.userId,
      username: socket.username
    });

    const onlineUsersList = Array.from(onlineUsers.values()).map(user => ({
      userId: user.userId,
      username: user.username
    }));

    socket.emit('onlineUsers', onlineUsersList);

    socket.on('joinPrivateChat', async ({ otherUserId }) => {
      const roomName = `private_${[socket.userId, otherUserId].sort().join('_')}`;
      socket.join(roomName);
      
      const otherUserSocket = Array.from(onlineUsers.values())
        .find(user => user.userId === otherUserId);
      
      if (otherUserSocket) {
        socket.to(otherUserSocket.socketId).emit('privateChatJoined', {
          userId: socket.userId,
          username: socket.username
        });
      }
    });

    socket.on('leavePrivateChat', ({ otherUserId }) => {
      const roomName = `private_${[socket.userId, otherUserId].sort().join('_')}`;
      socket.leave(roomName);
    });

    socket.on('joinGroup', async ({ groupId }) => {
      try {
        console.log(`User ${socket.username} trying to join group ${groupId}`);
        const isMember = await Group.isMember(groupId, socket.userId);
        if (isMember) {
          const roomName = `group_${groupId}`;
          socket.join(roomName);
          console.log(`User ${socket.username} joined room ${roomName}`);
          
          socket.to(roomName).emit('userJoinedGroup', {
            userId: socket.userId,
            username: socket.username,
            groupId
          });
        } else {
          console.log(`User ${socket.username} is not a member of group ${groupId}`);
        }
      } catch (error) {
        console.error('Error joining group:', error);
      }
    });

    socket.on('leaveGroup', ({ groupId }) => {
      const roomName = `group_${groupId}`;
      socket.leave(roomName);
      
      socket.to(roomName).emit('userLeftGroup', {
        userId: socket.userId,
        username: socket.username,
        groupId
      });
    });

    socket.on('typing', ({ chatType, chatRoom }) => {
      const roomName = chatType === 'private'
        ? `private_${[socket.userId, chatRoom].sort().join('_')}`
        : `group_${chatRoom}`;

      socket.to(roomName).emit('userTyping', {
        userId: socket.userId,
        username: socket.username,
        chatType,
        chatRoom
      });
    });

    socket.on('stopTyping', ({ chatType, chatRoom }) => {
      const roomName = chatType === 'private'
        ? `private_${[socket.userId, chatRoom].sort().join('_')}`
        : `group_${chatRoom}`;

      socket.to(roomName).emit('userStoppedTyping', {
        userId: socket.userId,
        username: socket.username,
        chatType,
        chatRoom
      });
    });

    socket.on('disconnect', async () => {
      console.log(`User ${socket.username} disconnected`);

      onlineUsers.delete(socket.userId);

      await User.update(socket.userId, {
        isOnline: false,
        lastSeen: new Date()
      });

      socket.broadcast.emit('userOffline', {
        userId: socket.userId,
        username: socket.username,
        lastSeen: new Date()
      });
    });

    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.username}:`, error);
    });
  });
};

module.exports = { initializeSocket };