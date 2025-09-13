"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type SearchAPI = "tavily" | "openai" | "anthropic" | "none";

export type MCPConfig = {
  url?: string | null;
  tools?: string[] | null;
  auth_required?: boolean | null;
} | null;

export type DeepResearchConfig = {
  // General
  max_structured_output_retries: number;
  allow_clarification: boolean;
  max_concurrent_research_units: number;

  // Research
  search_api: SearchAPI;
  max_researcher_iterations: number;
  max_react_tool_calls: number;

  // Models
  summarization_model: string;
  summarization_model_max_tokens: number;
  max_content_length: number;
  research_model: string;
  research_model_max_tokens: number;
  compression_model: string;
  compression_model_max_tokens: number;
  final_report_model: string;
  final_report_model_max_tokens: number;

  // MCP
  mcp_config: MCPConfig;
  mcp_prompt?: string | null;
};

const DEFAULTS: DeepResearchConfig = {
  max_structured_output_retries: 3,
  allow_clarification: true,
  max_concurrent_research_units: 5,

  search_api: "tavily",
  max_researcher_iterations: 6,
  max_react_tool_calls: 10,

  summarization_model: "openai:gpt-4.1-mini",
  summarization_model_max_tokens: 8192,
  max_content_length: 50000,
  research_model: "openai:gpt-4.1",
  research_model_max_tokens: 10000,
  compression_model: "openai:gpt-4.1",
  compression_model_max_tokens: 8192,
  final_report_model: "openai:gpt-4.1",
  final_report_model_max_tokens: 10000,

  mcp_config: null,
  mcp_prompt: null,
};

function parseStored(value: string | null): DeepResearchConfig | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DeepResearchConfig>;
    // basic shape validation and merge
    return { ...DEFAULTS, ...parsed } as DeepResearchConfig;
  } catch {
    return null;
  }
}

const DeepResearchConfigContext = createContext<{
  config: DeepResearchConfig;
  setConfig: (updater: DeepResearchConfig | ((c: DeepResearchConfig) => DeepResearchConfig)) => void;
  reset: () => void;
} | null>(null);

const STORAGE_KEY = "deep-research-config:v1";

export function DeepResearchConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<DeepResearchConfig>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    return parseStored(window.localStorage.getItem(STORAGE_KEY)) ?? DEFAULTS;
  });

  // persist
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch {
      // ignore
    }
  }, [config]);

  const setConfig = useCallback(
    (
      updater: DeepResearchConfig | ((c: DeepResearchConfig) => DeepResearchConfig)
    ) => {
      setConfigState((prev) =>
        typeof updater === "function"
          ? (updater as (c: DeepResearchConfig) => DeepResearchConfig)(prev)
          : updater
      );
    },
    []
  );

  const reset = useCallback(() => setConfigState(DEFAULTS), []);

  const value = useMemo(() => ({ config, setConfig, reset }), [config, setConfig, reset]);

  return (
    <DeepResearchConfigContext.Provider value={value}>
      {children}
    </DeepResearchConfigContext.Provider>
  );
}

export function useDeepResearchConfig() {
  const ctx = useContext(DeepResearchConfigContext);
  if (!ctx) throw new Error("useDeepResearchConfig must be used within DeepResearchConfigProvider");
  return ctx;
}

// Helper to convert to LangGraph configurable payload
export function toConfigurable(config: DeepResearchConfig): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    max_structured_output_retries: config.max_structured_output_retries,
    allow_clarification: config.allow_clarification,
    max_concurrent_research_units: config.max_concurrent_research_units,
    search_api: config.search_api,
    max_researcher_iterations: config.max_researcher_iterations,
    max_react_tool_calls: config.max_react_tool_calls,
    summarization_model: config.summarization_model,
    summarization_model_max_tokens: config.summarization_model_max_tokens,
    max_content_length: config.max_content_length,
    research_model: config.research_model,
    research_model_max_tokens: config.research_model_max_tokens,
    compression_model: config.compression_model,
    compression_model_max_tokens: config.compression_model_max_tokens,
    final_report_model: config.final_report_model,
    final_report_model_max_tokens: config.final_report_model_max_tokens,
  };

  if (config.mcp_prompt) payload["mcp_prompt"] = config.mcp_prompt;
  if (config.mcp_config) {
    const mc: Record<string, unknown> = {};
    if (config.mcp_config.url) mc.url = config.mcp_config.url;
    if (config.mcp_config.tools) mc.tools = config.mcp_config.tools;
    if (typeof config.mcp_config.auth_required === "boolean") mc.auth_required = config.mcp_config.auth_required;
    payload["mcp_config"] = mc;
  }

  return payload;
}
