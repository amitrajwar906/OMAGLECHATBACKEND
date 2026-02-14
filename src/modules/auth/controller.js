const User = require('../users/model');
const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign({ userId: user.id, username: user.username, role: user.role || 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findByEmail(email) || await User.findByUsername(username);

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists'
      });
    }

    const user = await User.create({ username, email, password });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: User.toJSON(user),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findByUsername(username);

    if (!user || !(await User.comparePassword(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }

    await User.update(user.id, {
      isOnline: true,
      lastSeen: new Date()
    });

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: User.toJSON({ ...user, isOnline: true, lastSeen: new Date() }),
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login
};