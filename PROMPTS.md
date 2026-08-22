
# Accessibility Navigation Engine

## 1. Product Context

We are building an accessibility-first web application that helps users with visual, motor, cognitive, language, or low-digital-literacy barriers complete complex digital services independently.

For the MVP, we are focusing on **one government-service workflow** such as a scholarship/application form.

The application provides:

* Voice-first navigation
* Voice-based form filling
* Regional-language support
* Simplified explanations of complex form content
* Accessible, minimal UI
* Local document scanning assistance
* Automatic document capture
* Form validation and confirmation before submission

The system will eventually support STT and TTS, but the **first implementation of the navigation engine must work entirely with text input/output**.

---

# 2. Current Development Scope

Implement only the **Navigation Engine** first.

Current flow:

```text
User text
    ↓
LLM
    ↓
Structured Action JSON
    ↓
Action Dispatcher
    ↓
Application/Form State
    ↓
React UI
    ↓
Text response
```

Do NOT implement STT/TTS yet.

Later, STT will simply replace the text-input boundary and TTS will replace the text-output boundary.

The navigation engine must therefore remain completely independent of the voice layer.

---

# 3. Core Architectural Principle

The LLM is the **reasoning/intent layer**.

The frontend is the **execution layer**.

The LLM must NEVER directly manipulate the DOM, generate arbitrary JavaScript, select CSS selectors, or execute browser code.

Instead, the LLM produces a constrained structured action.

Example:

```json
{
  "action": "FILL_FIELD",
  "field": "annual_income",
  "value": 200000
}
```

The frontend validates and executes this action.

---

# 4. Form as Structured State

The application should use a schema-driven form.

Form schema describes:

* steps
* fields
* field IDs
* labels
* types
* required status
* allowed options
* descriptions/help text

Example:

```js
const formSchema = {
  id: "scholarship_application",
  steps: [
    {
      id: "personal",
      title: "Personal Information",
      fields: [
        {
          id: "full_name",
          label: "Full Name",
          type: "text",
          required: true
        },
        {
          id: "date_of_birth",
          label: "Date of Birth",
          type: "date",
          required: true
        }
      ]
    },
    {
      id: "financial",
      title: "Financial Information",
      fields: [
        {
          id: "annual_income",
          label: "Annual Family Income",
          type: "number",
          required: true
        }
      ]
    }
  ]
};
```

The current user-entered data should be stored separately:

```js
const formState = {
  currentStep: "personal",

  values: {
    full_name: "",
    date_of_birth: "",
    annual_income: null
  },

  completed: {
    full_name: false,
    date_of_birth: false,
    annual_income: false
  }
};
```

The React UI must derive itself from this state.

---

# 5. Action Vocabulary

The LLM must only return actions from a predefined action set.

Initial supported actions:

```text
NAVIGATE_STEP
NEXT
PREVIOUS
FILL_FIELD
CLEAR_FIELD
SELECT_OPTION
READ_FIELD
EXPLAIN_FIELD
UPLOAD_DOCUMENT
SUBMIT
```

The implementation may add more actions later, but arbitrary actions must not be accepted.

---

# 6. Action Examples

## Navigate

User:

> Go to financial details

LLM:

```json
{
  "action": "NAVIGATE_STEP",
  "target": "financial"
}
```

---

## Fill

User:

> My annual income is two lakh rupees

LLM:

```json
{
  "action": "FILL_FIELD",
  "field": "annual_income",
  "value": 200000
}
```

---

## Select option

User:

> I'm OBC

LLM:

```json
{
  "action": "SELECT_OPTION",
  "field": "category",
  "value": "OBC"
}
```

---

## Explain

User:

> What does annual income mean?

LLM:

```json
{
  "action": "EXPLAIN_FIELD",
  "field": "annual_income"
}
```

The application, not the LLM execution layer, should retrieve/generate the explanation.

---

## Navigation

User:

> Next

LLM:

```json
{
  "action": "NEXT"
}
```

The application should determine whether the current step is valid before moving forward.

---

# 7. Context Given to the LLM

Every navigation request should include only the relevant application context.

Example:

```json
{
  "user_input": "my income is two lakh",

  "current_step": {
    "id": "financial",
    "title": "Financial Information"
  },

  "current_field": {
    "id": "annual_income",
    "label": "Annual Family Income",
    "type": "number",
    "required": true
  },

  "form_values": {
    "full_name": "Ravi Kumar",
    "date_of_birth": "2004-04-12",
    "annual_income": null
  },

  "available_steps": [
    "personal",
    "financial",
    "documents",
    "review"
  ]
}
```

This contextual information should allow short commands such as:

> Two lakh.

to be interpreted correctly.

---

# 8. Validation Boundary

The LLM interprets user intent.

The application validates the resulting action.

Example:

LLM:

```json
{
  "action": "FILL_FIELD",
  "field": "annual_income",
  "value": 200000
}
```

Application checks:

```text
Does field exist?       YES
Is value numeric?       YES
Is value valid?         YES
Is field editable?      YES
```

Only then should the state be updated.

Never trust the LLM output directly.

---

# 9. Action Dispatcher

Create a centralized action dispatcher.

Conceptually:

```js
function executeAction(action) {
  switch (action.action) {
    case "FILL_FIELD":
      return fillField(action.field, action.value);

    case "NAVIGATE_STEP":
      return navigateToStep(action.target);

    case "NEXT":
      return goToNextStep();

    case "PREVIOUS":
      return goToPreviousStep();

    case "CLEAR_FIELD":
      return clearField(action.field);

    case "SELECT_OPTION":
      return selectOption(action.field, action.value);

    case "EXPLAIN_FIELD":
      return explainField(action.field);

    case "READ_FIELD":
      return readField(action.field);

    case "SUBMIT":
      return submitApplication();
  }
}
```

All actions must pass through this layer.

---

# 10. Navigation State

Maintain explicit interaction state in addition to form data.

Example:

```js
const navigationState = {
  mode: "FORM_FILLING",
  currentStep: "financial",
  currentField: "annual_income",
  lastAction: "FILL_FIELD",
  awaitingConfirmation: false
};
```

This allows contextual commands.

Example:

User:

> That's wrong.

If the previous action was:

```text
FILL_FIELD
```

the system can interpret this as a correction/re-entry flow rather than an unrelated command.

---

# 11. Intelligent NEXT behavior

NEXT should not blindly change the page.

Example:

```text
Name            ✓
Date of Birth   ✓
Category        ✓
Annual Income   ✗
```

User:

> Next

The application should respond:

> Your annual family income is still missing. Please tell me your annual income.

The navigation engine should be able to identify the next incomplete required field.

---

# 12. Explain / Simplify Capability

The product is also designed for cognitive and language accessibility.

Original website text may be complex:

> Applicant shall furnish documentary evidence in support of annual family income.

The accessibility layer should be able to represent this simply:

> Upload a document showing your family's yearly income.

This explanation layer should eventually support regional languages.

However, keep the navigation engine's internal actions language-independent.

---

# 13. Future Voice Integration

After the text navigation engine is stable, we will add:

```text
Voice
 ↓
STT
 ↓
Text
 ↓
Navigation Engine
 ↓
Action
 ↓
Response Text
 ↓
TTS
 ↓
Voice
```

The navigation engine itself must not depend on STT or TTS.

This is a hard architectural requirement.

---

# 14. Future Document Engine

Document capture is a separate subsystem.

Later:

```text
Camera
 ↓
Local document detection
 ↓
Position/tilt/size analysis
 ↓
Voice/vibration guidance
 ↓
Stable
 ↓
Auto capture
 ↓
OCR/document understanding
 ↓
Structured document data
 ↓
Form state
```

Do not tightly couple document scanning logic to the navigation engine.

The document engine will eventually emit actions/data such as:

```json
{
  "action": "FILL_FIELD",
  "field": "annual_income",
  "value": 180000
}
```

Therefore both voice input and document processing can feed the same Action Dispatcher.

---

# 15. Overall Architecture

```text
                    USER
                     │
        ┌────────────┴────────────┐
        │                         │
     Text/Voice                Camera
        │                         │
        ▼                         ▼
 Navigation Engine         Document Engine
        │                         │
        └────────────┬────────────┘
                     ▼
              Action Dispatcher
                     │
              Form / App State
                     │
                     ▼
                 React UI
```

The important design goal is:

**Multiple input modalities → one common action system.**

Text, voice, and document understanding should eventually be able to perform the same actions.

---

# 16. Current Task for the Coding Agent

For now, implement only:

1. Form schema
2. Form state
3. Navigation state
4. Action types/schema
5. LLM navigation interface
6. Action dispatcher
7. Validation layer
8. Text-based navigation UI
9. Logging/debugging of every generated action

Do not implement:

* STT
* TTS
* document scanning
* OCR
* external language APIs
* arbitrary DOM manipulation

The implementation should be modular so these can be added later without redesigning the navigation engine.


So first build highly modular form schema of scholarship application in india. 
For the LLM I want you to use Mimo v2 API I'll send you the documentation of it. firstt set the context in AGENTS.md and create plan for what is asked in this phase





# Voice Interaction Integration with Sarvam APIs

You are working on an existing accessibility-first web application.

The application's **text-based navigation and form-filling assistant is already implemented and working**.

Your task is to integrate **voice-based interaction using Sarvam APIs** into the existing pipeline without breaking or redesigning the current navigation architecture.

## FIRST: Understand the Existing System

Before writing code:

1. Inspect the entire project structure.
2. Read `doc.md` in the project root carefully.
3. Understand the existing:

   * navigation engine
   * LLM interaction
   * form state
   * action schema
   * action dispatcher
   * current conversation flow
   * frontend components
   * API/backend architecture
4. Trace exactly how the application currently works from:

   User input → LLM → navigation/action → form state → UI → assistant response.

Do not assume the architecture. Use the implementation and `doc.md` as the source of truth.

Do not replace working components unless absolutely necessary.

---

# CURRENT SYSTEM

The application currently works approximately like this:

```text
User types input
       ↓
Existing navigation / LLM pipeline
       ↓
Structured action / response
       ↓
Action dispatcher
       ↓
Form / navigation state
       ↓
React UI
       ↓
LLM response displayed on screen
       ↓
User provides next text input
```

This pipeline is already working.

We now want:

```text
User speaks
       ↓
Sarvam STT
       ↓
Text
       ↓
EXISTING navigation pipeline
       ↓
Action / response
       ↓
Existing state + UI updates
       ↓
Response text
       ↓
Sarvam TTS
       ↓
User hears response
```

The **existing navigation engine must remain the brain of the application**.

Sarvam is only responsible for converting:

```text
Speech → Text
```

and

```text
Text → Speech
```

---

# CORE ARCHITECTURAL RULE

Do NOT create a separate voice navigation system.

Do NOT create a second LLM pipeline specifically for voice.

Do NOT make Sarvam output actions.

Do NOT bypass the existing navigation/action dispatcher.

Instead:

```text
Voice
 ↓
STT
 ↓
existing text input pipeline
 ↓
existing LLM/navigation engine
 ↓
existing action dispatcher
 ↓
existing response generation
 ↓
TTS
```

Therefore, the same command should behave identically whether it comes from:

* typed text
* speech converted to text

For example:

Typed:

> my annual income is two lakh

Voice:

> my annual income is two lakh

Both must eventually enter the exact same existing navigation pipeline.

---

# SARVAM INTEGRATION

Use the official Sarvam API.

Before implementation, inspect the current Sarvam API documentation and use the API format/models supported by the existing project environment.

Do not hardcode API keys.

Use environment variables.

Example:

```env
SARVAM_API_KEY=...
```

Do not expose the API key to the browser if the current architecture allows the request to be safely proxied through the backend.

Prefer:

```text
Browser
   ↓
Backend voice endpoint
   ↓
Sarvam API
```

rather than exposing the Sarvam API key in frontend code.

Follow the project's existing backend architecture from `doc.md`.

---

# 1. SPEECH-TO-TEXT

Implement a voice-input flow.

Expected behavior:

1. User activates the microphone.
2. UI enters `LISTENING` state.
3. Capture microphone audio.
4. Send the audio to the backend/Sarvam STT endpoint.
5. Receive transcribed text.
6. Pass the resulting text directly into the existing navigation pipeline.
7. Do NOT create a second interpretation layer.
8. Show the recognized text on the UI so the user can see what the system understood.
9. Continue through the existing navigation flow.

Example:

```text
User speaks:
"nanage scholarship application open madbeku"

        ↓

Sarvam STT

        ↓

"nanage scholarship application open madbeku"

        ↓

Existing navigation engine

        ↓

Existing action

        ↓

Existing UI
```

---

# 2. LANGUAGE SUPPORT

The user must be able to select the interaction language.

At minimum support:

* English
* Kannada
* Hindi

The selected language should be stored in application state.

For example:

```ts
type SupportedLanguage =
  | "en-IN"
  | "kn-IN"
  | "hi-IN";
```

Use the selected language when requesting STT/TTS from Sarvam.

The rest of the navigation engine should remain language-agnostic.

Do not create separate navigation logic for Kannada, Hindi, and English.

---

# 3. CODE-SWITCHING

Users may naturally mix English with regional languages.

Examples:

```text
"Scholarship application open maadi"

"Income two lakh ide"

"Documents section ge hogi"
```

The system should pass Sarvam's recognized text through unchanged to the existing navigation pipeline.

Do NOT force every spoken sentence through an English translation step before the existing LLM unless the existing architecture explicitly requires it.

The existing LLM should remain responsible for understanding the user's intent.

---

# 4. TEXT-TO-SPEECH

Currently the application displays the assistant's message as text.

Keep that behavior.

Additionally, after the assistant generates a response:

```text
Assistant response text
        ↓
Sarvam TTS
        ↓
Audio
        ↓
Play to user
```

The response should still be displayed visually.

Voice should be an additional interaction channel, not a replacement for the existing UI.

Example:

Current:

```text
Assistant:
"What is your annual family income?"
```

New:

```text
Assistant:
"What is your annual family income?"

🔊 playing...
```

The user should be able to hear the same response.

---

# 5. DO NOT SPEAK EVERY UI EVENT

Do not automatically send every frontend text to TTS.

Only speech-generating assistant responses should normally be spoken.

Do not TTS things such as:

* debug logs
* technical errors
* internal state
* arbitrary UI labels
* hidden metadata

The voice layer should consume the same user-facing assistant response that is already rendered in the existing conversation UI.

---

# 6. VOICE CONTROLLER

Create a dedicated voice abstraction.

Conceptually:

```ts
interface VoiceController {
  startListening(): Promise<void>;
  stopListening(): void;
  transcribe(audio: Blob): Promise<string>;
  speak(text: string, language: SupportedLanguage): Promise<void>;
  stopSpeaking(): void;
}
```

Use a clean abstraction so the rest of the application does not depend directly on Sarvam.

Example architecture:

```text
VoiceController
      ↓
SarvamVoiceProvider
      ↓
Sarvam APIs
```

This allows the provider to be replaced later without rewriting the navigation system.

---

# 7. VOICE UI STATES

The UI must clearly represent the voice state.

Implement explicit states:

```ts
type VoiceState =
  | "IDLE"
  | "LISTENING"
  | "PROCESSING"
  | "SPEAKING"
  | "ERROR";
```

Expected UX:

### IDLE

Show microphone button.

### LISTENING

Show that the application is actively listening.

Example:

```text
🎙 Listening...
```

### PROCESSING

After the user finishes speaking:

```text
Processing...
```

The microphone should not appear active during this state.

### SPEAKING

When TTS is playing:

```text
🔊 Speaking...
```

Provide a way to interrupt/stop speech.

### ERROR

Show a human-readable message such as:

```text
Couldn't understand that.
Please try again.
```

Do not expose raw API errors to the user.

---

# 8. MICROPHONE INTERACTION

Do not automatically keep the microphone permanently active.

Prefer:

```text
Tap microphone
      ↓
Listening
      ↓
User speaks
      ↓
Stop recording
      ↓
STT
      ↓
Navigation
```

Use an appropriate mechanism to determine when the user has finished speaking.

If browser-native speech activity detection is used, keep it modular and easy to replace.

Avoid creating a complicated custom audio pipeline unless required.

---

# 9. PREVENT DUPLICATE PROCESSING

Important:

The same voice interaction must never enter the navigation engine twice.

Implement protection against:

* double microphone clicks
* duplicate audio submission
* repeated API responses
* repeated TTS playback
* stale async responses

There should be a clear lifecycle:

```text
IDLE
 ↓
LISTENING
 ↓
PROCESSING
 ↓
NAVIGATION
 ↓
SPEAKING
 ↓
IDLE
```

Do not allow a new recording while the application is processing the previous one unless the existing architecture explicitly supports interruption.

---

# 10. INTERRUPTION / BARGE-IN

The user should be able to interrupt TTS.

For example:

Assistant:

> "Your annual income is two lakh rupees. Would you like to continue?"

User presses microphone.

The current TTS playback should stop before the new interaction begins.

Implement:

```ts
stopSpeaking()
```

and make sure audio resources are cleaned up correctly.

---

# 11. CONVERSATION CONTEXT

Do not create a separate voice conversation history.

The existing conversation state remains the source of truth.

Voice input should simply produce:

```text
recognizedText
```

and feed it into the same existing message/navigation flow as typed input.

Example:

```ts
handleUserInput(transcribedText);
```

Use the project's existing function/pipeline if one already exists instead of duplicating it.

---

# 12. TTS CACHING

For repeated/static messages, consider caching generated audio.

Especially useful for short accessibility responses such as:

* "Listening..."
* "Please try again."
* "Document detected."
* "Hold still."
* "Processing..."
* "Done."

Do not repeatedly call Sarvam for identical static phrases.

However, do not over-engineer caching during the first implementation.

Get dynamic voice interaction working first.

---

# 13. ERROR HANDLING

Handle at least:

### Microphone permission denied

Show:

```text
Microphone access is required for voice interaction.
Please allow microphone access in your browser.
```

### STT failure

```text
I couldn't understand that.
Please try again.
```

### TTS failure

The assistant response should still remain visible on screen.

Example:

```text
Voice playback failed, but the response is still available on screen.
```

### Sarvam API failure

Do not crash the existing navigation system.

Voice failure must gracefully degrade to the existing text interface.

This is extremely important.

---

# 14. PERFORMANCE

The existing navigation engine should not become slower because voice support was added.

The pipeline should be:

```text
Audio
 ↓
STT
 ↓
Existing navigation
 ↓
TTS
```

Do not add unnecessary:

```text
STT
 ↓
Translation
 ↓
LLM
 ↓
Translation
 ↓
TTS
```

unless the existing application architecture explicitly requires it.

Keep the number of network calls minimal.

---

# 15. FRONTEND BEHAVIOR

The current interface already displays:

* assistant message
* user message
* input
* form/navigation state

Keep all of that.

Add:

* microphone button
* current voice state
* recognized speech preview
* speaking indicator
* stop-speaking control

Do not redesign unrelated existing pages.

The new voice interaction should feel like a natural extension of the existing assistant.

---

# 16. BACKEND API DESIGN

Use the existing backend conventions from `doc.md`.

Prefer dedicated endpoints such as:

```text
POST /api/voice/transcribe
POST /api/voice/speak
```

or adapt to the project's existing API organization.

The frontend should not contain Sarvam-specific business logic beyond calling the application's voice service.

Example:

```text
React
 ↓
voiceService
 ↓
backend API
 ↓
Sarvam
```

The backend is responsible for:

* authentication if applicable
* API key handling
* forwarding requests
* handling Sarvam errors
* returning clean application-level responses

---

# 17. Logging / Debugging

During development, log the pipeline clearly.

For example:

```text
[VOICE] Recording started
[VOICE] Recording stopped
[VOICE] Sending audio to STT
[VOICE] STT result: "my income is two lakh"
[NAVIGATION] Passing text to existing engine
[NAVIGATION] Action generated: FILL_FIELD
[VOICE] Starting TTS
[VOICE] TTS completed
```

Do not log sensitive user information in production.

---

# 18. Testing

After implementation, test the same navigation commands using both:

### Text

```text
My annual income is two lakh
```

### Voice

```text
My annual income is two lakh
```

Both must produce identical application behavior.

Test:

* navigation
* field filling
* option selection
* next/previous
* explain field
* validation errors
* document-related actions if already supported
* confirmation
* submit flow

Also test:

* English
* Kannada
* Hindi
* mixed English/regional language
* microphone permission denial
* API failure
* TTS failure
* repeated microphone presses
* interruption during TTS

---

# 19. Important Constraints

Do NOT:

* rewrite the navigation engine
* create another LLM agent
* create separate voice-specific navigation logic
* let Sarvam produce navigation actions
* expose API keys in frontend code
* directly manipulate arbitrary DOM elements from LLM output
* break the current text-based flow
* replace visible assistant messages with audio-only responses

The final architecture should remain:

```text
             ┌──────────────┐
             │ Text Input   │
             └──────┬───────┘
                    │
                    │
             ┌──────▼───────┐
             │              │
             │   EXISTING   │
Voice ───────► NAVIGATION   │
 ↓           │   ENGINE     │
STT          │              │
             └──────┬───────┘
                    │
                    ▼
             Existing Actions
                    │
                    ▼
                Form State
                    │
                    ▼
                    UI
                    │
                    ▼
              Assistant Text
                    │
                    ▼
                  TTS
                    │
                    ▼
                  Voice
```

## Final Goal

After implementation, the user should be able to complete the entire existing workflow without typing.

Example:

```text
User:
🎙 "I want to apply for a scholarship."

System:
[existing navigation engine]

🔊 "Sure. Let's start with your personal information."

User:
🎙 "My name is Ravi Kumar."

System:
[existing form filling engine]

🔊 "Got it. Your name is Ravi Kumar."

User:
🎙 "Next."

System:
[existing navigation engine]

🔊 "What is your annual family income?"

...
```

The user should experience this as **one continuous voice-first interaction**, while internally the application continues to use the exact same navigation and form-filling engine that already exists.

## Implementation Process

Before modifying files:

1. Read `doc.md`.
2. Trace the existing text-input → LLM → action → state → response flow.
3. Identify the exact entry point for user text.
4. Identify the exact place where assistant response text is produced.
5. Integrate STT before the existing text entry point.
6. Integrate TTS after the existing assistant response point.
7. Keep the changes modular.
8. Run the existing application and verify the original text flow still works.
9. Then test the complete voice flow.

Do not start by rewriting components. First understand and reuse the existing architecture.


You are extending an existing accessibility-first web application.

The existing application already contains:

* Text-based navigation engine
* LLM-based navigation/action generation
* Structured form state
* Form filling/action dispatcher
* Sarvam STT/TTS voice interaction
* Regional-language support
* Existing application/document upload flow
* Existing UI and project architecture

The current architecture and implementation details are documented in the project's `docuement.md`.

Your task is to implement a **local document capture and verification assistant** for visually impaired and low-vision users.

---

# 1. FIRST: UNDERSTAND THE EXISTING SYSTEM

Before writing code:

1. Read `docuement.md` completely.
2. Inspect the project structure.
3. Understand:

   * current navigation engine
   * form schema/state
   * action dispatcher
   * voice pipeline
   * language handling
   * existing document upload flow
   * existing backend architecture
   * existing UI components
4. Identify where document upload currently happens.
5. Integrate with the existing architecture instead of creating parallel systems.

Do not rewrite the existing navigation or voice engine.

---

# 2. ACTUAL DOCUMENT ENGINE REQUIREMENT

IMPORTANT:

The document engine is **NOT responsible for extracting form-field data from documents.**

Do NOT implement:

```text
OCR
→ extract name
→ extract income
→ fill form fields
```

That is NOT the requirement.

Instead, the document engine must answer two questions:

### Question 1

**Is this the correct type of document for the current upload field?**

Example:

Current field:

> Upload Income Certificate

User scans a document.

The system should determine whether the captured document appears to be an income certificate.

### Question 2

**Is the document sufficiently readable / usable?**

The system should detect whether:

* text is sufficiently visible
* document is reasonably sharp
* document isn't excessively blurred
* document isn't excessively dark
* document isn't severely cropped
* document is reasonably aligned
* important text is likely readable

If both conditions are satisfied:

```text
Correct document
+
Readable document
=
Accept
```

Otherwise:

```text
Wrong document
OR
Unreadable document
=
Ask user to scan again
```

---

# 3. CORE USER EXPERIENCE

The final experience should be:

```text id="a4ks61"
User reaches:

"Upload Income Certificate"

        ↓

Assistant:

"Let's scan your income certificate.
You don't need to press anything."

        ↓

Camera opens

        ↓

Local CV detects document

        ↓

Voice guidance:

"Move slightly right."

"Move closer."

"Hold still."

        ↓

Stable

        ↓

Automatic capture

        ↓

Image preprocessing

        ↓

OCR / readability analysis

        ↓

Document verification

        ↓

Result:

✓ Correct document
✓ Text is readable

        ↓

Assistant:

"Your income certificate looks good.
Would you like to use this document?"

        ↓

User:

"Yes."

        ↓

Existing upload/form pipeline
```

---

# 4. HIGH-LEVEL ARCHITECTURE

Implement the following architecture:

```text id="3qv6f8"
Camera
   ↓
Local Frame Processing
   ↓
Document Detection
   ↓
Geometry Analysis
   ↓
Guidance Engine
   ↓
Voice + Visual + Haptic Feedback
   ↓
Stable Document
   ↓
Automatic Capture
   ↓
Image Preprocessing
   ↓
┌───────────────────────────────┐
│ Local Document Verification   │
│                               │
│ 1. Document type verification │
│ 2. Readability verification   │
└───────────────┬───────────────┘
                ↓
         Accept / Retry
                ↓
       Existing Upload Flow
```

The real-time scanning and guidance loop must be local.

Do NOT send every camera frame to a cloud API.

Do NOT use an LLM for real-time document positioning.

---

# 5. CAMERA ENGINE

Use browser camera APIs through `getUserMedia()`.

Prefer the rear camera on mobile:

```js
{
  video: {
    facingMode: "environment"
  }
}
```

Use a lower-resolution processing frame for real-time CV.

Example:

```text id="b5hkyr"
Camera:
1920 × 1080

Detection:
640 × 360
```

The final accepted document should preserve a high-resolution capture.

---

# 6. LOCAL DOCUMENT DETECTION

Use a lightweight browser-compatible CV approach.

Prefer OpenCV.js or another appropriate local CV library.

Initial pipeline:

```text id="9v7by5"
Frame
 ↓
Resize
 ↓
Grayscale
 ↓
Blur / denoise
 ↓
Edge detection
 ↓
Contour detection
 ↓
Polygon approximation
 ↓
Find document-like quadrilateral
```

Detect:

```text id="8z1bmc"
topLeft
topRight
bottomRight
bottomLeft
```

and calculate:

```text id="1xp9zu"
center
width
height
area
aspect ratio
rotation
confidence
```

---

# 7. DOCUMENT GEOMETRY

Use geometry to determine whether the user needs to adjust the phone.

Calculate:

### Horizontal position

```text
Document too far left
→ "Move slightly right."

Document too far right
→ "Move slightly left."
```

### Vertical position

```text
Document too high
→ "Move slightly down."

Document too low
→ "Move slightly up."
```

### Distance

Using document/frame area ratio:

```text
Document too small
→ "Move closer."

Document too large
→ "Move slightly back."
```

### Rotation

```text
Too much tilt
→ "Tilt your phone slightly."
```

Do all of this locally.

---

# 8. GUIDANCE MUST BE ACCESSIBLE

The user may be completely blind.

Therefore the scanner must not depend on visual feedback.

Provide:

### Voice guidance

Examples:

```text
"Find the document."

"Document detected."

"Move slightly left."

"Move slightly right."

"Move closer."

"Move slightly back."

"Hold still."

"Document captured."
```

### Visual guidance

Show:

* document boundary
* alignment
* state
* progress
* capture status

### Haptic feedback

Use browser vibration where supported.

Keep haptic feedback optional.

---

# 9. DO NOT SPAM THE USER

The scanner must not repeatedly speak the same instruction every frame.

Bad:

```text
Move left.
Move left.
Move left.
Move left.
```

Good:

```text
Alignment state changes
        ↓
Speak instruction once
        ↓
Wait for meaningful change
```

Use cooldown/debouncing.

The scanner should behave like a state machine rather than a frame-by-frame narrator.

---

# 10. SCANNER STATE MACHINE

Use explicit scanner states.

Suggested:

```ts
type ScannerState =
  | "IDLE"
  | "INITIALIZING_CAMERA"
  | "SEARCHING"
  | "DOCUMENT_DETECTED"
  | "ALIGNING"
  | "STABILIZING"
  | "CAPTURING"
  | "PROCESSING"
  | "VERIFYING"
  | "RESULT"
  | "ERROR";
```

Keep scanner state management separate from React rendering logic as much as practical.

---

# 11. STABILITY DETECTION

Do not capture the first frame that looks good.

Track document geometry over multiple frames.

Monitor:

* center movement
* corner movement
* area variation
* angle variation

Example:

```text id="5zq36s"
Good alignment
Good alignment
Good alignment
Good alignment
        ↓
Stable
        ↓
Capture
```

Use a configurable stability window of a few hundred milliseconds.

---

# 12. AUTOMATIC CAPTURE

When:

* document detected
* correctly aligned
* correct approximate size
* acceptable rotation
* stable

automatically capture a high-resolution frame.

The user should not need to find a shutter button.

Sequence:

```text
"Hold still."
        ↓
Capture
        ↓
"Document captured."
```

---

# 13. PERSPECTIVE CORRECTION

Use the four detected document corners to straighten the image.

```text id="br5v8j"
Skewed document
      ↓
Four corners
      ↓
Perspective transform
      ↓
Rectified document
```

Keep both:

```text
originalCapture
rectifiedDocument
```

The rectified image should be used for verification/OCR.

---

# 14. IMAGE QUALITY / READABILITY VERIFICATION

This is now a **primary feature**.

The application should determine whether the captured document is sufficiently readable.

Do NOT attempt to extract form values.

Instead, calculate quality indicators such as:

* blur/sharpness
* brightness
* contrast
* text visibility
* excessive glare where detectable
* document completeness
* crop quality
* perspective quality

Possible checks:

### Sharpness

Use a measure such as variance of Laplacian or another lightweight blur metric.

Conceptually:

```text
Sharpness below threshold
→ document too blurry
```

### Brightness

```text
Too dark
→ "The document is too dark. Try moving to a brighter area."
```

### Contrast

Low contrast may indicate that text will be difficult to read.

### Document completeness

Ensure the detected document isn't significantly cropped.

### OCR text quantity

OCR may be used as a secondary readability signal:

```text
Expected document contains text
        ↓
OCR finds almost no useful text
        ↓
Likely unreadable / poor capture
```

The OCR output itself should NOT be used to populate form fields.

---

# 15. DOCUMENT TYPE VERIFICATION

The current upload field should specify the expected document.

Example schema:

```js
{
  id: "income_certificate",
  label: "Income Certificate",
  expectedDocument: "income_certificate"
}
```

The scanner receives this requirement.

After capture:

```text
Expected:
Income Certificate

Captured:
???
```

The system needs to determine whether the captured image appears to be the expected document.

Possible implementation approaches can include:

* OCR keyword matching
* document-specific text signatures
* template/layout matching
* lightweight image classification
* a post-capture document classification model/API if needed

Start with the simplest reliable local approach.

For example, if an income certificate typically contains terms such as:

```text
Income Certificate
Annual Income
Certificate Number
```

use OCR text as evidence.

Do not require exact text matching because documents can vary.

Produce:

```ts
interface DocumentVerificationResult {
  expectedType: string;
  detectedType: string | null;
  documentMatch: boolean;
  matchConfidence: number;
}
```

---

# 16. OCR LANGUAGE SUPPORT

OCR exists primarily for:

1. readability verification
2. document-type verification

It is NOT for form-field extraction.

Initial OCR languages:

```text
English
Kannada
```

Do NOT include Hindi OCR for the MVP.

Do not load all OCR language data during initial application startup.

Load the required language model only when needed.

Example:

```text id="k7p2kn"
User selects Kannada
        ↓
Load Kannada OCR data
```

and:

```text id="m1hfxp"
User selects English
        ↓
Load English OCR data
```

The OCR architecture should remain modular so additional languages can be added later.

---

# 17. LOCAL OCR REQUIREMENTS

OCR should run locally where practical.

Use a browser-compatible WASM OCR implementation if appropriate.

Potential approach:

```text id="0vl1a0"
Captured image
      ↓
Rectified image
      ↓
Preprocessing
      ↓
OCR Worker
      ↓
Raw OCR text
```

Use a Web Worker if OCR is computationally heavy.

Do not freeze the React UI.

Lazy-load OCR resources.

Do not load Kannada OCR resources until Kannada OCR is actually needed.

---

# 18. OCR RESULT

The OCR result should remain internal to the document verification subsystem.

Example:

```ts
interface OCRResult {
  text: string;
  confidence?: number;
  blocks?: OCRBlock[];
}
```

This result should NOT automatically update form values.

There should be no behavior such as:

```text
OCR:
Annual Income = ₹2,00,000

→ Automatically fill form
```

That is explicitly out of scope.

---

# 19. FINAL VERIFICATION RESULT

The verification engine should produce something like:

```ts
interface VerificationResult {
  documentMatch: boolean;
  documentConfidence: number;

  readable: boolean;
  readabilityConfidence: number;

  quality: {
    sharpness: number;
    brightness: number;
    contrast: number;
    cropQuality: number;
    perspectiveQuality: number;
  };

  reason?: string;
}
```

The final decision can be:

```text
ACCEPT
RETRY
```

Examples:

### Correct + readable

```text
✓ Correct document
✓ Document is readable
```

→ Accept

### Wrong document

```text
✗ This does not appear to be an income certificate.
```

→ Retry

### Correct but blurry

```text
✓ Income certificate detected
✗ The text is too blurry to read
```

→ Retry

### Correct but too dark

```text
✓ Income certificate detected
✗ The document is too dark
```

→ Retry

---

# 20. VOICE FEEDBACK FOR VERIFICATION

Reuse the existing Sarvam TTS system.

Examples:

### Accepted

> "This looks like a valid income certificate and the text is readable. Would you like to use this document?"

### Wrong document

> "This does not appear to be an income certificate. Please scan the correct document."

### Poor readability

> "The document is too blurry to read. Please scan it again while holding the phone steady."

### Poor lighting

> "The document is too dark. Try moving to a brighter area."

Do not create another TTS system.

---

# 21. USER CONFIRMATION

The scanner should not immediately upload the image after verification.

Show:

```text
✓ Income Certificate detected
✓ Text appears readable

[Use this document]
[Scan again]
```

And allow voice commands:

```text
"Use this document."

"Scan again."
```

These commands should go through the application's existing voice/navigation pipeline where possible.

---

# 22. EXISTING UPLOAD INTEGRATION

Once the user confirms the document:

```text
Verified document
      ↓
Existing upload flow
```

Do not create a parallel upload architecture.

The document engine should return the captured/processed file/blob to the existing document upload component or action.

---

# 23. IMPORTANT: KEEP DOCUMENT ENGINE INDEPENDENT

Separate these responsibilities:

### CameraEngine

Camera stream and frame management.

### DocumentDetector

Find document geometry.

### GuidanceEngine

Determine:

* left/right
* closer/farther
* tilt
* stable

### CaptureEngine

Automatically capture when stable.

### ImageProcessor

Perspective correction and preprocessing.

### OCRService

Local OCR.

### DocumentVerifier

Determine:

* correct document?
* readable?
* acceptable quality?

### Existing Upload System

Store/upload the verified document.

Do not create one giant scanner component containing all functionality.

---

# 24. PERFORMANCE REQUIREMENTS

The real-time loop must remain local.

The following should NOT use network requests:

```text
document positioning
left/right guidance
distance guidance
tilt guidance
stability detection
automatic capture
basic image-quality checks
```

These should be performed locally.

OCR happens only after capture.

Document verification happens only after capture.

Do not process OCR on every camera frame.

---

# 25. MEMORY / RESOURCE MANAGEMENT

The application will run on mobile.

Avoid:

* repeated full-resolution frame allocations
* unnecessary base64 conversions
* duplicated image buffers
* repeatedly creating OpenCV objects
* loading OCR models unnecessarily

Reuse resources where practical.

Release:

* camera streams
* video tracks
* workers
* OpenCV matrices
* OCR resources

when the scanner closes.

---

# 26. DEBUG MODE

Create a development/debug mode where useful.

Display:

```text
Document confidence: 0.92
Area ratio: 0.61
Center offset: +8, -4
Angle: 2.1°
Sharpness: 143
Brightness: 0.61
OCR text detected: YES
OCR confidence: 0.89
Document match: 0.94
Scanner state: STABILIZING
```

Do not expose this to normal users.

Make thresholds configurable so they can be tuned quickly with real sample documents.

---

# 27. TEST CASES

Test:

### Positioning

* document too far left
* document too far right
* document too high
* document too low
* too close
* too far
* rotated
* moving phone
* hand shake
* stable document

### Document quality

* sharp
* blurry
* dark
* overexposed
* low contrast
* glare
* partial crop
* folded/curved document where possible

### Document correctness

* correct income certificate
* wrong document
* unrelated PDF/photo
* visually similar document

### OCR

* English document
* Kannada document
* unreadable document
* partial text
* low-quality text

### Accessibility

* completely blind interaction
* voice-only confirmation
* voice retry
* microphone unavailable
* camera permission denied

---

# 28. IMPLEMENTATION ORDER

Implement incrementally:

### Phase 1

Camera preview.

### Phase 2

Local document detection.

### Phase 3

Geometry calculations.

### Phase 4

Position / distance / tilt guidance.

### Phase 5

Stability detection.

### Phase 6

Automatic high-resolution capture.

### Phase 7

Perspective correction.

### Phase 8

Local image-quality checks.

### Phase 9

Local OCR.

### Phase 10

Document-type verification.

### Phase 11

Verification result UI.

### Phase 12

Connect verified document to existing upload flow.

### Phase 13

Integrate existing Sarvam TTS for verification messages.

Do not implement everything at once.

---

# 29. FINAL EXPERIENCE

The final experience should feel like this:

```text
Upload Income Certificate

        ↓

"Let's scan your income certificate."

        ↓

Camera opens

        ↓

Local CV:

"Move slightly right."

        ↓

User moves phone

        ↓

"Move closer."

        ↓

"Hold still."

        ↓

AUTO CAPTURE

        ↓

Local processing

        ↓

Verification:

✓ Appears to be an income certificate
✓ Text is readable
✓ Document isn't badly cropped

        ↓

"Your income certificate looks good.
Would you like to use this document?"

        ↓

User:
"Yes."

        ↓

Existing upload flow

        ↓

Continue application
```

---

# HARD CONSTRAINTS

Do NOT:

* extract form-field values from OCR
* automatically populate form values from documents
* send camera frames to an LLM
* send camera frames to Sarvam
* use cloud APIs for real-time camera guidance
* build a second navigation engine
* build a second voice engine
* bypass the existing Action Dispatcher
* upload a document before user confirmation
* block the React main thread with heavy CV/OCR work
* load Hindi OCR models
* load every OCR language model at startup
* expose API keys in frontend code

The core principle is:

**The document engine helps the user capture the correct document and verify that it is readable. It does not understand or populate the application's form data.**

Architecture:

```text
                 DOCUMENT ASSIST
                       │
                       ▼
                    Camera
                       │
                       ▼
                  Local CV
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
      Guidance                  Detection
          │                         │
          └────────────┬────────────┘
                       ▼
                 Stable Capture
                       │
                       ▼
              Image Preprocessing
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
       Quality                    OCR
       Analysis                    │
          │                        ▼
          │                  Text Evidence
          │                        │
          └────────────┬───────────┘
                       ▼
              Document Verifier
                       │
                ┌──────┴──────┐
                ▼             ▼
              ACCEPT         RETRY
                │
                ▼
         Existing Upload Flow
```

Implement this incrementally after reading `docuement.md`, and preserve all existing navigation, form-filling, and voice functionality.
