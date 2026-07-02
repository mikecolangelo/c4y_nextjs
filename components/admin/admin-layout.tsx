"use client";

import { AdminHeader } from "./admin-header";
import { commonClasses } from "@/lib/design-system";
import { PermissionsProvider } from "@/lib/permissions-context";
import { ReactNode } from "react";

interface AdminLayoutProps {
  title: string;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  showFilterAction?: boolean;
  onFilterActionClick?: () => void;
  children: ReactNode;
}

/**
 * Subtle "graph paper" texture shared across every admin screen.
 *
 * It is applied to the full-size scroll container (not the centered <main>)
 * so it fills the entire viewport width and height — including the side
 * margins outside the max-width column and any empty space below short
 * content. `backgroundAttachment: local` keeps the texture scrolling with
 * the content, matching the previous look.
 */
const surfaceTexture: React.CSSProperties = {
  backgroundImage: `
    repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, transparent 1px, transparent 2px, rgba(0,0,0,0.03) 3px),
    repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0px, transparent 1px, transparent 2px, rgba(0,0,0,0.03) 3px),
    radial-gradient(circle at 2px 2px, rgba(255,255,255,0.08) 1px, transparent 0),
    radial-gradient(circle at 6px 6px, rgba(0,0,0,0.05) 1px, transparent 0)
  `,
  backgroundSize: "100% 4px, 4px 100%, 8px 8px, 12px 12px",
  backgroundPosition: "0 0, 0 0, 0 0, 4px 4px",
  backgroundAttachment: "local",
};

export function AdminLayout({
  title,
  leftActions,
  rightActions,
  showFilterAction = false,
  onFilterActionClick,
  children,
}: AdminLayoutProps) {
  return (
    <PermissionsProvider>
      <div className="flex h-screen flex-col min-w-0 overflow-hidden">
        <AdminHeader
          title={title}
          leftActions={leftActions}
          rightActions={rightActions}
          showFilterAction={showFilterAction}
          onFilterActionClick={onFilterActionClick}
        />
        <div
          className="relative flex-1 min-h-0 overflow-y-auto scroll-smooth"
          style={surfaceTexture}
        >
          <main className={commonClasses.mainContainer}>{children}</main>
        </div>
      </div>
    </PermissionsProvider>
  );
}
