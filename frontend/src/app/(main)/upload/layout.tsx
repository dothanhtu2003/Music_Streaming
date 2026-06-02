import type { ReactNode } from "react";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

type UploadLayoutProps = {
  children: ReactNode;
};

export default function UploadLayout({ children }: UploadLayoutProps) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
