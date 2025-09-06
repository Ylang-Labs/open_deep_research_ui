# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

Use `pnpm` as the package manager for this project:

- `pnpm dev` - Start development server with Turbopack at http://localhost:3000
- `pnpm build` - Create optimized production build
- `pnpm start` - Start production server (after build)
- `pnpm lint` - Run ESLint with Next.js rules
- `pnpm install` - Install dependencies

Note: No test runner is configured. When adding tests, prefer Vitest + React Testing Library.

## Environment Setup

Required environment variables in `.env.local`:
```
LANGCHAIN_API_KEY=your_langchain_api_key
LANGGRAPH_API_URL=your_langgraph_api_url
NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID=your_assistant_id_or_graph_id
```

Optional: Set `NEXT_PUBLIC_LANGGRAPH_API_URL` to bypass the built-in `/api` proxy.

## Architecture Overview

This is a Next.js 15 application using the App Router that integrates assistant-ui with LangGraph for AI chat functionality.

### Key Components Architecture

**Core Integration Flow:**
- `MyAssistant.tsx` - Main component that wires @assistant-ui/react with LangGraph runtime
- `lib/chatApi.ts` - Client-side API wrapper for LangGraph SDK operations
- `app/api/[..._path]/route.ts` - Server-side proxy that forwards requests to LangGraph API with authentication

**Data Flow:**
1. User interacts with Thread UI components
2. MyAssistant handles runtime events (create/switch threads, send messages)
3. chatApi.ts creates LangGraph client and manages thread operations
4. API proxy forwards authenticated requests to LangGraph backend
5. Streaming responses flow back through the assistant-ui runtime

### Directory Structure

- `app/` - Next.js App Router (layout.tsx, page.tsx, API routes)
- `components/MyAssistant.tsx` - Main assistant integration component
- `components/assistant-ui/` - Custom UI components for chat interface
- `components/ui/` - Reusable UI components (shadcn/ui style)
- `lib/chatApi.ts` - LangGraph client wrapper
- `lib/utils.ts` - Utility functions

### Framework Stack

- **Next.js 15** with App Router and React 19
- **TypeScript** with strict configuration
- **Tailwind CSS v4** for styling
- **assistant-ui** packages for chat components and LangGraph integration
- **LangGraph SDK** for AI agent communication
- **shadcn/ui** component patterns

### Code Conventions

- Use functional components with TypeScript
- 2-space indentation, PascalCase for components
- Prefer server/client boundaries per Next.js conventions
- Use `clsx` and `tailwind-merge` for conditional styling
- Follow Next.js ESLint configuration