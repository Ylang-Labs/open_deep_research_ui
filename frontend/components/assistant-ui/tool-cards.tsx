'use client';

import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { useMemo, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  Info,
  Target,
  Wrench,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';

function tryParseArgs(argsText?: string): any | undefined {
  if (!argsText) return undefined;
  try {
    return JSON.parse(argsText);
  } catch {
    return undefined;
  }
}

function extractUrls(text?: string): string[] {
  if (!text) return [];
  const set = new Set<string>();
  const urlRegex = /https?:\/\/[\w.-]+(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=.]+)?/gi;
  for (const m of text.matchAll(urlRegex)) {
    try {
      const u = new URL(m[0]);
      set.add(u.href.replace(/[),.;:]+$/g, ''));
    } catch {
      // ignore
    }
  }
  return Array.from(set.values());
}

function Section({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
        {title}
      </div>
      {children}
    </div>
  );
}

function CollapsibleCard({
  icon,
  title,
  subtitle,
  right,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  return (
    <div className="mb-4 w-full overflow-hidden rounded-xl border shadow-sm">
      <div className="flex items-center gap-2 bg-gradient-to-b from-background/80 to-background px-4 py-2.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background text-foreground/80">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          {subtitle && (
            <div className="truncate text-xs text-foreground/70">
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {right}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      {open && <div className="border-t p-4">{children}</div>}
    </div>
  );
}

export const ThinkToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
}) => {
  const args = tryParseArgs(argsText);
  const reflection: string | undefined =
    args?.reflection ||
    (typeof result === 'string'
      ? result.replace(/^Reflection recorded:\s*/i, '').trim()
      : undefined);

  const [expanded, setExpanded] = useState(false);
  const isLong = (reflection?.length ?? 0) > 200;

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border px-4 py-3">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-indigo-500/10 via-indigo-400/5 to-transparent" />
      <div className="flex items-start gap-2">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-indigo-600 dark:text-indigo-300">
          <Brain className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
              Thinking
            </div>
            {isLong && (
              <TooltipIconButton
                tooltip={expanded ? 'Collapse' : 'Expand'}
                onClick={() => setExpanded((v) => !v)}
                className="h-6 w-6"
                aria-expanded={expanded}
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </TooltipIconButton>
            )}
          </div>
          <div className="mt-0.5 text-sm leading-6">
            {reflection ? (
              expanded ? (
                reflection
              ) : (
                <span className="line-clamp-2">{reflection}</span>
              )
            ) : (
              <span className="text-foreground/60">Planning next steps</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ClarifyWithUserCard: ToolCallMessagePartComponent = ({
  argsText,
}) => {
  const args = tryParseArgs(argsText) ?? {};
  const need = Boolean(args?.need_clarification);
  const verification: string | undefined = args?.verification || args?.question;
  return (
    <div
      className={
        'mb-5 rounded-xl border p-3 text-sm ' +
        (need
          ? 'border-amber-400/40 bg-amber-50 text-amber-900 dark:border-amber-900/30 dark:bg-amber-900/15 dark:text-amber-200'
          : 'border-emerald-400/40 bg-emerald-50 text-emerald-900 dark:border-emerald-900/30 dark:bg-emerald-900/15 dark:text-emerald-200')
      }
    >
      <div className="flex items-center gap-2 font-medium">
        {need ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        <span>{need ? 'Clarification needed' : 'Good to go'}</span>
      </div>
      {verification && <div className="mt-1 opacity-85">{verification}</div>}
    </div>
  );
};

export const ResearchQuestionCard: ToolCallMessagePartComponent = ({
  argsText,
}) => {
  const args = tryParseArgs(argsText) ?? {};
  const brief: string | undefined = args?.research_brief;
  return (
    <div className="mb-5 rounded-2xl border bg-gradient-to-br from-sky-50 to-transparent p-4 dark:from-sky-900/20 dark:to-transparent">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/10 text-sky-700 dark:text-sky-300">
          <Target className="h-3.5 w-3.5" />
        </span>
        <div className="text-sm font-medium">Research Brief</div>
      </div>
      {brief ? (
        <div className="text-sm leading-6">{brief}</div>
      ) : (
        <div className="text-foreground/70 text-sm">No brief provided.</div>
      )}
    </div>
  );
};

function parseQueriesFromResult(text?: string): string[] {
  if (!text) return [];
  // Try to extract inside queries = ["..."] pattern
  const m = text.match(/queries\s*=\s*\[(.*?)\]/is);
  if (!m) return [];
  const inner = m[1];
  const qRegex = /"([^"]+)"|'([^']+)'/g;
  const out: string[] = [];
  for (const mm of inner.matchAll(qRegex)) {
    const q = mm[1] || mm[2];
    if (q) out.push(q);
  }
  return out;
}

export const ConductResearchCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
}) => {
  const args = tryParseArgs(argsText) ?? {};
  const topic: string | undefined = args?.research_topic;
  const resultText: string | undefined =
    typeof result === 'string' ? result : undefined;

  const { urls, queries } = useMemo(() => {
    return {
      urls: extractUrls(resultText),
      queries: parseQueriesFromResult(resultText),
    };
  }, [resultText]);

  const preview = useMemo(
    () => (resultText ? resultText.slice(0, 600) : ''),
    [resultText]
  );
  const [expanded, setExpanded] = useState(false);

  const sourceCards = (
    <div className="flex flex-col gap-2">
      {urls.map((u) => {
        let domain = u;
        try {
          domain = new URL(u).hostname.replace(/^www\./, '');
        } catch {}
        const favicon = `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(
          u
        )}`;
        return (
          <a
            key={u}
            href={u}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 rounded-lg border bg-background/70 p-2 transition-colors hover:bg-accent"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={favicon} alt="" className="h-5 w-5 rounded-sm" />
            <span className="truncate text-xs font-medium">{domain}</span>
          </a>
        );
      })}
      {urls.length === 0 && (
        <div className="text-foreground/60 rounded-md border border-dashed p-2 text-xs">
          No sources extracted yet.
        </div>
      )}
    </div>
  );

  const [showBrief, setShowBrief] = useState(false);
  const showToggle = (topic?.length ?? 0) > 180;

  return (
    <div className="mb-5 rounded-2xl border bg-gradient-to-br from-foreground/[0.04] to-transparent p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background">
            <Search className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">Research Pass</div>
            {topic && (
              <div className="mt-1 text-xs text-foreground/75 leading-[1.8]">
                {showBrief ? (
                  topic
                ) : (
                  <span className="line-clamp-2">{topic}</span>
                )}
              </div>
            )}
            {topic && showToggle && (
              <div className="mt-1">
                <TooltipIconButton
                  tooltip={showBrief ? 'Collapse' : 'Expand'}
                  onClick={() => setShowBrief((v) => !v)}
                  className="h-6 w-6"
                  aria-expanded={showBrief}
                >
                  {showBrief ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </TooltipIconButton>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {queries.length > 0 && (
            <span className="rounded-full border bg-background/80 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
              {queries.length} {queries.length === 1 ? 'query' : 'queries'}
            </span>
          )}
          {urls.length > 0 && (
            <span className="rounded-full border bg-background/80 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
              {urls.length} {urls.length === 1 ? 'source' : 'sources'}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-4">
        <div>
          <Section title={queries.length <= 1 ? 'Query' : 'Queries'} />
          <div className="mt-2 flex flex-col gap-2">
            {queries.length > 0 ? (
              queries.map((q, i) => (
                <div
                  key={`${q}-${i}`}
                  className="rounded-lg border bg-background/70 px-3 py-2 text-xs leading-6"
                >
                  {q}
                </div>
              ))
            ) : (
              <div className="text-foreground/60 rounded-lg border border-dashed px-3 py-2 text-xs">
                No queries recorded
              </div>
            )}
          </div>
        </div>

        <div>
          <Section title="Sources" />
          <div className="mt-2">{sourceCards}</div>
        </div>
      </div>

      {resultText && (
        <div className="mt-4">
          <Section title="Findings" />
          <div className="mt-2 rounded-lg border bg-background/60 p-3 text-xs leading-6">
            <pre className="whitespace-pre-wrap">
              {expanded ? resultText : preview}
              {resultText.length > preview.length && !expanded ? '…' : ''}
            </pre>
            {resultText.length > preview.length && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded((v) => !v)}
                >
                  {expanded ? 'Show less' : 'Show full report text'}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ResearchCompleteCard: ToolCallMessagePartComponent = () => {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border px-4 py-3">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-emerald-500/10 via-emerald-400/5 to-transparent" />
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        Research Complete
      </div>
      <div className="mt-1 text-xs text-foreground/70">
        Supervisor sign-off received. Proceed to final drafting.
      </div>
    </div>
  );
};

export const GenericToolCard: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
}) => {
  return (
    <CollapsibleCard
      icon={<Wrench className="h-3.5 w-3.5" />}
      title={`Tool: ${toolName}`}
      defaultOpen={false}
    >
      {argsText && (
        <Section title="Args">
          <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
            {argsText}
          </pre>
        </Section>
      )}
      {typeof result !== 'undefined' && (
        <Section title="Result">
          <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">
            {typeof result === 'string'
              ? result
              : JSON.stringify(result, null, 2)}
          </pre>
        </Section>
      )}
    </CollapsibleCard>
  );
};
