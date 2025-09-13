Open Deep Research UI (Frontend)

This is a Next.js app that provides a modern chat interface (via assistant-ui) for the Open Deep Research LangGraph backend.

## Quick Start

1. Create `frontend/.env.local` and configure connection to your LangGraph server:

```
# Required when calling a LangGraph Cloud/Platform server (proxy adds this automatically)
LANGCHAIN_API_KEY=your_langsmith_or_langgraph_api_key

# Backend base URL (local dev default shown)
LANGGRAPH_API_URL=http://127.0.0.1:2024

# Assistant/Graph ID exposed by the backend (see backend/langgraph.json)
# If using the default in this repo, this is "Deep Researcher"
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID="Deep Researcher"

# Optional: bypass the built-in Next.js /api proxy and call server directly from the browser
# Only use this if your server allows CORS and you know how your API key is injected
# NEXT_PUBLIC_LANGGRAPH_API_URL=https://your-langgraph-server.example.com
```

2. Install and run the dev server:

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000 to use the app.

## How It Works

- Runtime: `@assistant-ui/react` + `@assistant-ui/react-langgraph` handles message streaming and tool/updates.
- API proxy: Requests to `/api/*` are forwarded to `LANGGRAPH_API_URL` with `x-api-key` from `LANGCHAIN_API_KEY`.
- Assistant ID: The client streams runs to the assistant/graph defined by `NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID`.
- Config panel: The right sidebar contains a Settings tab where you can tweak models, search provider, MCP options, and limits. These settings are forwarded to the backend as LangGraph configurable fields for each run.

Key files:

- `components/RootProvider.tsx` — Wires the chat runtime and thread lifecycle.
- `lib/chatApi.ts` — Creates the LangGraph SDK client and streams runs.
- `components/assistant-ui/*` — Chat UI primitives and styling.
- `components/ConfigContext.tsx` / `components/ConfigPanel.tsx` — Local config that is sent as `configurable` to the backend per run.

## Environment Notes

- Prefer using the built-in `/api` proxy so the server-side can attach the `x-api-key`. If you set `NEXT_PUBLIC_LANGGRAPH_API_URL`, ensure the target server allows cross-origin requests and that your API key is sent appropriately.
- The default assistant/graph name in this repo is `Deep Researcher` (see `backend/langgraph.json`). Keep the quotes in `.env.local` if your ID contains spaces.

## Scripts

- `pnpm dev` — Start Next.js (Turbopack) on http://localhost:3000
- `pnpm build` — Production build
- `pnpm start` — Start production server (after build)
- `pnpm lint` — Run ESLint

## Deployment

- Vercel/Node: Set the same env vars as local. Point the app to your hosted LangGraph server (Cloud/Platform or self-hosted). Keep the server behind the `/api` proxy unless you also expose the API to the browser with CORS and front-end API key injection.

## Troubleshooting

- 401/403 from LangGraph: Ensure `LANGCHAIN_API_KEY` is valid and that you are using the `/api` proxy.
- 404 assistant not found: Confirm `NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID` matches the backend graph/assistant name.
