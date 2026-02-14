const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('./src/config/database');
const Group = require('./src/modules/groups/model');

async function testChats() {
  const userId = 1; // amitxdev
  
  const allUsersResult = await pool.query(
    'SELECT id, username, email, avatar, \"isOnline\", \"lastSeen\" FROM users WHERE id != $1 ORDER BY \"isOnline\" DESC, \"lastSeen\" DESC LIMIT 50',
    [userId]
  );
  
  const groups = await Group.findByMember(userId);

  const chats = {
    private: allUsersResult.rows.map(user => ({
      _id: user.id,
      name: user.username,
      avatar: user.avatar,
      type: 'private',
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    })),
    groups: groups.map(group => ({
      _id: group.id,
      name: group.name,
      avatar: group.avatar,
      type: 'group',
      memberCount: group.members?.length || 0,
      admin: group.admin,
      members: group.members
    }))
  };

  console.log('Private chats:', JSON.stringify(chats.private, null, 2));
  console.log('Groups:', JSON.stringify(chats.groups, null, 2));
  process.exit();
}

testChats().catch(e => { console.error(e); process.exit(1); });
