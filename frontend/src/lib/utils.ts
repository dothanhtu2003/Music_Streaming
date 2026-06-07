export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getSafeRedirectPath(
  value: string | string[] | undefined,
  fallback = "/",
) {
  const redirectPath = Array.isArray(value) ? value[0] : value;

  if (!redirectPath) {
    return fallback;
  }

  if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
    return fallback;
  }

  return redirectPath;
}
