ALTER TABLE admin_notification_logs
ADD COLUMN IF NOT EXISTS target_user_ids JSONB;

ALTER TABLE admin_notification_logs
DROP CONSTRAINT IF EXISTS admin_notification_logs_target_type_check;

ALTER TABLE admin_notification_logs
ADD CONSTRAINT admin_notification_logs_target_type_check
CHECK (target_type IN ('all', 'user', 'selected'));

ALTER TABLE admin_notification_logs
DROP CONSTRAINT IF EXISTS admin_notification_logs_target_user_check;

ALTER TABLE admin_notification_logs
ADD CONSTRAINT admin_notification_logs_target_user_check
CHECK (
  (target_type = 'all' AND target_user_id IS NULL)
  OR target_type IN ('user', 'selected')
);
