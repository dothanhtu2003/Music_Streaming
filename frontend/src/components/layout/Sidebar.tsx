"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { adminNav, authNav, mainNav, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

function isActivePath(pathname: string, href: string) {
  if (href === "/home") {
    return pathname === "/home";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = isActivePath(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "block rounded-lg px-3 py-2 text-sm font-medium transition",
        isActive
          ? "bg-orange-500 text-orange-950"
          : "text-zinc-300 hover:bg-zinc-900 hover:text-white",
      )}
    >
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const { isAdmin, isAuthenticated } = useAuth();
  const navItems = isAuthenticated ? [...mainNav, ...authNav] : mainNav;

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-zinc-800 bg-zinc-950 px-4 pb-28 pt-5 md:flex md:flex-col">
      <Link href="/" className="flex items-center gap-3 px-2">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-orange-500 text-lg font-black text-orange-950">
          M
        </span>
        <span>
          <span className="block text-base font-bold text-white">Music App</span>
          <span className="text-xs text-zinc-500">Discover and play tracks</span>
        </span>
      </Link>

      <nav className="mt-8 space-y-6" aria-label="Main navigation">
        <div>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Library
          </p>
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </div>

        {isAdmin && (
          <div>
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Admin
            </p>
            <div className="space-y-1">
              {adminNav.map((item) => (
                <NavLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
