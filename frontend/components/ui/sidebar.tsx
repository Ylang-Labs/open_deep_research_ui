"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  open: boolean;
  setOpen: (v: boolean | ((v: boolean) => boolean)) => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
  children,
  defaultOpen = false,
  style,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  style?: React.CSSProperties;
}) {
  const [open, _setOpen] = useState(defaultOpen);
  const setOpen = useCallback((value: boolean | ((v: boolean) => boolean)) => {
    _setOpen((prev) => (typeof value === "function" ? (value as (v: boolean) => boolean)(prev) : value));
  }, []);
  const toggle = useCallback(() => setOpen((v) => !v), [setOpen]);

  const ctx = useMemo(() => ({ open, setOpen, toggle }), [open, setOpen, toggle]);
  return (
    <SidebarContext.Provider value={ctx}>
      <div style={style} className="contents">
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider.");
  return ctx;
}

export function Sidebar({
  children,
  side = "right",
  className,
  width = "20rem",
}: {
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
  width?: string;
}) {
  const { open } = useSidebar();
  const translate = side === "right" ? "translate-x-full" : "-translate-x-full";
  const position = side === "right" ? "right-0" : "left-0";
  const borderSide = side === "right" ? "border-l" : "border-r";

  return (
    <aside
      className={cn(
        "fixed top-0 z-40 h-dvh bg-sidebar text-sidebar-foreground shadow-sm transition-transform",
        borderSide,
        position,
        open ? "translate-x-0" : translate,
        className
      )}
      style={{ width }}
    >
      {children}
    </aside>
  );
}

export function SidebarHeader({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky top-0 z-10 border-b border-sidebar-border bg-sidebar px-3 py-2", className)}>
      {children}
    </div>
  );
}

export function SidebarFooter({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-0 z-10 border-t border-sidebar-border bg-sidebar px-3 py-2", className)}>
      {children}
    </div>
  );
}

export function SidebarContent({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn("h-full overflow-y-auto p-3", className)}>{children}</div>;
}

export function SidebarSeparator({ className }: { className?: string }) {
  return <div className={cn("mx-3 my-2 h-px bg-sidebar-border", className)} />;
}

export function SidebarTrigger({
  className,
  children,
  "aria-label": ariaLabel = "Toggle sidebar",
  hideWhenOpen,
}: {
  className?: string;
  children?: React.ReactNode;
  "aria-label"?: string;
  hideWhenOpen?: boolean;
}) {
  const { toggle, open } = useSidebar();
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={toggle}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-sidebar-border bg-background px-2 py-1 text-sm shadow-sm hover:bg-accent",
        hideWhenOpen && open ? "hidden" : undefined,
        className
      )}
    >
      {children ?? <span>Activity</span>}
    </button>
  );
}
