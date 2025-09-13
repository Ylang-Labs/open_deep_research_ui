'use client';

import React, { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  useDeepResearchConfig,
  type DeepResearchConfig,
  type SearchAPI,
} from '@/components/ConfigContext';
import { Cog, Beaker, Cpu, Wrench } from 'lucide-react';

type LabeledProps = {
  label: string;
  htmlFor?: string;
  description?: string;
  children: React.ReactNode;
};

const inputBase =
  'w-full h-9 rounded-lg border border-sidebar-border/60 bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition';

function Field({ label, htmlFor, description, children }: LabeledProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-medium tracking-wide text-foreground/70"
      >
        {label}
      </label>
      {children}
      {description ? (
        <p className="text-[11px] text-foreground/50 leading-relaxed">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function GroupCard({
  title,
  icon,
  subtitle,
  children,
  cols = 1,
}: {
  title: string;
  icon: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  cols?: 1 | 2;
}) {
  return (
    <div className="rounded-xl border border-sidebar-border/60 bg-gradient-to-br from-background/70 to-background/40 shadow-sm">
      <div className="flex items-start gap-3 border-b border-sidebar-border/60 p-3">
        <div className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-sidebar-accent/60 text-foreground/80">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground/90">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-foreground/55 leading-normal">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-1 gap-3">{children}</div>
      </div>
    </div>
  );
}

export function DeepResearchConfigPanel() {
  const { config, setConfig, reset } = useDeepResearchConfig();

  type NumberKeys = {
    [K in keyof DeepResearchConfig]: DeepResearchConfig[K] extends number
      ? K
      : never;
  }[keyof DeepResearchConfig];
  type StringKeys =
    | 'summarization_model'
    | 'research_model'
    | 'compression_model'
    | 'final_report_model';
  type BoolKeys = 'allow_clarification';

  const onNumber = useCallback(
    (key: NumberKeys) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value);
      const k = key as keyof DeepResearchConfig;
      setConfig(
        (c) =>
          ({
            ...c,
            [k]: Number.isFinite(n) ? n : (c[k] as number),
          } as DeepResearchConfig)
      );
    },
    [setConfig]
  );
  const onText = useCallback(
    (key: StringKeys) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = e.target.value;
        const k = key as keyof DeepResearchConfig;
        setConfig((c) => ({ ...c, [k]: value } as DeepResearchConfig));
      },
    [setConfig]
  );
  const onBool = useCallback(
    (key: BoolKeys) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const k = key as keyof DeepResearchConfig;
      setConfig((c) => ({ ...c, [k]: e.target.checked } as DeepResearchConfig));
    },
    [setConfig]
  );
  const onSearchApi = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setConfig(
        (c) =>
          ({
            ...c,
            search_api: e.target.value as SearchAPI,
          } as DeepResearchConfig)
      );
    },
    [setConfig]
  );

  const mcp = config.mcp_config ?? { url: '', tools: [], auth_required: false };

  const toolsText = useMemo(
    () => (mcp.tools && mcp.tools.length ? mcp.tools.join(', ') : ''),
    [mcp.tools]
  );

  return (
    <div className="space-y-4">
      <GroupCard
        title="General"
        subtitle="Base behavior and concurrency"
        icon={<Cog className="h-3.5 w-3.5" />}
        cols={1}
      >
        <Field label="Allow clarification questions">
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-sidebar-border"
              checked={config.allow_clarification}
              onChange={onBool('allow_clarification')}
            />
            <span>Enable pre‑research clarifying questions</span>
          </label>
        </Field>
        <Field label="Max structured output retries">
          <input
            type="number"
            min={1}
            max={10}
            className={inputBase}
            value={config.max_structured_output_retries}
            onChange={onNumber('max_structured_output_retries')}
          />
        </Field>
        <Field label="Max concurrent research units">
          <input
            type="number"
            min={1}
            max={20}
            className={inputBase}
            value={config.max_concurrent_research_units}
            onChange={onNumber('max_concurrent_research_units')}
          />
        </Field>
      </GroupCard>

      <GroupCard
        title="Research"
        subtitle="Search provider and iteration limits"
        icon={<Beaker className="h-3.5 w-3.5" />}
        cols={1}
      >
        <Field label="Search API">
          <select
            className={inputBase}
            value={config.search_api}
            onChange={onSearchApi}
          >
            <option value="tavily">Tavily</option>
            <option value="openai">OpenAI Native Web Search</option>
            <option value="anthropic">Anthropic Native Web Search</option>
            <option value="none">None</option>
          </select>
        </Field>
        <Field label="Max supervisor iterations">
          <input
            type="number"
            min={1}
            max={10}
            className={inputBase}
            value={config.max_researcher_iterations}
            onChange={onNumber('max_researcher_iterations')}
          />
        </Field>
        <Field label="Max tool call iterations">
          <input
            type="number"
            min={1}
            max={30}
            className={inputBase}
            value={config.max_react_tool_calls}
            onChange={onNumber('max_react_tool_calls')}
          />
        </Field>
        <Field label="Max content length (chars)">
          <input
            type="number"
            min={1000}
            max={200000}
            className={inputBase}
            value={config.max_content_length}
            onChange={onNumber('max_content_length')}
          />
        </Field>
      </GroupCard>

      <GroupCard
        title="Models"
        subtitle="Per‑role model and token limits"
        icon={<Cpu className="h-3.5 w-3.5" />}
        cols={1}
      >
        <Field label="Summarization model">
          <input
            type="text"
            className={inputBase}
            value={config.summarization_model}
            onChange={onText('summarization_model')}
          />
        </Field>
        <Field label="Max tokens (summarization)">
          <input
            type="number"
            className={inputBase}
            value={config.summarization_model_max_tokens}
            onChange={onNumber('summarization_model_max_tokens')}
          />
        </Field>
        <Field label="Research model">
          <input
            type="text"
            className={inputBase}
            value={config.research_model}
            onChange={onText('research_model')}
          />
        </Field>
        <Field label="Max tokens (research)">
          <input
            type="number"
            className={inputBase}
            value={config.research_model_max_tokens}
            onChange={onNumber('research_model_max_tokens')}
          />
        </Field>
        <Field label="Compression model">
          <input
            type="text"
            className={inputBase}
            value={config.compression_model}
            onChange={onText('compression_model')}
          />
        </Field>
        <Field label="Max tokens (compression)">
          <input
            type="number"
            className={inputBase}
            value={config.compression_model_max_tokens}
            onChange={onNumber('compression_model_max_tokens')}
          />
        </Field>
        <Field label="Final report model">
          <input
            type="text"
            className={inputBase}
            value={config.final_report_model}
            onChange={onText('final_report_model')}
          />
        </Field>
        <Field label="Max tokens (final report)">
          <input
            type="number"
            className={inputBase}
            value={config.final_report_model_max_tokens}
            onChange={onNumber('final_report_model_max_tokens')}
          />
        </Field>
      </GroupCard>

      <GroupCard
        title="MCP Tools"
        subtitle="Optional tool servers available to the researcher"
        icon={<Wrench className="h-3.5 w-3.5" />}
        cols={1}
      >
        <Field label="MCP server URL">
          <input
            type="text"
            placeholder="https://your-mcp-server.example.com"
            className={inputBase}
            value={mcp?.url ?? ''}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                mcp_config: {
                  ...(c.mcp_config ?? {}),
                  url: e.target.value || undefined,
                },
              }))
            }
          />
        </Field>
        <Field label="Tools (comma separated)">
          <input
            type="text"
            placeholder="toolA, toolB"
            className={inputBase}
            value={toolsText}
            onChange={(e) => {
              const list = e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              setConfig((c) => ({
                ...c,
                mcp_config: {
                  ...(c.mcp_config ?? {}),
                  tools: list.length ? list : undefined,
                },
              }));
            }}
          />
        </Field>
        <Field label="Require authentication">
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-sidebar-border"
              checked={!!mcp?.auth_required}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  mcp_config: {
                    ...(c.mcp_config ?? {}),
                    auth_required: e.target.checked,
                  },
                }))
              }
            />
            <span>Protected server requires credentials</span>
          </label>
        </Field>
        <div>
          <Field label="Additional MCP prompt (optional)">
            <textarea
              placeholder="Additional system instructions about available MCP tools"
              className="w-full min-h-24 rounded-lg border border-sidebar-border/60 bg-background px-3 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              value={config.mcp_prompt ?? ''}
              onChange={(e) =>
                setConfig((c) => ({ ...c, mcp_prompt: e.target.value }))
              }
            />
          </Field>
        </div>
      </GroupCard>

      <div className="sticky bottom-0 flex items-center gap-2 rounded-xl border border-sidebar-border/60 bg-gradient-to-r from-background/90 to-background/70 p-2 flex-col">
        <Button variant="outline" size="sm" onClick={reset} className="w-full">
          Reset to defaults
        </Button>
        <div className="text-[11px] text-foreground/60">
          Applies to new runs in this session.
        </div>
      </div>
    </div>
  );
}
