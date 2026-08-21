# Accessibility Navigation Engine - Project Context

## 1. Product Context
Building an accessibility-first web application focusing on one government-service workflow (scholarship form). MVP requires text-based voice-first navigation, with future STT/TTS integration. The navigation engine must work entirely with text input/output and remain completely independent of the voice layer.

## 2. Core Architectural Principle
- **LLM**: The reasoning/intent layer.
- **Frontend**: The execution layer. 
The LLM must NEVER directly manipulate the DOM. It produces constrained structured actions (e.g., `FILL_FIELD`, `NAVIGATE_STEP`).

## 3. Action Vocabulary
Supported actions: `NAVIGATE_STEP`, `NEXT`, `PREVIOUS`, `FILL_FIELD`, `CLEAR_FIELD`, `SELECT_OPTION`, `READ_FIELD`, `EXPLAIN_FIELD`, `UPLOAD_DOCUMENT`, `SUBMIT`.
All LLM output must be structured JSON actions.

## 4. Validation Boundary
LLM interprets user intent. Application validates the resulting action before modifying state.

## 5. State Management
- **Form Schema**: Describes steps, fields, labels, types, required status, etc.
- **Form State**: Stores current user-entered data and completion status.
- **Navigation State**: Explicit interaction state (mode, current step, current field, last action).

## 6. Directory Structure
- **`frontend/`**: Contains the React/Next.js application, UI components, action dispatcher, state management, and schema configurations.
- **`backend/`**: Contains the server logic, including secure interactions with external APIs like the Mimo v2 LLM, to protect API keys.

## 7. UI Design Conventions (from DESIGN.md)
- **Style**: Soft Minimalism, Tactile Functionalism, Heavy Whitespace.
- **Typography**: Atkinson Hyperlegible Next (primary) for clarity, fallback Noto Sans for Indic languages. Minimum line height 1.5x.
- **Colors**: Deep Teal (#003441) for primary actions, warm off-white (#fcf9f8) for background, Charcoal for text (high contrast). No pure white backgrounds for main surface to reduce glare.
- **Layout**: 8px Grid, 48x48px min touch targets, 800px max content width.
- **Elevation**: Tonal Layering, pure white cards with soft plinth shadows. Interactive elements use 4px solid Primary Teal border on focus.
- **Shapes**: 0.5rem (8px) base radius, 1rem (16px) for large containers.
