export type NavItem = {
  label: string;
  href: string;
};

export const mainNav: NavItem[] = [
  { label: "Home", href: "/home" },
  { label: "Search", href: "/search" },
  { label: "Charts", href: "/charts" },
  { label: "Trending", href: "/trending" },
  { label: "Playlists", href: "/playlists" },
  { label: "Liked Songs", href: "/liked" },
  { label: "Profile", href: "/profile" },
];

export const authNav: NavItem[] = [
  { label: "Feed", href: "/feed" },
  { label: "Studio", href: "/studio" },
  { label: "Upload", href: "/upload" },
];

export const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin" },
  { label: "Songs", href: "/admin/songs" },
  { label: "Upload", href: "/admin/upload" },
  { label: "Artists", href: "/admin/artists" },
  { label: "Albums", href: "/admin/albums" },
  { label: "Genres", href: "/admin/genres" },
  { label: "Playlists", href: "/admin/playlists" },
  { label: "Users", href: "/admin/users" },
  { label: "Notifications", href: "/admin/notifications" },
];
