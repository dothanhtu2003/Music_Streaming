"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import type { UserNotification } from "@/types/music";

export const NOTIFICATION_NEW_EVENT = "notification:new";

export function NotificationStreamProvider() {
  const { accessToken, isAuthenticated } = useAuth();

  const handleNotification = useCallback((notification: UserNotification) => {
    window.dispatchEvent(
      new CustomEvent<UserNotification>(NOTIFICATION_NEW_EVENT, {
        detail: notification,
      }),
    );
  }, []);

  useNotificationStream({
    accessToken,
    enabled: isAuthenticated,
    onNotification: handleNotification,
  });

  return null;
}
