import type { ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

type LikedLayoutProps = {
  children: ReactNode;
};

export default function LikedLayout({ children }: LikedLayoutProps) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
