CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS admin_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_notification_logs_target_type_check
    CHECK (target_type IN ('all', 'user')),
  CONSTRAINT admin_notification_logs_sent_count_check
    CHECK (sent_count >= 0),
  CONSTRAINT admin_notification_logs_target_user_check
    CHECK (
      (target_type = 'all' AND target_user_id IS NULL)
      OR target_type = 'user'
    )
);

CREATE INDEX IF NOT EXISTS idx_admin_notification_logs_created_at
  ON admin_notification_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notification_logs_actor_id
  ON admin_notification_logs(actor_id);
