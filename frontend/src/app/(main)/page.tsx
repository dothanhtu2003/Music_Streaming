"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import AboutPage from "@/app/(main)/about/page";

function EntrySkeleton() {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="h-10 w-40 animate-pulse rounded bg-zinc-900" />
    </div>
  );
}

export default function EntryPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/home");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || isAuthenticated) {
    return <EntrySkeleton />;
  }

  return <AboutPage />;
}
