Backend Model Auto‑Selection Plan

Goals
- Automatically choose the correct LLM provider/model based on which API key(s) are available at runtime.
- Preserve explicit user choices (if a model is set in config/UI, use it as long as its provider key is present).
- Fail clearly when no compatible provider is available; log what was detected and what was selected.
- Keep the change low‑risk, incremental, and easy to extend (OpenAI, Anthropic, Google first).

Current State (as of this repo)
- Config defaults point to OpenAI models: `research_model`, `compression_model`, `final_report_model` → `openai:gpt-4.1`; `summarization_model` → `openai:gpt-4.1-mini` (backend/src/open_deep_research/configuration.py:121).
- Model init flows read those strings and pass an API key derived from the model prefix (backend/src/open_deep_research/utils.py:760 get_api_key_for_model).
- If only a non‑OpenAI key is present (e.g., `GOOGLE_API_KEY`), the default OpenAI models will be selected and calls will fail.

High‑Level Approach
- Introduce an auto‑selection layer that resolves the effective model strings at runtime by inspecting available provider API keys and user configuration (env or LangGraph `configurable`).
- Use this resolver in places that currently read the model fields directly, without changing the core graph logic.
- Provide clear precedence and an escape hatch for strictness and preference.

Design
- Provider Detection
  - Source of keys:
    - If `GET_API_KEYS_FROM_CONFIG=true`: read from `config.configurable.apiKeys.{OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY}`.
    - Else: read from environment variables.
  - Return a set like `{openai: bool, anthropic: bool, google: bool}` and a list of available providers in a defined order.

- Model Defaults (recommended, can be tuned later)
  - openai:
    - summarization: `openai:gpt-4o-mini` (or `openai:gpt-4.1-mini` if you prefer parity with current defaults)
    - research: `openai:gpt-4.1` (or `openai:gpt-4o`)
    - compression: `openai:gpt-4.1`
    - final_report: `openai:gpt-4.1`
  - anthropic:
    - summarization: `anthropic:claude-3-5-haiku`
    - research: `anthropic:claude-3-7-sonnet` (or `anthropic:claude-sonnet-4` if available)
    - compression: `anthropic:claude-3-7-sonnet`
    - final_report: `anthropic:claude-3-7-sonnet`
  - google:
    - summarization: `google:gemini-1.5-flash`
    - research: `google:gemini-1.5-pro`
    - compression: `google:gemini-1.5-pro`
    - final_report: `google:gemini-1.5-pro`

- Resolution Algorithm
  - Inputs: user‑provided model strings (from `Configuration` or env), detected providers, optional preference knobs.
  - For each model role (summarization/research/compression/final_report):
    1) If user set a model and its provider key is present → use it.
    2) Else pick the first provider from a preference order that is available and use that provider’s default for the role.
    3) If none available → raise a clear error instructing to set any of OPENAI/ANTHROPIC/GOOGLE keys or override the model explicitly.
  - Preference order:
    - Default: openai > anthropic > google (documented and overridable)
    - Overridable via either env `PREFERRED_LLM_PROVIDER=openai|anthropic|google` or a list `PREFERRED_PROVIDER_ORDER=openai,anthropic,google`.
  - Strictness option:
    - If `STRICT_PROVIDER_MATCH=true` and a user‑chosen model’s provider key is missing → hard error (no fallback). Otherwise warn and fallback per the algorithm above.

- Search API Alignment (optional, low‑risk default is keep Tavily)
  - If we add a SearchAPI `AUTO` option, choose:
    - openai → `SearchAPI.OPENAI`
    - anthropic → `SearchAPI.ANTHROPIC`
    - else → `SearchAPI.TAVILY`
  - Otherwise, keep current default `TAVILY` and let users opt into provider‑native search via the UI/config.

Integration Points (no code here yet; references for later)
- Add a new utility module, e.g., `backend/src/open_deep_research/model_selection.py`, exporting:
  - `detect_available_providers(config) -> dict`
  - `resolve_models(config) -> dict` with keys: `summarization_model`, `research_model`, `compression_model`, `final_report_model`
- Update call sites to use resolver outputs instead of the raw config strings:
  - Tavily summarization init (backend/src/open_deep_research/utils.py:85)
  - Clarify / write_research_brief / supervisor / researcher / final_report (backend/src/open_deep_research/deep_researcher.py:82, 134, 194, 392, 528, 628)
  - Keep `get_api_key_for_model` unchanged, it already maps provider→key correctly for openai/anthropic/google.
- Optionally extend `Configuration.from_runnable_config` to pre‑fill resolved model strings, but prefer a non‑intrusive resolver first to minimize risk.

Config Surface
- New envs (documented, optional):
  - `AUTO_MODEL_SELECTION=true` (default true; set false to revert to current behavior)
  - `PREFERRED_LLM_PROVIDER=openai|anthropic|google`
  - `PREFERRED_PROVIDER_ORDER=openai,anthropic,google`
  - `STRICT_PROVIDER_MATCH=false`
- Update `backend/.env.example` with the above and comments.

Testing Strategy
- Unit tests in `backend/tests/` that monkeypatch env and/or `config.configurable.apiKeys`:
  - Only `OPENAI_API_KEY` present → all roles resolve to OpenAI defaults.
  - Only `ANTHROPIC_API_KEY` present → resolve to Anthropic defaults.
  - Only `GOOGLE_API_KEY` present → resolve to Google defaults.
  - Multiple keys present + `PREFERRED_LLM_PROVIDER` set → honors preference.
  - User‑set model with missing provider key: with `STRICT_PROVIDER_MATCH=true` → error; with false → warning + fallback.
  - `GET_API_KEYS_FROM_CONFIG=true` path: read from `apiKeys` dict.

Observability & Errors
- Log one line on startup of a run (first resolve) with: detected providers, chosen provider, effective models per role.
- Raise actionable errors when no providers are available or when strict mode blocks fallback.

Docs & DX
- README: add a short “Automatic Model Selection” section explaining behavior and env overrides (backend/README.md:1).
- `.env.example`: add new env vars with comments (backend/.env.example:1).
- A brief note in comments near defaults in `configuration.py` clarifying that runtime may override defaults if `AUTO_MODEL_SELECTION=true` (backend/src/open_deep_research/configuration.py:121).

Rollout Plan
- Phase 1: Implement resolver + wire up at call sites; keep `AUTO_MODEL_SELECTION=true` default, but allow `false` to disable.
- Phase 2 (optional): Add `SearchAPI.AUTO` and align search provider automatically.
- Phase 3 (optional): Extend provider support (Groq, Mistral, Cohere, Bedrock) by adding keys and defaults; keep current code paths untouched until keys exist.

Open Questions (to confirm before coding)
- Do we want strict mode by default or permissive fallback? (Proposed: permissive.)
- Preferred default provider order OK as openai > anthropic > google?
- Any provider we should prioritize due to cost/latency for summarization (e.g., always use mini/flash tiers for summarization)?

