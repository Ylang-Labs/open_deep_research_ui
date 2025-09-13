'use client';

import React, { useMemo, useState } from 'react';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar } from '@/components/ui/sidebar';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useThread } from '@assistant-ui/react';
import type { ThreadMessage } from '@assistant-ui/react';
import { cn } from '@/lib/utils';
import {
  Bot,
  User2,
  Wrench,
  Loader2,
  Link as LinkIcon,
  FileText,
  MessagesSquare,
} from 'lucide-react';
import { X } from 'lucide-react';

type ActivityItem = {
  id: string;
  kind: 'user' | 'assistant' | 'tool' | 'reasoning' | 'source';
  title: string;
  description?: string;
  url?: string;
};

// Derive message part types from ThreadMessage to avoid version-specific imports
type AssistantPart = Extract<ThreadMessage, { role: 'assistant' }> extends {
  content: readonly (infer P)[];
}
  ? P
  : never;
type UserPart = Extract<ThreadMessage, { role: 'user' }> extends {
  content: readonly (infer P)[];
}
  ? P
  : never;

function messageText(parts: readonly (AssistantPart | UserPart)[]) {
  const texts: string[] = [];
  for (const p of parts) {
    if (p.type === 'text' || p.type === 'reasoning') texts.push(p.text);
  }
  return texts.join(' ').trim();
}

function extractUrlsFromString(text: string): string[] {
  const urls = new Set<string>();
  const urlRegex = /https?:\/\/[\w.-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=.]+)?/gi;
  for (const match of text.matchAll(urlRegex)) {
    try {
      const u = new URL(match[0]);
      // Normalize by stripping trailing punctuation commonly found in prose
      const href = u.href.replace(/[),.;:]+$/g, '');
      urls.add(href);
    } catch {
      // ignore invalid URLs
    }
  }
  return Array.from(urls.values());
}

function collectUrlsFromUnknown(value: unknown, acc: Set<string>) {
  if (!value) return;
  if (typeof value === 'string') {
    for (const u of extractUrlsFromString(value)) acc.add(u);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectUrlsFromUnknown(v, acc);
    return;
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectUrlsFromUnknown(v, acc);
    }
  }
}

function findPhaseWindow(messages: readonly ThreadMessage[]) {
  // Identify the index range strictly between "Clarify with user" and "Final Report" (case-insensitive)
  let start: number | null = null;
  let end: number | null = null;

  const includesCi = (hay: string, needle: string) =>
    hay.toLowerCase().includes(needle.toLowerCase());

  messages.forEach((m, i) => {
    if (m.role !== 'assistant') return;
    const text = messageText(
      m.content as readonly (AssistantPart | UserPart)[]
    );
    if (start === null && includesCi(text, 'clarify with user')) start = i;
    if (end === null && includesCi(text, 'final report')) end = i;
  });

  // Ensure we only use a coherent forward range if both are present and ordered
  if (start !== null && end !== null && start < end) {
    return { start, end };
  }
  // If only start is found, take everything after start
  if (start !== null && end === null) return { start, end: messages.length };
  // If only end is found, take everything before end
  if (start === null && end !== null) return { start: -1, end };
  // Default: no filtering
  return { start: -1, end: messages.length };
}

function extractActivity(messages: readonly ThreadMessage[]): {
  activity: ActivityItem[];
  sources: { id: string; url: string; title?: string }[];
} {
  const act: ActivityItem[] = [];
  const sourceMap = new Map<
    string,
    { id: string; url: string; title?: string }
  >();

  // Restrict activity to the phase window
  const window = findPhaseWindow(messages);
  const inWindow = (idx: number) => idx > window.start && idx < window.end;

  messages.forEach((m, msgIdx) => {
    // Collect sources globally from any part of the conversation
    const collectSource = (url: string, title?: string) => {
      const key = title ? `${url}::${title}` : url;
      if (!sourceMap.has(key)) sourceMap.set(key, { id: key, url, title });
    };

    // Only push to activity if within window
    const shouldRecordActivity = inWindow(msgIdx);

    if (m.role === 'user') {
      const text = messageText(
        m.content as readonly (AssistantPart | UserPart)[]
      );
      if (text && shouldRecordActivity) {
        act.push({ id: m.id, kind: 'user', title: text });
      }
      return;
    }

    // assistant
    let idx = 0;
    for (const part of m.content as readonly AssistantPart[]) {
      const partId = `${m.id}:${idx++}`;
      if (part.type === 'tool-call') {
        // Activity: show tool calls within window
        if (shouldRecordActivity) {
          const args = (part.argsText ?? '').slice(0, 160);
          act.push({
            id: part.toolCallId || partId,
            kind: 'tool',
            title: part.toolName,
            description: args,
          });
        }
      } else if (part.type === 'reasoning') {
        // Activity: show reasoning within window
        const t = (part.text ?? 'Thinking...').trim();
        if (t && shouldRecordActivity)
          act.push({
            id: partId,
            kind: 'reasoning',
            title: 'Thinking',
            description: t,
          });
        // Sources: also scan for URLs present in reasoning text
        if (t) {
          const urls = extractUrlsFromString(t);
          urls.forEach((u) => collectSource(u));
        }
      } else if (part.type === 'text') {
        const t = (part.text ?? '').trim();
        if (t && shouldRecordActivity)
          act.push({ id: partId, kind: 'assistant', title: t });
        // Sources: scan text for any URLs that might be references
        if (t) {
          const urls = extractUrlsFromString(t);
          urls.forEach((u) => collectSource(u));
        }
      } else if (part.type === 'source') {
        // Explicit sources
        const key = part.id || part.url;
        if (!sourceMap.has(key))
          sourceMap.set(key, { id: key, url: part.url, title: part.title });
        if (shouldRecordActivity)
          act.push({
            id: partId,
            kind: 'source',
            title: part.title || part.url,
            url: part.url,
          });
      } else if ((part as { type?: string }).type === 'tool-result') {
        // Attempt to collect URLs from tool results (sub-agent searches)
        const bag = new Set<string>();
        const pr = part as {
          text?: unknown;
          result?: unknown;
          content?: unknown;
        };
        if (typeof pr.text === 'string') collectUrlsFromUnknown(pr.text, bag);
        if (pr.result !== undefined) collectUrlsFromUnknown(pr.result, bag);
        if (pr.content !== undefined) collectUrlsFromUnknown(pr.content, bag);
        bag.forEach((u) => collectSource(u));
      }
    }
  });

  return { activity: act, sources: Array.from(sourceMap.values()) };
}

function ActivityIcon({ kind }: { kind: ActivityItem['kind'] }) {
  const common = 'h-3.5 w-3.5';
  switch (kind) {
    case 'user':
      return <User2 className={common} />;
    case 'assistant':
      return <Bot className={common} />;
    case 'tool':
      return <Wrench className={common} />;
    case 'source':
      return <LinkIcon className={common} />;
    case 'reasoning':
      return <Loader2 className={cn(common, 'animate-spin')} />;
  }
}

function getActivityIconStyles() {
  const baseClasses =
    'inline-flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-200';

  return cn(
    baseClasses,
    'border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
  );
}

function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <div className="space-y-4 overflow-x-hidden">
      {items.map((it, i) => (
        <div key={it.id} className="relative flex items-start pl-11">
          {/* Enhanced timeline connector */}
          {i !== items.length - 1 && (
            <div className="absolute left-[13.5px] top-8 h-[calc(100%_-_1.25rem)] w-px bg-gradient-to-b from-sidebar-border via-sidebar-border/60 to-sidebar-border/30" />
          )}

          {/* Enhanced activity icon with better visual hierarchy */}
          <span
            className={cn(
              'absolute left-0 top-0.5',
              getActivityIconStyles()
            )}
          >
            <ActivityIcon kind={it.kind} />
          </span>

          <div className="flex-1 min-w-0">
            {/* Enhanced title typography */}
            <div className="font-medium leading-relaxed text-sm text-foreground/90 break-words mb-1">
              {it.title}
            </div>

            {/* Enhanced description with better contrast and spacing */}
            {it.description && (
              <div className="text-foreground/60 line-clamp-3 text-xs leading-relaxed break-words">
                {it.description}
              </div>
            )}
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div
          className={cn(
            'flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center',
            'border-sidebar-border/50 bg-gradient-to-br from-background/40 to-background/20'
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-accent/40">
            <MessagesSquare className="h-5 w-5 text-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground/70">
              No activity yet
            </p>
            <p className="text-xs text-foreground/50 leading-relaxed">
              Research activities and reasoning steps will appear here as the AI
              works
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SourcesList({
  items,
}: {
  items: { id: string; url: string; title?: string }[];
}) {
  return (
    <div className="space-y-3 overflow-x-hidden">
      {items.map((s) => {
        const domain = (() => {
          try {
            return new URL(s.url).hostname.replace(/^www\./, '');
          } catch {
            return s.url;
          }
        })();

        // Determine domain (reserved for future visual tweaks)

        return (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'group relative block overflow-hidden rounded-xl border transition-all duration-200 ease-out',
              'border-sidebar-border/60 bg-gradient-to-br from-background/80 to-background/40',
              'hover:border-sidebar-border hover:bg-gradient-to-br hover:from-background hover:to-background/60',
              'hover:shadow-sm hover:shadow-black/5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
          >
            {/* Subtle accent line for visual interest */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sidebar-border/40 to-transparent" />

            <div className="relative p-4">
              {/* Header with enhanced domain styling */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-200',
                    'bg-sidebar-accent/60 group-hover:bg-sidebar-accent'
                  )}
                >
                  <LinkIcon className="h-3 w-3" />
                </div>
                <span
                  className={cn(
                    'text-xs font-medium tracking-wide transition-colors duration-200',
                    'text-foreground/60 group-hover:text-foreground/80'
                  )}
                >
                  {domain}
                </span>
              </div>

              {/* Title with improved typography */}
              <div
                className={cn(
                  'font-medium leading-relaxed transition-colors duration-200',
                  'text-sm text-foreground/90 group-hover:text-foreground',
                  'line-clamp-2 break-words'
                )}
              >
                {s.title ?? s.url}
              </div>

              {/* Subtle visual indicator for external link */}
              <div className="absolute bottom-3 right-3 opacity-0 transition-opacity duration-200 group-hover:opacity-40">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </div>
            </div>
          </a>
        );
      })}

      {items.length === 0 && (
        <div
          className={cn(
            'flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center',
            'border-sidebar-border/50 bg-gradient-to-br from-background/40 to-background/20'
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-accent/40">
            <FileText className="h-5 w-5 text-foreground/50" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground/70">
              No sources yet
            </p>
            <p className="text-xs text-foreground/50 leading-relaxed">
              Research citations and references will appear here as the AI
              discovers relevant sources
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  const { toggle } = useSidebar();
  const thread = useThread({ optional: true });
  const messages = thread?.messages;

  const { activity, sources } = useMemo(
    () => extractActivity(messages ?? []),
    [messages]
  );
  const [tab, setTab] = useState<'activity' | 'sources'>('activity');

  return (
    <Sidebar
      side="right"
      width="22rem"
      className="border-l border-sidebar-border/60 overflow-x-hidden"
    >
      <SidebarHeader className="border-b border-sidebar-border/60 bg-gradient-to-b from-background to-background/80">
        <div className="flex items-center justify-between p-4">
          <SegmentedControl
            value={tab}
            onValueChange={(v) => setTab(v as 'activity' | 'sources')}
            segments={[
              { value: 'activity', label: 'Activity' },
              { value: 'sources', label: 'Sources', badge: sources.length },
            ]}
          />
          <button
            type="button"
            aria-label="Close research sidebar"
            onClick={toggle}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-sidebar-border bg-background text-foreground/70 hover:text-foreground hover:bg-accent ml-2"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden px-4 py-2">
        {tab === 'activity' && <ActivityList items={activity} />}
        {tab === 'sources' && <SourcesList items={sources} />}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 bg-gradient-to-t from-background to-background/80">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500/80 animate-pulse" />
            <span className="text-xs font-medium text-foreground/70">
              Deep Research
            </span>
          </div>
          <div className="text-xs text-foreground/50 font-mono">
            {activity.length} events • {sources.length} sources
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
