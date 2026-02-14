const express = require('express');
const { body } = require('express-validator');
const { authMiddleware } = require('../../middlewares/auth');
const {
  createGroup,
  getUserGroups,
  joinGroup,
  removeMember,
  getGroupById,
  getPublicGroups,
  leaveGroup,
  updateGroup,
  deleteGroup,
  addUserToGroup
} = require('./controller');

const router = express.Router();

router.use(authMiddleware);

const validateCreateGroup = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Group name must be between 1 and 50 characters'),
  body('description')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Description must be less than 200 characters')
];

const validateUpdateGroup = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Group name must be between 1 and 50 characters'),
  body('description')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Description must be less than 200 characters'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL'),
  body('isPrivate')
    .optional()
    .isBoolean()
    .withMessage('isPrivate must be a boolean'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
];

const validateAddUser = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a valid positive integer')
];

router.post('/', validateCreateGroup, createGroup);
router.get('/', getUserGroups);
router.get('/public', getPublicGroups);
router.post('/:groupId/join', joinGroup);
router.delete('/:groupId/leave', leaveGroup);
router.delete('/:groupId/members/:memberId', removeMember);
router.get('/:groupId', getGroupById);

// Admin-only endpoints
router.put('/:groupId', validateUpdateGroup, updateGroup);
router.delete('/:groupId', deleteGroup);
router.post('/:groupId/add-user', validateAddUser, addUserToGroup);

module.exports = router;