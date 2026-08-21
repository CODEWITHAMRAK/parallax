## Backend API Response Conventions

- All backend endpoints MUST use `sendSuccess` or `sendError` from `backend/utils/response.js` for formatting JSON responses.
- The response format is strictly: `{ success: boolean, message: string, data?: any, error?: string }`.
- When fetching in the frontend, remember that your expected payload is nested inside the `.data` property of the JSON response.

## Design & Architecture Principles

- **Modularity & SOLID**: Always write MODULAR code and strictly FOLLOW SOLID Principles.
- **Separation of Concerns**: Never define routing and business logic in the same file (e.g. `server.js`). Break down logic into specific folders:
  - `routes/`: Strictly for routing logic (defining endpoints, applying middleware, and delegating to controllers).
  - `controllers/`: Strictly for handling request/response logic and bridging the routes to the business logic.
  - `services/`: Strictly for complex business logic, database operations, and external API calls (e.g. auth providers). Keep controllers thin.
  - `models/`: For database schemas and models.
  - `middleware/`: For request interceptors (e.g., authentication).
  - `utils/`: For shared utility functions (e.g., response formatters).
