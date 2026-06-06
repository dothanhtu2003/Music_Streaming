const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const { validateUuid } = require("../utils/query.utils");
const notificationService = require("./notification.service");
const { resolveArtistOwnerUserIdExpr } = require("../utils/artist-user.utils");

const getCommentsBySongId = async (songId, sort = "newest") => {
  validateUuid(songId, "songId");

  // Verify song exists
  const songCheck = await pool.query("SELECT id FROM songs WHERE id = $1 AND is_active = TRUE", [songId]);
  if (songCheck.rowCount === 0) {
    throw new AppError("Song not found", 404);
  }

  // Get comments with user and artist details
  const result = await pool.query(
    `SELECT
      c.id,
      c.content,
      c.parent_id,
      c.created_at,
      u.id AS user_id,
      u.username AS user_username,
      u.avatar_url AS user_avatar_url,
      (u.id = ar.user_id) AS is_artist
     FROM song_comments c
     JOIN users u ON u.id = c.user_id
     JOIN songs s ON s.id = c.song_id
     JOIN artists ar ON ar.id = s.artist_id
     WHERE c.song_id = $1`,
    [songId]
  );

  const rows = result.rows;
  const parents = [];
  const repliesMap = new Map();

  for (const row of rows) {
    const comment = {
      id: row.id,
      content: row.content,
      created_at: row.created_at,
      user: {
        id: row.user_id,
        username: row.user_username,
        avatar_url: row.user_avatar_url,
      },
      isArtist: Boolean(row.is_artist),
      replies: [],
    };

    if (row.parent_id === null) {
      parents.push(comment);
    } else {
      if (!repliesMap.has(row.parent_id)) {
        repliesMap.set(row.parent_id, []);
      }
      repliesMap.get(row.parent_id).push(comment);
    }
  }

  // Associate replies and sort them Oldest first
  for (const parent of parents) {
    const replies = repliesMap.get(parent.id) || [];
    replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    parent.replies = replies;
  }

  // Sort parent comments based on the sort parameter
  if (sort === "oldest") {
    parents.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else {
    parents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return parents;
};

const createComment = async ({ songId, userId, parentId = null, content }) => {
  validateUuid(songId, "songId");
  validateUuid(userId, "userId");

  const trimmedContent = (content || "").trim();
  if (!trimmedContent) {
    throw new AppError("Comment content cannot be empty", 400);
  }
  if (trimmedContent.length > 500) {
    throw new AppError("Comment content exceeds 500 characters limit", 400);
  }

  // Verify song exists
  const songCheck = await pool.query("SELECT id FROM songs WHERE id = $1 AND is_active = TRUE", [songId]);
  if (songCheck.rowCount === 0) {
    throw new AppError("Song not found", 404);
  }

  if (parentId) {
    validateUuid(parentId, "parentId");
    const parentCheck = await pool.query(
      "SELECT song_id, parent_id FROM song_comments WHERE id = $1",
      [parentId]
    );
    const parent = parentCheck.rows[0];
    if (!parent) {
      throw new AppError("Parent comment not found", 404);
    }
    if (parent.song_id !== songId) {
      throw new AppError("Parent comment must belong to the same song", 400);
    }
    if (parent.parent_id !== null) {
      throw new AppError("Only 1 level of replies is supported", 400);
    }
  }

  const result = await pool.query(
    `INSERT INTO song_comments (song_id, user_id, parent_id, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id, content, parent_id, created_at`,
    [songId, userId, parentId, trimmedContent]
  );

  const newComment = result.rows[0];

  // Retrieve creator user metadata and song owner relation
  const userResult = await pool.query(
    `SELECT u.username, u.avatar_url, (u.id = ar.user_id) AS is_artist
     FROM users u
     CROSS JOIN songs s
     JOIN artists ar ON ar.id = s.artist_id
     WHERE u.id = $1 AND s.id = $2`,
    [userId, songId]
  );

  const userMeta = userResult.rows[0] || {};

  const commentResponse = {
    id: newComment.id,
    content: newComment.content,
    parent_id: newComment.parent_id,
    created_at: newComment.created_at,
    user: {
      id: userId,
      username: userMeta.username || "Unknown",
      avatar_url: userMeta.avatar_url || null,
    },
    isArtist: Boolean(userMeta.is_artist),
    replies: [],
  };

  // Fire-and-forget: create notifications for comment/reply
  _sendCommentNotifications({
    songId,
    userId,
    parentId,
    username: userMeta.username || "Unknown",
  }).catch((err) => {
    console.error("Failed to send comment notification:", err);
  });

  return commentResponse;
};

const deleteComment = async (commentId, user) => {
  validateUuid(commentId, "commentId");

  const commentResult = await pool.query(
    `SELECT c.user_id, c.song_id, s.artist_id, ar.user_id AS artist_user_id
     FROM song_comments c
     JOIN songs s ON s.id = c.song_id
     JOIN artists ar ON ar.id = s.artist_id
     WHERE c.id = $1`,
    [commentId]
  );

  const comment = commentResult.rows[0];
  if (!comment) {
    throw new AppError("Comment not found", 404);
  }

  // Permission checks:
  // - Author of the comment
  // - Owner of the song (artist user_id)
  // - Admin role
  const isAuthor = comment.user_id === user.id;
  const isSongOwner = comment.artist_user_id === user.id;
  const isAdmin = user.role === "admin";

  if (!isAuthor && !isSongOwner && !isAdmin) {
    throw new AppError("Forbidden: You do not have permission to delete this comment", 403);
  }

  await pool.query("DELETE FROM song_comments WHERE id = $1", [commentId]);

  return { id: commentId };
};

/**
 * Internal helper: send notifications when a comment/reply is created.
 *
 * CASE 1 – Root comment on a song:
 *   Notify the song owner (unless the commenter IS the song owner).
 *
 * CASE 2 – Reply to a comment:
 *   a) Notify the parent comment author (unless the replier IS the author).
 *   b) Notify the song owner (unless the replier IS the song owner,
 *      or the song owner already received a notification in step a).
 */
const _sendCommentNotifications = async ({
  songId,
  userId,
  parentId,
  username,
}) => {
  const songResult = await pool.query(
    `SELECT s.title, ${resolveArtistOwnerUserIdExpr} AS owner_id
     FROM songs s
     JOIN artists ar ON ar.id = s.artist_id
     WHERE s.id = $1`,
    [songId]
  );

  if (songResult.rowCount === 0) return;

  const { title: songTitle, owner_id: songOwnerId } = songResult.rows[0];

  if (!songOwnerId) return;
  const notifiedUserIds = new Set();

  if (parentId) {
    // --- REPLY ---
    // Get parent comment author
    const parentResult = await pool.query(
      "SELECT user_id FROM song_comments WHERE id = $1",
      [parentId]
    );

    if (parentResult.rowCount > 0) {
      const parentAuthorId = parentResult.rows[0].user_id;

      // Notify parent comment author (if not replier)
      if (parentAuthorId !== userId) {
        await notificationService.createNotification({
          userId: parentAuthorId,
          actorId: userId,
          type: "REPLY_COMMENT",
          entityType: "song",
          entityId: songId,
          title: `${username} replied to your comment`,
          message: `${username} replied to your comment on "${songTitle}"`,
        });
        notifiedUserIds.add(parentAuthorId);
      }
    }

    if (
      songOwnerId &&
      songOwnerId !== userId &&
      !notifiedUserIds.has(songOwnerId)
    ) {
      await notificationService.createNotification({
        userId: songOwnerId,
        actorId: userId,
        type: "COMMENT_SONG",
        entityType: "song",
        entityId: songId,
        title: `${username} commented on your song`,
        message: `${username} replied to a comment on "${songTitle}"`,
      });
    }
  } else {
    // --- ROOT COMMENT ---
    if (songOwnerId && songOwnerId !== userId) {
      await notificationService.createNotification({
        userId: songOwnerId,
        actorId: userId,
        type: "COMMENT_SONG",
        entityType: "song",
        entityId: songId,
        title: `${username} commented on your song`,
        message: `${username} commented on "${songTitle}"`,
      });
    }
  }
};

module.exports = {
  getCommentsBySongId,
  createComment,
  deleteComment,
};
