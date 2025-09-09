"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type Segment = {
  value: string;
  label: React.ReactNode;
  badge?: React.ReactNode;
};

export function SegmentedControl({
  segments,
  value,
  onValueChange,
  className,
}: {
  segments: Segment[];
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-sidebar-border bg-background p-1 text-sm",
        className
      )}
      role="tablist"
    >
      {segments.map((s) => {
        const active = value === s.value;
        return (
          <button
            key={s.value}
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(s.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-foreground/80 hover:bg-accent"
            )}
          >
            <span>{s.label}</span>
            {s.badge ? (
              <span
                className={cn(
                  "rounded-full px-2 text-xs",
                  active ? "bg-background/20" : "bg-muted"
                )}
              >
                {s.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

