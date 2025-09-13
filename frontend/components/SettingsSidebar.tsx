"use client";

import React from 'react';
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@/components/ui/sidebar';
import { DeepResearchConfigPanel } from '@/components/ConfigPanel';
import { X } from 'lucide-react';

export function SettingsSidebar() {
  const { toggle } = useSidebar();
  return (
    <Sidebar side="left" width="22rem" className="border-sidebar-border/60 overflow-x-hidden">
      <SidebarHeader className="border-b border-sidebar-border/60 bg-gradient-to-b from-background to-background/80">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium text-foreground/80">Settings</div>
            <div className="text-[11px] text-foreground/55">Configure research behavior and tools</div>
          </div>
          <button
            type="button"
            aria-label="Close settings"
            onClick={toggle}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sidebar-border bg-background text-foreground/70 hover:text-foreground hover:bg-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden px-4 py-3">
        <div className="pb-4">
          <DeepResearchConfigPanel />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
