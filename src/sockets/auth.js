const jwt = require('jsonwebtoken');
const User = require('../modules/users/model');

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = decoded.userId;
    socket.username = user.username;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
};

module.exports = { authenticateSocket };