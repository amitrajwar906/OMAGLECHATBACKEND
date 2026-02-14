const { pool } = require('./src/config/database');

async function test() {
  try {
    const userId = 1;
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.avatar, u."isOnline", u."lastSeen", u.bio,
        CASE 
          WHEN f.id IS NOT NULL THEN 'friends'
          WHEN fr_s.id IS NOT NULL AND fr_s.status = 'pending' THEN 'request_sent'
          WHEN fr_r.id IS NOT NULL AND fr_r.status = 'pending' THEN 'request_received'
          ELSE 'none'
        END as friendstatus
       FROM users u
       LEFT JOIN friendships f ON (f."userId1" = u.id AND f."userId2" = $1) OR (f."userId2" = u.id AND f."userId1" = $1)
       LEFT JOIN friend_requests fr_s ON fr_s."senderId" = u.id AND fr_s."receiverId" = $1 AND fr_s.status = 'pending'
       LEFT JOIN friend_requests fr_r ON fr_r."senderId" = $1 AND fr_r."receiverId" = u.id AND fr_r.status = 'pending'
       WHERE u.id != $1`,
      [userId]
    );
    console.log('Raw:', result.rows);
    const mapped = result.rows.map(row => ({
      ...row,
      friendStatus: row.friendstatus
    }));
    console.log('Mapped:', mapped);
  } catch (e) {
    console.error(e.message);
  } finally {
    process.exit();
  }
}

test();
