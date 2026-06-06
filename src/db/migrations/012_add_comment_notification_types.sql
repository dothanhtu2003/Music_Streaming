-- Allow comment-related notification types (required for song comment alerts)
BEGIN;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'LIKE_SONG',
      'FOLLOW_USER',
      'UPLOAD_SUCCESS',
      'NEW_SONG_FROM_FOLLOWING',
      'PLAYLIST_ADD_SONG',
      'SYSTEM',
      'COMMENT_SONG',
      'REPLY_COMMENT'
    )
  );

COMMIT;
