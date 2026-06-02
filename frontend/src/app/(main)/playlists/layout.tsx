import type { ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

type PlaylistsLayoutProps = {
  children: ReactNode;
};

export default function PlaylistsLayout({ children }: PlaylistsLayoutProps) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
