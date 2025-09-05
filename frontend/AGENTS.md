# Repository Guidelines

## Project Structure & Module Organization

- `app/`: Next.js App Router. Key files: `layout.tsx`, `page.tsx`, and API proxy `api/[..._path]/route.ts` (forwards to LangGraph).
- `components/`: UI building blocks. `MyAssistant.tsx` wires `@assistant-ui/*` to the LangGraph runtime; `assistant-ui/` holds chat/thread UI.
- `lib/`: Client helpers for LangGraph (`chatApi.ts`) and utilities (`utils.ts`).
- Config: `eslint.config.mjs`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`.
- Env: copy `.env.example` to `.env.local` for local development.

## Build, Test, and Development Commands

- `pnpm dev`: Run the dev server with Turbopack at `http://localhost:3000`.
- `pnpm build`: Produce an optimized production build.
- `pnpm start`: Start the production server (after build).
- `pnpm lint`: Lint the codebase using Next.js ESLint rules.
  Notes: Install deps with `pnpm install`. Ensure `.env.local` sets `LANGCHAIN_API_KEY`, `LANGGRAPH_API_URL`, and `NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID`. The client defaults to the built-in `/api` proxy; to target a custom endpoint directly, set `NEXT_PUBLIC_LANGGRAPH_API_URL`.

## Coding Style & Naming Conventions

- **TypeScript + Next.js (App Router)**. Prefer functional components and server/client boundaries per Next conventions.
- **Indentation**: 2 spaces; avoid trailing whitespace. Keep lines concise and readable.
- **Components**: PascalCase filenames in `components/` (e.g., `MyAssistant.tsx`); named exports for shared components. Route segment folders lower-kebab-case.
- **Styling**: Tailwind CSS v4. Compose classes; use `clsx` and `tailwind-merge` where helpful.
- **Linting**: Follow `next/core-web-vitals` + TypeScript config; run `pnpm lint` before pushing.

## Testing Guidelines

- No test runner is configured yet. When adding tests, prefer Vitest + React Testing Library.
- Place tests alongside files (`*.test.ts(x)`) or under `__tests__/` mirroring source structure.
- Mock LangGraph calls (`lib/chatApi.ts`) and avoid network access in unit tests. Aim for meaningful coverage on components and API proxy logic.

## Commit & Pull Request Guidelines

- Git history is minimal; adopt Conventional Commits (e.g., `feat: add thread switching`, `fix: include API key header`).
- PRs: clear description, linked issues, screenshots for UI changes, steps to test, and any env/config impacts. Keep diffs focused and self-contained.

## Security & Configuration Tips

- Never commit secrets. Use `.env.local` (gitignored). Server proxy uses `LANGCHAIN_API_KEY` and `LANGGRAPH_API_URL`; client uses `NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID` and optional `NEXT_PUBLIC_LANGGRAPH_API_URL`.
- Avoid logging sensitive values; prefer server-side proxy (`/api`) for key usage.
