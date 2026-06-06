const { pool } = require("../db/pool");
const AppError = require("../utils/appError");
const {
  buildPagination,
  parsePagination,
  validateOptionalString,
  validateOptionalUuid,
  validateRequiredString,
  validateUuid,
} = require("../utils/query.utils");

const allowedTypes = new Set([
  "LIKE_SONG",
  "FOLLOW_USER",
  "UPLOAD_SUCCESS",
  "NEW_SONG_FROM_FOLLOWING",
  "PLAYLIST_ADD_SONG",
  "SYSTEM",
  "COMMENT_SONG",
  "REPLY_COMMENT",
]);

const allowedEntityTypes = new Set([
  "song",
  "user",
  "artist",
  "playlist",
  "system",
]);

const formatNotification = (row) => ({
  id: row.id,
  user_id: row.user_id,
  actor_id: row.actor_id,
  type: row.type,
  entity_type: row.entity_type,
  entity_id: row.entity_id,
  title: row.title,
  message: row.message,
  is_read: row.is_read,
  created_at: row.created_at,
});

const validateNotificationInput = (data = {}) => {
  validateUuid(data.userId, "userId");

  const type = validateRequiredString(data.type, "type", 60);
  if (!allowedTypes.has(type)) {
    throw new AppError("Invalid notification type", 400);
  }

  const entityType = validateOptionalString(data.entityType, "entityType", 60);
  if (entityType && !allowedEntityTypes.has(entityType)) {
    throw new AppError("Invalid notification entityType", 400);
  }

  return {
    userId: data.userId,
    actorId: validateOptionalUuid(data.actorId, "actorId"),
    type,
    entityType,
    entityId: validateOptionalUuid(data.entityId, "entityId"),
    title: validateRequiredString(data.title, "title", 200),
    message: validateOptionalString(data.message, "message", 1000),
  };
};

const validateBroadcastInput = (data = {}) => {
  validateUuid(data.actorId, "actorId");

  return {
    actorId: data.actorId,
    targetType: "all",
    targetUserId: null,
    title: validateRequiredString(data.title, "title", 150),
    message: validateRequiredString(data.message, "message", 1000),
  };
};

const validateAdminSendInput = (data = {}) => {
  validateUuid(data.actorId, "actorId");

  const targetType = validateRequiredString(data.targetType, "targetType", 20);
  if (!["all", "user", "selected"].includes(targetType)) {
    throw new AppError("targetType must be all or selected", 400);
  }

  let targetUserId = null;
  let targetUserIds = [];

  if (targetType === "user") {
    validateUuid(data.targetUserId, "targetUserId");
    targetUserId = data.targetUserId;
    targetUserIds = [data.targetUserId];
  }

  if (targetType === "selected") {
    if (!Array.isArray(data.targetUserIds)) {
      throw new AppError("targetUserIds must be an array", 400);
    }

    targetUserIds = [...new Set(data.targetUserIds.map((id) => String(id)))];

    if (targetUserIds.length === 0) {
      throw new AppError("At least one target user is required", 400);
    }

    targetUserIds.forEach((id) => validateUuid(id, "targetUserIds"));
  }

  return {
    actorId: data.actorId,
    targetType,
    targetUserId,
    targetUserIds,
    title: validateRequiredString(data.title, "title", 150),
    message: validateRequiredString(data.message, "message", 1000),
  };
};

const ensureBroadcastCooldown = async (queryRunner, actorId) => {
  const cooldownResult = await queryRunner.query(
    `SELECT id
     FROM notifications
     WHERE actor_id = $1
       AND type = 'SYSTEM'
       AND entity_type = 'system'
       AND created_at > NOW() - INTERVAL '30 seconds'
     LIMIT 1`,
    [actorId]
  );

  if (cooldownResult.rowCount > 0) {
    throw new AppError(
      "Please wait before sending another broadcast notification.",
      429
    );
  }
};

const formatAdminNotificationLog = (row) => ({
  id: row.id,
  actor_id: row.actor_id,
  actor_name: row.actor_name,
  target_type: row.target_type,
  target_user_id: row.target_user_id,
  target_user_ids: row.target_user_ids || [],
  target_user_name: row.target_user_name,
  target_user_email: row.target_user_email,
  target_label:
    row.target_type === "all"
      ? "All users"
      : row.target_type === "selected"
        ? `${Number(row.sent_count)} selected user${Number(row.sent_count) === 1 ? "" : "s"}`
        : row.target_user_name || row.target_user_email || "Specific user",
  title: row.title,
  message: row.message,
  sent_count: Number(row.sent_count),
  created_at: row.created_at,
});

const createNotification = async (data) => {
  const fields = validateNotificationInput(data);

  const result = await pool.query(
    `INSERT INTO notifications (
       user_id,
       actor_id,
       type,
       entity_type,
       entity_id,
       title,
       message
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, actor_id, type, entity_type, entity_id, title, message, is_read, created_at`,
    [
      fields.userId,
      fields.actorId,
      fields.type,
      fields.entityType,
      fields.entityId,
      fields.title,
      fields.message,
    ]
  );

  return formatNotification(result.rows[0]);
};

const getNotifications = async (userId, query = {}) => {
  validateUuid(userId, "userId");

  const { page, limit, offset } = parsePagination({
    page: query.page,
    limit: query.limit || 20,
  });

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM notifications
     WHERE user_id = $1`,
    [userId]
  );

  const result = await pool.query(
    `SELECT id, user_id, actor_id, type, entity_type, entity_id, title, message, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatNotification),
    pagination: buildPagination(totalItems, page, limit),
  };
};

const getUnreadCount = async (userId) => {
  validateUuid(userId, "userId");

  const result = await pool.query(
    `SELECT COUNT(*) AS count
     FROM notifications
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );

  return {
    count: Number(result.rows[0].count),
  };
};

const markAsRead = async (userId, notificationId) => {
  validateUuid(userId, "userId");
  validateUuid(notificationId, "notificationId");

  const result = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id, actor_id, type, entity_type, entity_id, title, message, is_read, created_at`,
    [notificationId, userId]
  );

  if (result.rowCount === 0) {
    throw new AppError("Notification not found", 404);
  }

  return formatNotification(result.rows[0]);
};

const markAllAsRead = async (userId) => {
  validateUuid(userId, "userId");

  const result = await pool.query(
    `UPDATE notifications
     SET is_read = TRUE
     WHERE user_id = $1 AND is_read = FALSE
     RETURNING id`,
    [userId]
  );

  return {
    updatedCount: result.rowCount,
  };
};

const createBroadcastNotification = async (data) => {
  return createAdminNotification(validateBroadcastInput(data));
};

const createAdminNotification = async (data) => {
  const fields = validateAdminSendInput(data);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureBroadcastCooldown(client, fields.actorId);

    let sentCount = 0;

    if (fields.targetType === "all") {
      const result = await client.query(
        `INSERT INTO notifications (
           user_id,
           actor_id,
           type,
           entity_type,
           entity_id,
           title,
           message
         )
         SELECT
           id,
           $1,
           'SYSTEM',
           'system',
           NULL,
           $2,
           $3
         FROM users
         WHERE is_banned = FALSE
         RETURNING id`,
        [fields.actorId, fields.title, fields.message]
      );

      sentCount = result.rowCount;
    } else if (fields.targetType === "user") {
      const targetResult = await client.query(
        `SELECT id, is_banned
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [fields.targetUserId]
      );

      const targetUser = targetResult.rows[0];
      if (!targetUser) {
        throw new AppError("Target user not found", 404);
      }

      if (targetUser.is_banned) {
        throw new AppError("Cannot send notification to a banned user", 400);
      }

      const result = await client.query(
        `INSERT INTO notifications (
           user_id,
           actor_id,
           type,
           entity_type,
           entity_id,
           title,
           message
         )
         VALUES ($1, $2, 'SYSTEM', 'system', NULL, $3, $4)
         RETURNING id`,
        [fields.targetUserId, fields.actorId, fields.title, fields.message]
      );

      sentCount = result.rowCount;
    } else {
      const result = await client.query(
        `INSERT INTO notifications (
           user_id,
           actor_id,
           type,
           entity_type,
           entity_id,
           title,
           message
         )
         SELECT
           id,
           $1,
           'SYSTEM',
           'system',
           NULL,
           $2,
           $3
         FROM users
         WHERE id = ANY($4::uuid[])
           AND is_banned = FALSE
         RETURNING id`,
        [fields.actorId, fields.title, fields.message, fields.targetUserIds]
      );

      sentCount = result.rowCount;
    }

    await client.query(
      `INSERT INTO admin_notification_logs (
         actor_id,
         target_type,
         target_user_id,
         target_user_ids,
         title,
         message,
         sent_count
       )
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
      [
        fields.actorId,
        fields.targetType,
        fields.targetUserId,
        JSON.stringify(fields.targetUserIds),
        fields.title,
        fields.message,
        sentCount,
      ]
    );

    await client.query("COMMIT");

    return {
      sent: sentCount,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getAdminNotificationHistory = async (query = {}) => {
  const { page, limit, offset } = parsePagination({
    page: query.page,
    limit: query.limit || 20,
  });

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM admin_notification_logs`
  );

  const result = await pool.query(
    `SELECT
       l.id,
       l.actor_id,
       COALESCE(NULLIF(actor.display_name, ''), actor.username, 'Unknown admin') AS actor_name,
       l.target_type,
       l.target_user_id,
       COALESCE(l.target_user_ids, '[]'::jsonb) AS target_user_ids,
       COALESCE(NULLIF(target.display_name, ''), target.username) AS target_user_name,
       target.email AS target_user_email,
       l.title,
       l.message,
       l.sent_count,
       l.created_at
     FROM admin_notification_logs l
     LEFT JOIN users actor ON actor.id = l.actor_id
     LEFT JOIN users target ON target.id = l.target_user_id
     ORDER BY l.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const totalItems = Number(countResult.rows[0].total);

  return {
    items: result.rows.map(formatAdminNotificationLog),
    pagination: buildPagination(totalItems, page, limit),
  };
};

module.exports = {
  createNotification,
  createBroadcastNotification,
  createAdminNotification,
  getAdminNotificationHistory,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
