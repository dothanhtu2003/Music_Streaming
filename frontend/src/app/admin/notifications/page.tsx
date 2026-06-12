"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  formatDate,
  getAdminUserDisplayName,
  getAdminUserInitials,
  getErrorMessage,
} from "@/lib/admin-format";
import {
  getAdminNotificationHistoryRequest,
  getAdminUserOptionsRequest,
  sendAdminNotificationRequest,
} from "@/lib/api";
import type {
  AdminNotificationLog,
  AdminNotificationTargetType,
  AdminUserOption,
} from "@/types/music";

type FormState = {
  targetType: AdminNotificationTargetType;
  selectedUserIds: string[];
  title: string;
  message: string;
};

const emptyForm: FormState = {
  targetType: "all",
  selectedUserIds: [],
  title: "",
  message: "",
};

function getTargetLabel(log: AdminNotificationLog) {
  if (log.target_label) {
    return log.target_label;
  }

  if (log.target_type === "all") {
    return "All users";
  }

  if (log.target_type === "selected") {
    return `${log.sent_count} selected user${log.sent_count === 1 ? "" : "s"}`;
  }

  return log.target_user_name || log.target_user_email || "Specific user";
}

export default function AdminNotificationsPage() {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [userSearch, setUserSearch] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [users, setUsers] = useState<AdminUserOption[]>([]);
  const [history, setHistory] = useState<AdminNotificationLog[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmedTitle = form.title.trim();
  const trimmedMessage = form.message.trim();
  const canSubmit =
    Boolean(accessToken) &&
    trimmedTitle.length > 0 &&
    trimmedMessage.length > 0 &&
    trimmedTitle.length <= 150 &&
    trimmedMessage.length <= 1000 &&
    (form.targetType === "all" || form.selectedUserIds.length > 0) &&
    !sending &&
    cooldown === 0;

  const selectedUsers = useMemo(() => {
    const selectedIds = new Set(form.selectedUserIds);
    return users.filter((user) => selectedIds.has(user.id));
  }, [form.selectedUserIds, users]);

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();
    const matchedUsers = keyword
      ? users.filter((user) => {
          const displayName = getAdminUserDisplayName(user).toLowerCase();

          return (
            displayName.includes(keyword) ||
            user.username.toLowerCase().includes(keyword) ||
            user.email.toLowerCase().includes(keyword)
          );
        })
      : users;

    return {
      total: matchedUsers.length,
      items: matchedUsers.slice(0, 20),
    };
  }, [userSearch, users]);

  // Selected users preview was removed as it is now shown directly via chips

  const loadUsers = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setUsersLoading(true);

    try {
      const items = await getAdminUserOptionsRequest(accessToken);
      setUsers(items);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [accessToken]);

  const loadHistory = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setHistoryLoading(true);

    try {
      const result = await getAdminNotificationHistoryRequest(accessToken, 1, 20);
      setHistory(result.items);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (!isMounted) {
        return;
      }

      void loadUsers();
      void loadHistory();
    });

    return () => {
      isMounted = false;
    };
  }, [loadHistory, loadUsers]);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [cooldown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const updateForm = (
    key: Exclude<keyof FormState, "selectedUserIds">,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "targetType" && value === "all" ? { selectedUserIds: [] } : {}),
    }));
  };

  const toggleSelectedUser = (userId: string) => {
    setForm((current) => {
      const selectedIds = new Set(current.selectedUserIds);

      if (selectedIds.has(userId)) {
        selectedIds.delete(userId);
      } else {
        selectedIds.add(userId);
      }

      return {
        ...current,
        selectedUserIds: [...selectedIds],
      };
    });
  };

  const clearSelectedUsers = () => {
    setForm((current) => ({ ...current, selectedUserIds: [] }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken || !canSubmit) {
      return;
    }

    setSending(true);
    setSuccess(null);
    setError(null);

    try {
      const result = await sendAdminNotificationRequest(
        {
          targetType: form.targetType,
          targetUserIds:
            form.targetType === "selected" ? form.selectedUserIds : [],
          title: trimmedTitle,
          message: trimmedMessage,
        },
        accessToken,
      );

      setSuccess(`Sent to ${result.sent} user(s)`);
      setForm(emptyForm);
      setUserSearch("");
      setIsDropdownOpen(false);
      setCooldown(8);
      await loadHistory();
    } catch (sendError) {
      setError(
        getErrorMessage(sendError, "Could not send notification."),
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-zinc-900 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">
          Admin Portal
        </p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white md:text-3xl">
          Notifications
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Send system notifications and review recently sent admin messages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Composer Form */}
        <section className="lg:col-span-2 rounded-xl border border-white/10 bg-zinc-950 p-5 shadow-lg">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Send notification
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              SYSTEM notifications will appear in the recipient notification bell.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Target type
              </span>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-900/40 p-1 border border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => updateForm("targetType", "all")}
                  className={`flex items-center justify-center gap-2 rounded-md py-2 px-3 text-sm font-semibold transition-all cursor-pointer ${
                    form.targetType === "all"
                      ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/10"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-850/50"
                  }`}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  All Users
                </button>
                <button
                  type="button"
                  onClick={() => updateForm("targetType", "selected")}
                  className={`flex items-center justify-center gap-2 rounded-md py-2 px-3 text-sm font-semibold transition-all cursor-pointer ${
                    form.targetType === "selected"
                      ? "bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/10"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-850/50"
                  }`}
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Selected Users ({selectedUsers.length})
                </button>
              </div>
            </div>

            {form.targetType === "selected" && (
              <div className="space-y-2" ref={containerRef}>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Select users
                </span>
                <div className="relative">
                  {/* Search input container with selected badges */}
                  <div className="flex flex-wrap gap-2 min-h-[44px] w-full rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 transition-all focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/30">
                    {/* Selected User Chips */}
                    {selectedUsers.map((user) => (
                      <span
                        key={user.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800/80 py-1 pl-1.5 pr-1.5 text-xs text-white"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase">
                          {getAdminUserInitials(user)}
                        </span>
                        <span className="max-w-[120px] truncate">
                          {getAdminUserDisplayName(user)}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleSelectedUser(user.id)}
                          className="rounded p-0.5 text-zinc-400 hover:bg-zinc-850 hover:text-white transition-colors cursor-pointer"
                        >
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </span>
                    ))}

                    {/* Input field */}
                    <input
                      value={userSearch}
                      onChange={(event) => {
                        setUserSearch(event.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      className="flex-1 min-w-[150px] bg-transparent text-sm text-white outline-none placeholder:text-zinc-650 py-0.5 px-1"
                      placeholder={selectedUsers.length === 0 ? "Search users by name or email..." : "Search to add more..."}
                    />

                    {/* Clear selection button */}
                    {selectedUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={clearSelectedUsers}
                        className="px-2 py-0.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors border-l border-zinc-800 cursor-pointer"
                      >
                        Clear all
                      </button>
                    )}
                  </div>

                  {/* Dropdown Options */}
                  {isDropdownOpen && (
                    <div className="absolute z-10 left-0 right-0 mt-1.5 max-h-72 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl divide-y divide-zinc-900">
                      {usersLoading ? (
                        <div className="px-4 py-6 text-center text-sm text-zinc-500">
                          Loading users...
                        </div>
                      ) : filteredUsers.total === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-zinc-500">
                          No users found
                        </div>
                      ) : (
                        <>
                          {/* Dropdown Header with Bulk Selection */}
                          <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/30 text-[11px] text-zinc-500 font-medium">
                            <span>Showing {filteredUsers.items.length} of {filteredUsers.total} matches</span>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const currentSelected = new Set(form.selectedUserIds);
                                  filteredUsers.items.forEach((u) => currentSelected.add(u.id));
                                  setForm((curr) => ({ ...curr, selectedUserIds: Array.from(currentSelected) }));
                                }}
                                className="hover:text-emerald-400 transition-colors cursor-pointer"
                              >
                                Select current page
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentSelected = new Set(form.selectedUserIds);
                                  filteredUsers.items.forEach((u) => currentSelected.delete(u.id));
                                  setForm((curr) => ({ ...curr, selectedUserIds: Array.from(currentSelected) }));
                                }}
                                className="hover:text-rose-400 transition-colors cursor-pointer"
                              >
                                Deselect current page
                              </button>
                            </div>
                          </div>

                          <div className="divide-y divide-zinc-900/50">
                            {filteredUsers.items.map((user) => {
                              const isChecked = form.selectedUserIds.includes(user.id);

                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => toggleSelectedUser(user.id)}
                                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-zinc-900/60 cursor-pointer ${
                                    isChecked ? "bg-emerald-500/5 hover:bg-emerald-500/10" : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {/* User Initials Avatar */}
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-400 uppercase">
                                      {getAdminUserInitials(user)}
                                    </span>
                                    <div className="min-w-0">
                                      <span className="block truncate text-sm font-semibold text-white">
                                        {getAdminUserDisplayName(user)}
                                      </span>
                                      <span className="block truncate text-xs text-zinc-500">
                                        {user.email}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Selection Checkmark Circle */}
                                  <div
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                                      isChecked
                                        ? "border-emerald-500 bg-emerald-500 text-zinc-950"
                                        : "border-zinc-700 bg-transparent text-transparent hover:border-zinc-500"
                                    }`}
                                  >
                                    <svg
                                      className="h-3 w-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Status & Helper Info */}
                <div className="flex items-center justify-between text-xs text-zinc-500 px-1 pt-0.5">
                  <span className="font-medium text-zinc-400">
                    {selectedUsers.length} user{selectedUsers.length === 1 ? "" : "s"} selected
                  </span>
                  {filteredUsers.total > 20 && (
                    <span>Showing top 20 matches. Type to narrow.</span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Notification title
                </span>
                <input
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  maxLength={150}
                  className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                  placeholder="e.g. Scheduled System Maintenance"
                />
                <span className="block text-right text-[11px] text-zinc-600">
                  {trimmedTitle.length}/150
                </span>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Notification message
                </span>
                <textarea
                  value={form.message}
                  onChange={(event) => updateForm("message", event.target.value)}
                  maxLength={1000}
                  rows={4}
                  className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                  placeholder="Type details of the notification broadcast here..."
                />
                <span className="block text-right text-[11px] text-zinc-600">
                  {trimmedMessage.length}/1000
                </span>
              </label>
            </div>

            {success && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                {success}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-zinc-900/80 pt-4">
              <p className="text-xs text-zinc-600">
                {cooldown > 0
                  ? `Please wait ${cooldown}s before sending another notification.`
                  : "Backend cooldown also prevents rapid repeat sends."}
              </p>

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-500 px-5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 cursor-pointer"
              >
                {sending ? "Sending..." : "Send notification"}
              </button>
            </div>
          </form>
        </section>

        {/* Live Notification Preview */}
        <section className="rounded-xl border border-white/10 bg-zinc-950 p-5 shadow-lg flex flex-col h-full min-h-[380px] justify-between">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                Live Preview
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                How this notification appears in the user&apos;s notification bell.
              </p>
            </div>

            <div className="flex flex-col justify-center items-center py-8 px-4 bg-zinc-900/10 rounded-lg border border-zinc-900/60 min-h-[220px]">
              {/* Mockup Notification bell item */}
              <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-xl relative overflow-hidden transition-all duration-300 hover:border-zinc-700">
                {/* Glowing status line */}
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />

                <div className="flex gap-3">
                  {/* Avatar Icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 relative">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-75" style={{ animationDuration: '3s' }} />
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        System Broadcast
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        Just now
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-white truncate">
                      {trimmedTitle || "Untitled Notification"}
                    </h4>

                    <p className="text-xs text-zinc-400 break-words leading-relaxed whitespace-pre-wrap">
                      {trimmedMessage || "Type a message in the form to preview..."}
                    </p>

                    <div className="pt-2 flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-900 mt-2">
                      <span className="truncate">
                        Target: {form.targetType === 'all' ? 'All users' : `${selectedUsers.length} user${selectedUsers.length === 1 ? '' : 's'}`}
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Unread
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-900 text-[11px] text-zinc-550 space-y-1">
            <p>💡 Previews update in real-time as you type.</p>
            <p>🔒 Security checks ensure only verified admins can broadcast.</p>
          </div>
        </section>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Sent history
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Showing the latest 20 admin notification sends.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={historyLoading}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {historyLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-900 bg-zinc-950 shadow-inner">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-900 text-left text-sm">
              <thead className="bg-zinc-900/40 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-4 font-bold">Title</th>
                  <th className="px-5 py-4 font-bold">Message</th>
                  <th className="px-5 py-4 font-bold">Target</th>
                  <th className="px-5 py-4 font-bold">Sent count</th>
                  <th className="px-5 py-4 font-bold">Sent by</th>
                  <th className="px-5 py-4 text-right font-bold">Created at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/70">
                {historyLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 w-32 rounded bg-zinc-900" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-56 rounded bg-zinc-900" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 rounded bg-zinc-900" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-12 rounded bg-zinc-900" /></td>
                      <td className="px-5 py-4"><div className="h-4 w-24 rounded bg-zinc-900" /></td>
                      <td className="px-5 py-4"><div className="ml-auto h-4 w-24 rounded bg-zinc-900" /></td>
                    </tr>
                  ))
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-zinc-500">
                      No sent notifications yet.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item.id} className="text-zinc-300 transition-colors hover:bg-zinc-900/30">
                      <td className="max-w-48 px-5 py-4 font-semibold text-white">
                        <span className="block truncate">{item.title}</span>
                      </td>
                      <td className="max-w-80 px-5 py-4 text-zinc-400">
                        <span className="block truncate">{item.message}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          item.target_type === "all"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                            : "border-zinc-800 bg-zinc-900 text-zinc-350"
                        }`}>
                          {item.target_type === "all" && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                          {getTargetLabel(item)}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-zinc-200">
                        {item.sent_count}
                      </td>
                      <td className="px-5 py-4 text-zinc-400">
                        {item.actor_name || "Unknown admin"}
                      </td>
                      <td className="px-5 py-4 text-right text-xs text-zinc-500">
                        {formatDate(item.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
