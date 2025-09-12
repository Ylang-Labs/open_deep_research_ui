'use client';

import React, { useMemo, useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useThread } from '@assistant-ui/react';
import type {
  ThreadAssistantMessagePart,
  ThreadMessage,
  ThreadUserMessagePart,
} from '@assistant-ui/react';
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

type ActivityItem = {
  id: string;
  kind: 'user' | 'assistant' | 'tool' | 'reasoning' | 'source';
  title: string;
  description?: string;
  url?: string;
};

function messageText(
  parts: readonly (ThreadAssistantMessagePart | ThreadUserMessagePart)[]
) {
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
      let href = u.href.replace(/[),.;:]+$/g, '');
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
      m.content as readonly (
        | ThreadAssistantMessagePart
        | ThreadUserMessagePart
      )[]
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
        m.content as readonly (
          | ThreadAssistantMessagePart
          | ThreadUserMessagePart
        )[]
      );
      if (text && shouldRecordActivity) {
        act.push({ id: m.id, kind: 'user', title: text });
      }
      return;
    }

    // assistant
    let idx = 0;
    for (const part of m.content as readonly ThreadAssistantMessagePart[]) {
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
      } else if ((part as any).type === 'tool-result') {
        // Attempt to collect URLs from tool results (sub-agent searches)
        const bag = new Set<string>();
        const pr = part as any;
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

function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.id} className="relative flex items-start pl-10">
          {i !== items.length - 1 && (
            <span className="absolute left-[13px] top-6 h-[calc(100%_-_1rem)] w-px bg-sidebar-border" />
          )}
          <span className="absolute left-1 top-0 inline-flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">
            <ActivityIcon kind={it.kind} />
          </span>
          <div className="flex-1 text-sm">
            <div className="font-medium leading-6 min-h-[24px] flex items-center">
              {it.title}
            </div>
            {it.description && (
              <div className="text-foreground/70 line-clamp-2 text-xs leading-6">
                {it.description}
              </div>
            )}
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-foreground/60 flex items-center gap-2 rounded-md border border-dashed p-3 text-sm">
          <MessagesSquare className="h-4 w-4" />
          Activity from deep research will appear here.
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
    <div className="space-y-2">
      {items.map((s) => {
        const domain = (() => {
          try {
            return new URL(s.url).hostname.replace(/^www\./, '');
          } catch {
            return s.url;
          }
        })();
        return (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-sidebar-border bg-background/40 p-3 hover:bg-accent"
          >
            <div className="flex items-center gap-2 text-xs text-foreground/70">
              <LinkIcon className="h-3.5 w-3.5" />
              <span>{domain}</span>
            </div>
            <div className="mt-1 line-clamp-2 text-sm font-medium leading-5">
              {s.title ?? s.url}
            </div>
          </a>
        );
      })}
      {items.length === 0 && (
        <div className="text-foreground/60 flex items-center gap-2 rounded-md border border-dashed p-3 text-sm">
          <FileText className="h-4 w-4" />
          Sources will show up when research finds citations.
        </div>
      )}
    </div>
  );
}

export function AppSidebar() {
  const thread = useThread({ optional: true });
  const messages = thread?.messages ?? [];

  const { activity, sources } = useMemo(
    () => extractActivity(messages),
    [messages]
  );
  const [tab, setTab] = useState<'activity' | 'sources'>('activity');

  return (
    <Sidebar side="right" width="22rem" className="border-l">
      <SidebarHeader>
        <SegmentedControl
          value={tab}
          onValueChange={(v) => setTab(v as 'activity' | 'sources')}
          segments={[
            { value: 'activity', label: 'Activity' },
            { value: 'sources', label: 'Sources', badge: sources.length },
          ]}
        />
      </SidebarHeader>
      <SidebarContent>
        {tab === 'activity' ? (
          <ActivityList items={activity} />
        ) : (
          <SourcesList items={sources} />
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="text-foreground/60 flex items-center justify-between text-xs">
          <span>Deep Research</span>
          <span>
            {activity.length} events • {sources.length} sources
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
