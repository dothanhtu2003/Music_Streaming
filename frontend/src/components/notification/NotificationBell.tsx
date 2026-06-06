"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  BellIcon,
  CommentIcon,
  HeartIcon,
  InfoIcon,
  PlaylistIcon,
  UploadIcon,
  UserIcon,
} from "@/components/ui/Icons";
import {
  getNotificationsRequest,
  getUnreadNotificationCountRequest,
  markAllNotificationsAsReadRequest,
  markNotificationAsReadRequest,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type { NotificationType, UserNotification } from "@/types/music";

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();

  if (!Number.isFinite(diffMs)) {
    return "";
  }

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) {
    return "Vừa xong";
  }

  if (diffMs < hour) {
    return `${Math.floor(diffMs / minute)} phút trước`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)} giờ trước`;
  }

  return `${Math.floor(diffMs / day)} ngày trước`;
}

function NotificationTypeIcon({ type }: { type: NotificationType }) {
  const iconClassName = "text-[#ff5500]";

  if (type === "LIKE_SONG") {
    return <HeartIcon size={16} className={iconClassName} />;
  }

  if (type === "FOLLOW_USER") {
    return <UserIcon size={16} className={iconClassName} />;
  }

  if (type === "UPLOAD_SUCCESS") {
    return <UploadIcon size={16} className={iconClassName} />;
  }

  if (type === "PLAYLIST_ADD_SONG") {
    return <PlaylistIcon size={16} className={iconClassName} />;
  }

  if (type === "COMMENT_SONG" || type === "REPLY_COMMENT") {
    return <CommentIcon size={16} className={iconClassName} />;
  }

  return <InfoIcon size={16} className={iconClassName} />;
}

export function NotificationBell() {
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!accessToken || !isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await getUnreadNotificationCountRequest(accessToken);
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, [accessToken, isAuthenticated]);

  const fetchNotifications = useCallback(async () => {
    if (!accessToken || !isAuthenticated) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    try {
      const items = await getNotificationsRequest(accessToken, 20);
      setNotifications(items);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, isAuthenticated]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchUnreadCount();
    });
  }, [fetchUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      void fetchNotifications();
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!accessToken || actionLoading) {
      return;
    }

    setActionLoading(true);
    try {
      await markAllNotificationsAsReadRequest(accessToken);
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, is_read: true })),
      );
      setUnreadCount(0);
    } finally {
      setActionLoading(false);
    }
  };

  const handleNotificationClick = async (notification: UserNotification) => {
    if (!accessToken || actionLoading) {
      return;
    }

    setActionLoading(true);
    try {
      const wasUnread = !notification.is_read;
      const updatedNotification = await markNotificationAsReadRequest(
        notification.id,
        accessToken,
      );

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? updatedNotification : item,
        ),
      );

      if (wasUnread) {
        setUnreadCount((count) => Math.max(count - 1, 0));
      }

      if (notification.entity_type === "song" && notification.entity_id) {
        setOpen(false);
        const suffix =
          notification.type === "COMMENT_SONG" ||
          notification.type === "REPLY_COMMENT"
            ? "#comments"
            : "";
        router.push(`/songs/${notification.entity_id}${suffix}`);
      } else if (notification.entity_type === "user" && notification.entity_id) {
        setOpen(false);
        router.push(`/users/${notification.entity_id}`);
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-[#ff5500] px-1 text-center text-[10px] font-bold leading-4 text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-white">Thông báo</p>
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={actionLoading || unreadCount === 0}
              className="text-xs font-medium text-[#ff5500] transition hover:text-orange-300 disabled:cursor-not-allowed disabled:text-zinc-600"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-[24rem] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
                Đang tải thông báo...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-zinc-500">
                Chưa có thông báo
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleNotificationClick(notification)}
                  className={cn(
                    "flex w-full gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-zinc-900",
                    !notification.is_read && "bg-white/[0.04]",
                  )}
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-orange-500/10">
                    <NotificationTypeIcon type={notification.type} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
                        {notification.title}
                      </span>
                      {!notification.is_read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#ff5500]" />
                      )}
                    </span>
                    {notification.message && (
                      <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-zinc-400">
                        {notification.message}
                      </span>
                    )}
                    <span className="mt-1 block text-[11px] text-zinc-600">
                      {formatRelativeTime(notification.created_at)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
