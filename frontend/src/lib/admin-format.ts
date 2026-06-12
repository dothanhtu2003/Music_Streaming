export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
  }).format(date);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type AdminUserNameSource = {
  displayName?: string | null;
  display_name?: string | null;
  username?: string | null;
  email?: string | null;
};

export function getAdminUserDisplayName(user?: AdminUserNameSource | null) {
  return (
    user?.displayName?.trim() ||
    user?.display_name?.trim() ||
    user?.username?.trim() ||
    user?.email?.trim() ||
    "Unknown user"
  );
}

export function getAdminUserInitials(user?: AdminUserNameSource | null) {
  const name = getAdminUserDisplayName(user);
  return name.slice(0, 2).toUpperCase();
}
