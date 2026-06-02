import type { ReactNode } from "react";

type LikedLayoutProps = {
  children: ReactNode;
};

export default function LikedLayout({ children }: LikedLayoutProps) {
  return children;
}
