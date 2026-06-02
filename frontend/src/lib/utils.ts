export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getSafeRedirectPath(value: string | string[] | undefined) {
  const redirectPath = Array.isArray(value) ? value[0] : value;

  if (!redirectPath) {
    return "/";
  }

  if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
    return "/";
  }

  return redirectPath;
}
