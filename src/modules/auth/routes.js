const express = require('express');
const { body } = require('express-validator');
const { register, login } = require('./controller');
const { authMiddleware } = require('../../middlewares/auth');

const router = express.Router();

const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

const validateLogin = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);

module.exports = router;