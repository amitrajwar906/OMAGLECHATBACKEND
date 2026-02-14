const express = require('express');
const { body } = require('express-validator');
const { authMiddleware } = require('../../middlewares/auth');
const {
  getMessages,
  getGroupMessages,
  sendMessage,
  editMessage,
  deleteMessage
} = require('./controller');

const router = express.Router();

router.use(authMiddleware);

const validateSendMessage = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message content must be between 1 and 2000 characters'),
  body('chatType')
    .isIn(['private', 'group'])
    .withMessage('Chat type must be either private or group'),
  body('chatRoom')
    .notEmpty()
    .withMessage('Chat room ID is required')
];

const validateEditMessage = [
  body('content')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message content must be between 1 and 2000 characters')
];

router.get('/', getMessages);
router.get('/group/:groupId', getGroupMessages);
router.get('/private/:userId', getMessages);
router.post('/', sendMessage);
router.post('/group', sendMessage);
router.put('/:messageId', validateEditMessage, editMessage);
router.delete('/:messageId', deleteMessage);

module.exports = router;