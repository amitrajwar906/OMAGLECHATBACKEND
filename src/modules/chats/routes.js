const express = require('express');
const { authMiddleware } = require('../../middlewares/auth');
const {
  getUserChats,
  getPrivateChat
} = require('./controller');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getUserChats);
router.get('/private/:userId', getPrivateChat);

module.exports = router;