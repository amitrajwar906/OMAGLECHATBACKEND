const express = require('express');
const { body } = require('express-validator');
const { authMiddleware } = require('../../middlewares/auth');
const {
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
} = require('./controller');

const router = express.Router();

router.use(authMiddleware);

const validateUpdate = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters'),
  body('bio')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Bio must be less than 200 characters')
];

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/search', searchUsers);
router.get('/online', getOnlineUsers);
router.post('/friends/:friendId', addFriend);
router.get('/all', getAllUsers);

// Friend request routes
router.post('/friend-request', sendFriendRequest);
router.get('/friend-requests', getFriendRequests);
router.post('/friend-request/:requestId/accept', acceptFriendRequest);
router.post('/friend-request/:requestId/reject', rejectFriendRequest);
router.get('/friends', getFriends);

module.exports = router;