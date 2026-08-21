<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## API Fetching Conventions

- Do not use proxy rewrites in `proxy.js` or `middleware.js` to connect to the backend.
- Send requests directly to the backend URL (`NEXT_PUBLIC_API_URL` in `.env`).
- For Client Components, use the centralized `apiFetch` utility located in `lib/api.js`. It automatically retrieves the token from the session and attaches it to the Authorization header.
- Import it like: `import { apiFetch } from "@/lib/api";` or `import { apiFetch } from "../lib/api";`.

## Design Principles

- **Modularity**: Always write MODULAR code. Break down complex React components and utility functions into smaller, highly reusable pieces.
- **SOLID**: Strictly FOLLOW SOLID Principles in all implementations to ensure maintainability and scalability.
- **UI Components**: ALWAYS prioritize using **shadcn/ui** components for any UI elements wherever possible. Avoid writing custom HTML elements (like raw `<button>`, `<input>`, etc.) if a shadcn equivalent exists.

## Accessibility Navigation Engine Context

1. **Product Context**: Building an accessibility-first web application focusing on one government-service workflow (scholarship form). MVP requires text-based voice-first navigation, with future STT/TTS integration. The navigation engine must work entirely with text input/output and remain completely independent of the voice layer.
2. **Core Architectural Principle**: The LLM is the reasoning/intent layer. The frontend is the execution layer. The LLM must NEVER directly manipulate the DOM. It produces constrained structured actions (e.g., `FILL_FIELD`, `NAVIGATE_STEP`).
3. **Action Vocabulary**: Supported actions: `NAVIGATE_STEP`, `NEXT`, `PREVIOUS`, `FILL_FIELD`, `CLEAR_FIELD`, `SELECT_OPTION`, `READ_FIELD`, `EXPLAIN_FIELD`, `UPLOAD_DOCUMENT`, `SUBMIT`. All LLM output must be structured JSON actions.
4. **Validation Boundary**: LLM interprets user intent. Application validates the resulting action (e.g., checking if a field exists and is valid) before modifying state.
5. **State Management**:
   - **Form Schema**: Describes steps, fields, labels, types, required status, etc.
   - **Form State**: Stores current user-entered data and completion status.
   - **Navigation State**: Explicit interaction state (mode, current step, current field, last action).
6. **Current Scope**: Implement Form schema/state, Navigation state, Action types/schema, LLM navigation interface, Action dispatcher, Validation layer, Text-based navigation UI, and Logging/debugging. Do NOT implement STT, TTS, document scanning, or external language APIs.
