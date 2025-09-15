# Repository Guidelines

## Project Structure & Module Organization

- Backend: `backend/src/open_deep_research/` (source), `backend/src/legacy/` and `backend/tests/` (legacy examples/evals). Keep backend packages under `backend/src/`; do not import outside this root.
- Frontend: `frontend/app/` (App Router) and `frontend/components/` (shared UI).
- Docs: `docs/`. Avoid cross‑boundary imports between backend and frontend.

## Build, Test, and Development Commands

- Backend setup: `cd backend && uv sync` (install). Optional: `uv venv && source .venv/bin/activate`.
- Dev server (LangGraph Studio): `uvx --refresh --from "langgraph-cli[inmem]" --with-editable . --python 3.11 langgraph dev --allow-blocking`.
- Backend tests: `uv run -m pytest -q` (tests in `src/legacy/tests` and `backend/tests`).
- Lint/Type (backend): `uv run ruff check .`; `uv run mypy src`.
- Frontend setup: `cd frontend && pnpm install`.
- Frontend dev/build: `pnpm dev` | `pnpm build` | `pnpm start`; lint: `pnpm lint`.

## Coding Style & Naming Conventions

- Python: 4‑space indent, type hints, Google‑style docstrings. Use Ruff rules E,F,I,D,UP; run `ruff --fix` before committing.
- TypeScript/React: Next.js + ESLint. Components `PascalCase`, hooks `useX`, files `kebab-case.ts(x)`.
- Paths: prefer absolute/module imports within each app root; avoid imports that escape `backend/src/`.

## Testing Guidelines

- Backend: Write `pytest` tests under `backend/src/**/tests` or `backend/tests` as `test_*.py`. Mock network calls; add basic coverage for changed code.
- Frontend: No formal runner yet—keep logic small; use typed props and runtime guards on critical branches.

## Commit & Pull Request Guidelines

- Commits: Conventional format, e.g., `feat(backend): add provider fallback`, `fix: handle empty search results`.
- PRs: Clear description, linked issues, repro/verify steps; screenshots for UI changes. Note any env/config updates. Keep diffs focused.

## Security & Configuration

- Never commit secrets. Use `backend/.env` and `frontend/.env.local` (copy from `.env.example`).
- Keys: `LANGCHAIN_API_KEY`, `LANGGRAPH_API_URL`, `NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID`.
- Default local URLs: backend API `http://127.0.0.1:2024`, frontend `http://localhost:3000`.

## Project Architecture

This is a full-stack deep research application split into two main components:

**Frontend** (`frontend/`): Next.js 15 application with assistant-ui integration
**Backend** (`backend/`): Python LangGraph-based deep research agent

### Data Flow Architecture

1. **Frontend** serves the chat interface using assistant-ui components
2. **API Proxy** (`frontend/app/api/[..._path]/route.ts`) forwards requests to LangGraph backend
3. **Backend LangGraph Agent** processes research requests using configurable models and search APIs
4. **Streaming responses** flow back through the assistant-ui runtime to the frontend

## Development Commands

### Frontend (Next.js)

```bash
cd frontend
pnpm dev                # Start development server at http://localhost:3000
pnpm build              # Create optimized production build
pnpm start              # Start production server (after build)
pnpm lint               # Run ESLint with Next.js rules
```

### Backend (Python/LangGraph)

```bash
cd backend
uv sync                 # Install dependencies
uvx --refresh --from "langgraph-cli[inmem]" --with-editable . --python 3.11 langgraph dev --allow-blocking
                        # Start LangGraph server with Studio UI
python tests/run_evaluate.py  # Run comprehensive evaluations
ruff check              # Code linting
mypy                    # Type checking (if configured)
```

### LangGraph Studio Access

When running `langgraph dev`:

- 🚀 API: http://127.0.0.1:2024
- 🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- 📚 API Docs: http://127.0.0.1:2024/docs

## Configuration

### Frontend Environment (`.env.local`)

```
LANGCHAIN_API_KEY=your_langchain_api_key
LANGGRAPH_API_URL=your_langgraph_api_url
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=your_assistant_id_or_graph_id
```

Optional: `NEXT_PUBLIC_LANGGRAPH_API_URL` to bypass built-in `/api` proxy.

### Backend Environment (`.env`)

Copy from `.env.example` and configure:

- Model providers (OpenAI, Anthropic, Google, etc.)
- Search APIs (Tavily, DuckDuckGo, Exa)
- MCP server configurations
- LangSmith tracking settings

## Core Components

### Frontend Key Files

- `components/MyAssistant.tsx` - Main assistant integration wiring @assistant-ui with LangGraph
- `lib/chatApi.ts` - LangGraph SDK client wrapper
- `app/api/[..._path]/route.ts` - Server proxy with authentication

### Backend Key Files

- `src/open_deep_research/deep_researcher.py` - Main LangGraph implementation (entry point: `deep_researcher`)
- `src/open_deep_research/configuration.py` - Configurable settings for models, search, MCP
- `src/open_deep_research/state.py` - Graph state definitions
- `src/security/auth.py` - Authentication handler

### LangGraph Configuration

- `backend/langgraph.json` defines graph entry point and Python version
- Main graph: `"Deep Researcher": "./src/open_deep_research/deep_researcher.py:deep_researcher"`

## Testing & Evaluation

The backend includes comprehensive evaluation against Deep Research Bench (100 PhD-level research tasks):

```bash
cd backend
python tests/run_evaluate.py  # Runs evaluation (costs ~$20-$100 depending on models)
python tests/extract_langsmith_data.py --project-name "EXPERIMENT_NAME" --model-name "model-name" --dataset-name "deep_research_bench"
```

## Technology Stack

**Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4, assistant-ui, LangGraph SDK
**Backend**: Python 3.11, LangGraph, LangChain, multiple LLM providers, search APIs, MCP servers
**Development**: UV package manager, pnpm, ESLint, Ruff, LangGraph Studio
