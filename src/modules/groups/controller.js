const Group = require('./model');
const User = require('../users/model');

const createGroup = async (req, res, next) => {
  try {
    const { name, description, avatar, isPrivate } = req.body;
    
    const group = await Group.create({
      name,
      description,
      avatar,
      isPrivate,
      admin: req.user.userId
    });

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: { group }
    });
  } catch (error) {
    next(error);
  }
};

const getUserGroups = async (req, res, next) => {
  try {
    const groups = await Group.findByMember(req.user.userId);

    res.json({
      success: true,
      data: { groups }
    });
  } catch (error) {
    next(error);
  }
};

const joinGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const isMember = await Group.isMember(groupId, req.user.userId);
    
    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'Already a member of this group'
      });
    }

    await Group.addMember(groupId, req.user.userId);
    const updatedGroup = await Group.findById(groupId);

    res.json({
      success: true,
      message: 'Joined group successfully',
      data: { group: updatedGroup }
    });
  } catch (error) {
    next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const { groupId, memberId } = req.params;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const isAdmin = await Group.isAdmin(groupId, req.user.userId);
    const isSelf = memberId === req.user.userId;
    
    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to remove this member'
      });
    }

    if (memberId === group.admin.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove group admin'
      });
    }

    await Group.removeMember(groupId, memberId);

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    next(error);
  }
};

const getGroupById = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const isMember = await Group.isMember(groupId, req.user.userId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Not a member of this group'
      });
    }

    res.json({
      success: true,
      data: { group }
    });
  } catch (error) {
    next(error);
  }
};

const getPublicGroups = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    const offset = (page - 1) * limit;
    const groups = await Group.findPublic(parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      data: { groups }
    });
  } catch (error) {
    next(error);
  }
};

const leaveGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (group.admin.toString() === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Group admin cannot leave their own group'
      });
    }

    await Group.removeMember(groupId, req.user.userId);

    res.json({
      success: true,
      message: 'Left group successfully'
    });
  } catch (error) {
    next(error);
  }
};

const updateGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { name, description, avatar, isPrivate, isPublic } = req.body;
    
    // Convert isPublic to isPrivate if needed
    const privacySetting = isPrivate !== undefined ? isPrivate : (isPublic !== undefined ? !isPublic : undefined);
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const isAdmin = await Group.isAdmin(groupId, req.user.userId);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can edit group'
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (privacySetting !== undefined) updateData.isPrivate = privacySetting;

    const updatedGroup = await Group.update(groupId, updateData);

    if (!updatedGroup) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update group. No changes made or group not found.'
      });
    }

    res.json({
      success: true,
      message: 'Group updated successfully',
      data: { group: updatedGroup }
    });
  } catch (error) {
    console.error('Update group error:', error);
    next(error);
  }
};

const deleteGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const isAdmin = await Group.isAdmin(groupId, req.user.userId);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can delete the group'
      });
    }

    await Group.delete(groupId);

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const addUserToGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;
    
    const group = await Group.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const isAdmin = await Group.isAdmin(groupId, req.user.userId);
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can add users'
      });
    }

    const isMember = await Group.isMember(groupId, userId);
    
    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'User is already a member of this group'
      });
    }

    const userExists = await User.findById(userId);
    
    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await Group.addMember(groupId, userId);
    const updatedGroup = await Group.findById(groupId);

    res.json({
      success: true,
      message: 'User added to group successfully',
      data: { group: updatedGroup, user: userExists }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};