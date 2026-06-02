"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

type ProtectedRouteProps = {
  children: ReactNode;
  adminOnly?: boolean;
};

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-6 py-5 text-center">
        <p className="text-sm font-medium text-white">{message}</p>
        <p className="mt-1 text-xs text-zinc-500">Please wait...</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({
  children,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { user, isAdmin, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (adminOnly && !isAdmin) {
      router.replace("/");
    }
  }, [adminOnly, isAdmin, isLoading, pathname, router, user]);

  if (isLoading) {
    return <LoadingScreen message="Checking your session" />;
  }

  if (!user) {
    return (
      <LoadingScreen
        message={adminOnly ? "Redirecting to admin login" : "Redirecting to login"}
      />
    );
  }

  if (adminOnly && !isAdmin) {
    return <LoadingScreen message="Redirecting to home" />;
  }

  return children;
}
