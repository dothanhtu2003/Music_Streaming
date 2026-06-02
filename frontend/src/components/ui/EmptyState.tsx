"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  href?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  href,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-8 md:p-12 max-w-xl mx-auto shadow-xl">
      {icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 text-green-500 border border-green-500/20 mb-5 shadow-lg shadow-green-500/5 animate-pulse">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-zinc-400 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && (href || onAction) && (
        <div className="mt-6">
          {href ? (
            <Link
              href={href}
              className="inline-flex items-center justify-center rounded-full bg-green-500 px-6 py-2.5 text-xs font-bold text-green-950 transition hover:bg-green-400 hover:scale-105 active:scale-95 shadow-md shadow-green-500/10 focus:outline-none"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center justify-center rounded-full bg-green-500 px-6 py-2.5 text-xs font-bold text-green-950 transition hover:bg-green-400 hover:scale-105 active:scale-95 shadow-md shadow-green-500/10 focus:outline-none"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
