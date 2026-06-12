"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AdminNotice,
  type AdminNoticeValue,
} from "@/components/admin/AdminNotice";
import { AdminTable } from "@/components/admin/AdminTable";
import { useAuth } from "@/components/auth/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  formatDate,
  getAdminUserDisplayName,
  getErrorMessage,
} from "@/lib/admin-format";
import {
  banAdminUserRequest,
  getAdminUsersRequest,
  unbanAdminUserRequest,
  updateAdminUserRoleRequest,
} from "@/lib/api";
import type { AdminUser } from "@/types/music";

type RoleFilter = "" | "user" | "admin";

export default function AdminUsersPage() {
  const { accessToken, user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [keyword, setKeyword] = useState("");
  const [role, setRole] = useState<RoleFilter>("");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AdminNoticeValue | null>(null);

  const loadUsers = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getAdminUsersRequest(
        accessToken,
        1,
        50,
        keyword.trim(),
        role,
      );
      setUsers(result.items);
    } catch (usersError) {
      setError(getErrorMessage(usersError, "Could not load users."));
    } finally {
      setLoading(false);
    }
  }, [accessToken, keyword, role]);

  useEffect(() => {
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        void loadUsers();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [loadUsers]);

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadUsers();
  };

  const updateUserInList = (updatedUser: AdminUser) => {
    setUsers((currentUsers) =>
      currentUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    );
  };

  const handleRoleChange = async (
    targetUser: AdminUser,
    nextRole: AdminUser["role"],
  ) => {
    if (targetUser.role === nextRole) {
      return;
    }

    if (!accessToken) {
      setNotice({
        type: "error",
        text: "Admin token is missing. Please login again.",
      });
      return;
    }

    const actionKey = `role-${targetUser.id}`;
    setActionId(actionKey);
    setNotice(null);

    try {
      const updatedUser = await updateAdminUserRoleRequest(
        targetUser.id,
        nextRole,
        accessToken,
      );
      updateUserInList(updatedUser);
      setNotice({ type: "success", text: "User role updated successfully." });
    } catch (roleError) {
      setNotice({
        type: "error",
        text: getErrorMessage(roleError, "Could not update user role."),
      });
    } finally {
      setActionId(null);
    }
  };

  const handleBanToggle = async (targetUser: AdminUser) => {
    if (!accessToken) {
      setNotice({
        type: "error",
        text: "Admin token is missing. Please login again.",
      });
      return;
    }

    const actionLabel = targetUser.is_banned ? "unban" : "ban";
    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} "${getAdminUserDisplayName(targetUser)}"?`,
    );

    if (!confirmed) {
      return;
    }

    const actionKey = `ban-${targetUser.id}`;
    setActionId(actionKey);
    setNotice(null);

    try {
      const updatedUser = targetUser.is_banned
        ? await unbanAdminUserRequest(targetUser.id, accessToken)
        : await banAdminUserRequest(targetUser.id, accessToken);

      updateUserInList(updatedUser);
      setNotice({
        type: "success",
        text: targetUser.is_banned
          ? "User unbanned successfully."
          : "User banned successfully.",
      });
    } catch (banError) {
      setNotice({
        type: "error",
        text: getErrorMessage(banError, "Could not update user status."),
      });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description="View users, update roles, and ban or unban accounts."
      />

      <AdminNotice notice={notice} />

      <form
        onSubmit={handleFilterSubmit}
        className="grid gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-[1fr_180px_auto]"
      >
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="Search by display name, email, or username"
          className="rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-green-500"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as RoleFilter)}
          className="rounded-lg border border-zinc-800 bg-black px-3 py-3 text-sm text-white outline-none focus:border-green-500"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-green-500 px-4 py-3 text-sm font-semibold text-green-950 transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {loading ? "Loading..." : "Filter"}
        </button>
      </form>

      <AdminTable
        headers={["User", "Email", "Role", "Status", "Joined", "Actions"]}
        loading={loading}
        error={error}
        empty={!loading && users.length === 0}
        emptyMessage="No users found."
      >
        {users.map((user) => {
          const isCurrentUser = currentUser?.id === user.id;
          const roleActionId = `role-${user.id}`;
          const banActionId = `ban-${user.id}`;

          return (
            <tr key={user.id} className="text-zinc-300">
              <td className="px-4 py-3 font-medium text-white">
                <p>{getAdminUserDisplayName(user)}</p>
                <p className="text-xs font-normal text-zinc-500">@{user.username}</p>
              </td>
              <td className="px-4 py-3">{user.email}</td>
              <td className="px-4 py-3">
                <select
                  value={user.role}
                  onChange={(event) =>
                    void handleRoleChange(
                      user,
                      event.target.value as AdminUser["role"],
                    )
                  }
                  disabled={isCurrentUser || actionId === roleActionId}
                  title={
                    isCurrentUser ? "Use another admin account to change this role" : ""
                  }
                  className="rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-white outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td className="px-4 py-3">
                {user.is_banned ? (
                  <span className="rounded-full bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300">
                    Banned
                  </span>
                ) : (
                  <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-300">
                    Active
                  </span>
                )}
              </td>
              <td className="px-4 py-3">{formatDate(user.created_at)}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => void handleBanToggle(user)}
                  disabled={isCurrentUser || actionId === banActionId}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-green-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  title={isCurrentUser ? "Admins cannot ban themselves" : ""}
                >
                  {actionId === banActionId
                    ? "Saving..."
                    : user.is_banned
                      ? "Unban"
                      : "Ban"}
                </button>
              </td>
            </tr>
          );
        })}
      </AdminTable>
    </div>
  );
}
