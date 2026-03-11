# Content Workspace — Full Architecture Reference

> Last updated: March 2026 (v1.8.0)
> Purpose: Complete system architecture, middleware, module inventory, and inter-module connection map.

---

## 1. Technology Stack

| Layer | Technology |
|---|---|
| UI Framework | React 19 (Vite, TypeScript) |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Backend / DB | Firebase (Firestore + Auth) |
| AI | Google Gemini via `@google/genai` SDK |
| File Parsing | pdfjs-dist, JSZip, mammoth, xlsx, papaparse |
| Routing | Client-side state (`AppPage` union in `types.ts`) |

---

## 2. Application Entry & Routing

### `App.tsx`
Single-page app with no URL router. Navigation is a React `useState<AppPage>` lifted to `App`. All routing goes through `renderContent()` — a switch statement mapping `AppPage` values to lazy-loaded components.

```
App.tsx
  └── useState<AppPage>('dashboard')
        └── renderContent() switch
              ├── 'dashboard'          → Dashboard
              ├── 'tn-standardiser'    → TNStandardiser
              ├── 'thematic-qa'        → ThematicQA
              ├── ...all other pages
              └── default              → Dashboard
```

**Lazy loading:** Every tool component is wrapped in `React.lazy()` + `Suspense`. Spinner shown during load.

### `types.ts` — `AppPage` union
Single source of truth for all valid page IDs. Every new page **must** be added here.

---

## 3. Authentication

### `services/firebase.ts`
Initialises Firebase app (singleton guard), exports `auth` (Firebase Auth) and `db` (Firestore).

### `context/AuthContext.tsx`
React context exposing `{ user, isAdmin, loading }`. All components that need auth import from here. Admin status is read from a Firestore `users/{uid}` document field.

**Auth gate:** `App.tsx` renders `<LoginForm />` if `!user`. No route is accessible unauthenticated.

---

## 4. Sidebar Navigation System

> Full detail in `AI_Implementation.md` → Sidebar Nav System section.

### Sources of truth (must stay in sync manually)

| File | Role |
|---|---|
| `components/Sidebar.tsx` — `FALLBACK_GROUPS` | Hardcoded fallback nav used when Firestore is unavailable |
| `components/AdminConsoleModal.tsx` — `repairNavigation()` | Writes `initialConfig` to Firestore — the Admin "Repair" button |
| `default_nav.md` | Human-readable doc only — not read by any code |

### Runtime flow
1. `Sidebar.tsx` opens `onSnapshot` on `navigation/sidebar_config` (Firestore)
2. If doc exists + has groups → use Firestore groups
3. If missing/empty/error → use `FALLBACK_GROUPS`
4. `navGroups` → filtered by search (useMemo) → rendered as collapsible `NavGroup` + `NavLink` buttons
5. `NavLink` click → `onNavigate(page)` → App state update → `renderContent()` re-renders

### Admin Nav Controls
- **Navigation tab** in Admin Console → drag-and-drop reorder → `saveNavigation()` → `setDoc` to Firestore
- **Repair button** → `repairNavigation()` → overwrites Firestore with hardcoded `initialConfig`

### Adding a new page (required steps)
1. `types.ts` — add to `AppPage` union
2. `App.tsx` — add lazy import + `case` in `renderContent()`
3. `Sidebar.tsx` `FALLBACK_GROUPS` — add item to correct group
4. `AdminConsoleModal.tsx` `repairNavigation()` — add same item to `initialConfig`
5. `default_nav.md` — update docs

---

## 5. AI Governance Layer (`lib/`)

All AI tooling must route through this layer. Direct instantiation of `GoogleGenAI` elsewhere is forbidden.

### `lib/aiClient.ts`
Single shared `GoogleGenAI` instance. Fails fast on missing `API_KEY`. All AI tools import `ai` from here — no exceptions.

```
lib/aiClient.ts
  └── export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY })
```

### `lib/modelRegistry.ts`
Maps capability tiers to concrete model strings. Centralises model selection — changing a model requires editing one file.

```
CapabilityTier: 'default' | 'reasoning' | 'vision'

TIER_MODEL_MAP:
  default   → 'gemini-3-flash-preview'
  reasoning → 'gemini-3-pro'
  vision    → 'gemini-3-flash-preview'
```

### `lib/toolTierResolver.ts`
Per-call async resolver. Reads `tool_settings/{toolId}` from Firestore, validates against the tool's declared `ALLOWED_TIERS`, falls back to `'default'` silently on error.

```
getResolvedModelForTool(toolId, allowedTiers)
  └── reads Firestore tool_settings/{toolId}
  └── validates capabilityTier against allowedTiers
  └── returns { tier, model }
```

Used by every AI tool at call time (not module-level).

### `lib/modelCostMap.ts`
Maps model names to relative cost units (Flash = 1, Pro = 5). Used by `logUsage()` to write `cost_units` to usage records.

---

## 6. Services Layer (`services/`)

### `services/firebase.ts`
Firebase initialisation. Exports `auth`, `db`. Singleton pattern.

### `services/geminiService.ts`
Shared AI utility functions used by multiple tools.

| Export | Purpose |
|---|---|
| `fetchConfig(toolId, fallback)` | Reads `configurations/{toolId}` from Firestore — returns `instruction` + `isLocked` |
| `logUsage(tool, model, cost, tier)` | Writes AI tool run to `usage` collection (is_ai_tool: true) |
| `logToolUsage(params)` | Writes non-AI tool run to `usage` collection (is_ai_tool: false) |
| `parseSubscriptionsFromPDF(base64)` | AI: extracts subscription data from PDF — used by SubscriptionTracker |
| `rewriteImagePrompt(source, instruction)` | AI: rewrites image prompts — used by PromptRewriter |
| `generateNewImagePrompt(keywords)` | AI: generates new image prompts — used by PromptWriter |

> Note: `fetchConfig` in `geminiService.ts` duplicates logic from `services/toolConfig.ts`. The newer `toolConfig.ts` returns a richer `ToolConfig` object. New tools should use `toolConfig.ts`.

### `services/toolConfig.ts`
Read-only fetch of `configurations/{toolId}` from Firestore. Returns full `ToolConfig` shape including `isLocked`, `prompt_template`, `temperature`, `feature_flags`. New tools use this instead of `geminiService.fetchConfig`.

### `services/reportService.ts`
Reporting middleware. Saves structured `ToolReport` documents to `tool_reports` Firestore collection. Fire-and-forget — never throws, never blocks tool execution. Returns doc ID or null.

```
saveReport({ toolId, userId, status, summary, reportData, metadata })
  └── writes to tool_reports/{auto-id}
  └── returns docId | null
```

Currently adopted by: **TN Standardiser** (pilot tool).

### `services/pdfNormalizer.ts`
Extracts and normalises slide content from PDF exports. Two parsers:
- `normalizePagesGSlides()` — Google Slides PDF format
- `normalizePagesSlidescom()` — Slides.com PDF format

Used by: `AIQARunner`.

### `services/deterministicChecks.ts`
Pre-AI structural validation. Runs rule-based checks (slide count, notes presence, etc.) before expensive AI calls. Returns `{ deterministicPass, flags, criticalFail }`. Used by `AIQARunner`.

### `services/qaEngine.ts`
AI QA engine for `AIQARunner`. Runs multi-mode lesson QA via Gemini. Saves results to `qa_runs` Firestore collection. Uses `getResolvedModelForTool`, `logToolUsage`.

### `services/qaEngineV1.ts`
AI QA engine for `SlidesZipUpload` (QA Engine V1). Separate pipeline from `qaEngine.ts`. Uses `ENGINE_VERSION` constant. Saves to `qa_runs_v1`, `qa_proofreading_runs_v1`, `qa_design_runs_v1`. Used by `SlidesZipUpload` and `lessonSnapshotAdapter`.

### `services/lessonSnapshotAdapter.ts`
Converts `SlidesZipUpload` parsed ZIP output into `QALessonSnapshot` objects consumed by `qaEngineV1`. Adapter pattern — decouples parser from engine.

### `services/resultValidator.ts`
Validates raw AI JSON responses from `qaEngine.ts` against the expected `QAResult` schema. Returns boolean + error list.

### `services/connectorInterface.ts`
Interface definitions for external connector integrations. Not directly used in active tool flows.

---

## 7. Type Contracts (`types/`)

### `types.ts` (root)
- `AppPage` union — all valid page IDs
- `LessonInfo`, `OutputMode`, `GenerationResponse` — legacy shared types
- `ResourceLink`, `InternalNote`, `DirectusGuide`, `Subscription` — Firestore document shapes

### `types/report.ts`
Unified report framework types.
- `ReportSectionType` — `summary | scorecard | table | diff | text | raw`
- `ReportSection` — discriminated union of all section shapes
- `ReportData` — `{ sections: [SummarySection, ...ReportSection[]] }` (first must be summary)
- `ToolReport` — Firestore `tool_reports` document shape

### `types/qa-v1.ts`
QA Engine V1 types. `QALessonSnapshot`, `QARunV1`, `QAModule`, `QAConfig`. Used by `SlidesZipUpload`, `lessonSnapshotAdapter`, `qaEngineV1`.

---

## 8. Firestore Collections

| Collection | Written by | Read by | Purpose |
|---|---|---|---|
| `navigation/sidebar_config` | AdminConsoleModal (saveNavigation, repairNavigation) | Sidebar.tsx | Dynamic sidebar nav |
| `configurations/{toolId}` | AdminConsoleModal | toolConfig.ts, geminiService.fetchConfig | Per-tool prompts, lock state |
| `tool_settings/{toolId}` | AdminConsoleModal (AI Tools tab) | toolTierResolver.ts | Per-tool model tier override |
| `usage` | geminiService (logUsage, logToolUsage) | AdminConsoleModal (Usage tab) | Tool run audit log |
| `tool_reports` | reportService.saveReport | ReportViewer (inline) | Structured tool run reports |
| `users` | LoginForm / auth hooks | AdminConsoleModal, AuthContext | User profiles + admin flags |
| `resource_links` | AdminConsoleModal | UsefulLinks.tsx | Curated links |
| `directus_guides` | AdminConsoleModal | DirectusGuides.tsx | Directus reference guides |
| `tool_ideas` | FeedbackModal | AdminConsoleModal (Ideas tab) | User-submitted ideas & fixes |
| `qa_runs` | qaEngine.ts | AdminConsoleModal (QA Dashboard) | AIQARunner run results |
| `qa_runs_v1` | qaEngineV1.ts | AdminConsoleModal, SlidesZipUpload | QA Engine V1 results |
| `qa_proofreading_runs_v1` | qaEngineV1.ts | AdminConsoleModal | QA V1 proofreading runs |
| `qa_design_runs_v1` | qaEngineV1.ts | AdminConsoleModal | QA V1 design runs |
| `qa_modules` | AdminConsoleModal | qaEngineV1.ts | Admin-defined QA modules |
| `qa_config_v1` | AdminConsoleModal | qaEngineV1.ts | QA V1 engine config |
| `qa_snapshots` | qaEngineV1.ts | AdminConsoleModal | QA lesson snapshots |
| `internal_notes` | InternalNotes.tsx | InternalNotes.tsx | Team internal notes |
| `subscriptions` | SubscriptionTracker.tsx | SubscriptionTracker.tsx | AI subscription tracking |

---

## 9. Module Inventory

### 9.1 Active Modules

#### Lesson Creation

**TN Standardiser** (`components/TNStandardiser/`)
- `index.tsx` — orchestration UI, multi-slide processing, file parsing dispatch, reporting wiring
- `ai.ts` — `fixTeacherNotes()`, `stripTeacherNoteMarkup()` pre-processing
- `constants.ts` — `TOOL_ID`, `TOOL_LABEL`, `DEFAULT_SYSTEM_INSTRUCTION`, `TN_STANDARDS`
- `reportBuilder.ts` — builds `ToolReport` + `ReportData` from run context
- `ResultRenderer.tsx` — renders standardised output with slide/label styling
- `TNInfoModal.tsx` — info modal
- `parsers/pdfParser.ts` — extracts notes from PDF
- `parsers/pptxParser.ts` — extracts notes from PPTX (JSZip + XML)
- `parsers/slidesZipParser.ts` — extracts notes from Slides.com ZIP
- **Middleware connections:** `lib/aiClient`, `lib/toolTierResolver`, `services/toolConfig`, `services/geminiService.logUsage`, `services/reportService.saveReport`
- **Reporting:** ✅ Pilot adopter of reporting middleware

**Lesson Descriptions** (`components/LessonTools/`)
- Generates structured lesson descriptions from lesson details + age group
- Uses `geminiService` directly

**TAF Generator** (`components/TAFGenerator/`)
- Generates Teacher Action Frames
- Uses `geminiService` directly

**Lesson QA / AI QA Runner** (`components/AIQARunner/`) ⚠️ REDUNDANT
- See section 9.2 below

#### Validation & QA

**Thematic QA** (`components/ThematicQA/`)
- `index.tsx` — main UI, PDF upload, run orchestration, inline scan history
- `ai.ts` — Gemini call with structured JSON output, `ALLOWED_TIERS`, `TOOL_ID = 'thematic-qa'`
- `firebaseService.ts` — saves/reads runs to Firestore `thematic_qa_runs`
- `ResultPanel.tsx` — renders QA results
- `ReportsDashboard.tsx` — full history browser, accessible inline via clock icon
- `types.ts` — `ThematicQAResult`, `QASettings`
- **Middleware connections:** `lib/aiClient`, `lib/toolTierResolver`, `services/geminiService.logUsage`

**QA Engine V1 / Slides ZIP Upload** (`components/SlidesZipUpload.tsx`)
- Parses Slides.com ZIP files, runs `qaEngineV1`, saves `QARunV1` to Firestore
- Uses `services/lessonSnapshotAdapter`, `services/qaEngineV1`
- **Note:** Older engine — separate pipeline from AIQARunner and ThematicQA

**General Proofing Bot** (`components/GeneralProofingBot/`)
- Proofs text/PDF/Word documents
- `ai.ts` — Gemini call

#### LLM & Content Processing

**Word List Processor** (`components/WordListProcessor.tsx`) — word list cleaning
**Topic Assigner** (`components/TopicAssigner/`) — AI topic tagging
**List Merger** (`components/ListMerger.tsx`) — merges + deduplicates lists
**LLM Content Checker** (`components/LLMContentChecker/`) — AI content quality check
**Spreadsheet Deduplicator** (`components/SpreadsheetDeduplicator.tsx`) — CSV dedup, uses `logToolUsage`

#### Competency Pipeline (sequential 6-step workflow)

| Step | Component | Purpose |
|---|---|---|
| 1 | `CompImportCreator/` | Build competency import CSV |
| 2 | `CompetencyCsvNormaliser/` | Normalise CSV structure |
| 3 | `SpreadsheetDeduplicator` | Dedup (shared with LLM section) |
| 4 | `RowExpander.tsx` | Expand multi-value rows |
| 5 | `IDResolver/` | Match rows to canonical IDs |
| 6 | `DirectusJsonBuilder/` | Build Directus JSON import |

#### Media & Assets

**Image URL Extractor** (`components/ImageUrlExtractor.tsx`)
**Image Renamer** (`components/ImageRenamer/`)
**Sound Generator** (`components/SoundGenerator/`)
**Prompt Writer** (`components/PromptWriter.tsx`) — uses `geminiService.generateNewImagePrompt`
**Prompt Rewriter** (`components/PromptRewriter.tsx`) — uses `geminiService.rewriteImagePrompt`
**Nano Banana Studio** — external prototype link (no local component)

#### Utilities

**Class ID Finder** (`components/ClassIdFinder.tsx`)
**Jira Ticketer** (`components/JiraTicketer/`)
**VR Validator** (`components/VRValidator/`)
**CSV Cleanroom** (`components/CSVCleanroom/`)

#### Resources

**Toolkit Info** (`components/ToolkitInfo.tsx`) — central tool reference page
**Internal Notes** (`components/InternalNotes.tsx`) — team notes, Firestore-backed
**Useful Links** (`components/UsefulLinks.tsx`) — curated links, Firestore-backed
**Directus Guides** (`components/DirectusGuides.tsx`) — guides, Firestore-backed
**Subscription Tracker** (`components/SubscriptionTracker.tsx`) — admin only, uses `parseSubscriptionsFromPDF`

#### Admin

**Admin Console Modal** (`components/AdminConsoleModal.tsx`)
Tabs: Usage | Users | Navigation | Links | Directus | Ideas & Fixes | AI Tool Settings | QA Modules | QA Config | QA Dashboard
- Manages all Firestore config collections directly
- Contains `saveNavigation()`, `repairNavigation()` — the only legitimate writers to `navigation/sidebar_config`

**Changelog Modal** (`components/ChangelogModal.tsx`) — version history, triggered from sidebar version badge

---

### 9.2 Redundant / Obsolete Modules

#### ⚠️ REDUNDANT — `components/AIQARunner/` (`page: 'ai-qa-runner'`, label: "Lesson QA")

**Why redundant:**
- `AIQARunner` uses `services/qaEngine.ts` which saves to `qa_runs` Firestore collection
- `ThematicQA` is the active replacement — more capable, has inline run history, saves to `thematic_qa_runs`
- `AIQARunner` is still wired in `FALLBACK_GROUPS`, `repairNavigation()`, `App.tsx`, and `types.ts` but superseded in practice
- Confirmed redundant by user (screenshot shows `ID: AI-QA-RUNNER` circled as obsolete)

**Files affected:**
- `components/AIQARunner/index.tsx`
- `components/AIQARunner/AIQAInfoModal.tsx`
- `components/AIQARunner/AIQASettingsModal.tsx`
- `components/AIQARunner/ResultDisplay.tsx`
- `components/AIQARunner/types.ts`
- `services/qaEngine.ts` (only consumed by AIQARunner)
- `services/deterministicChecks.ts` (only consumed by AIQARunner)
- `services/pdfNormalizer.ts` (only consumed by AIQARunner)
- `services/resultValidator.ts` (only consumed by AIQARunner)

**Action required (not done):** Remove from `FALLBACK_GROUPS`, `repairNavigation()`, `App.tsx`, `types.ts`, and delete component + service files when confirmed safe.

---

#### ⚠️ REDUNDANT — `components/VocabTools.tsx`
Empty file (0 bytes). No imports, no exports, no usage. Safe to delete.

---

#### ⚠️ DUPLICATE — `geminiService.fetchConfig` vs `services/toolConfig.ts`
- Both read `configurations/{toolId}` from Firestore
- `toolConfig.ts` returns a richer typed `ToolConfig` object
- `geminiService.fetchConfig` is older, returns minimal `{ instruction, isLocked }`
- Legacy tools use `geminiService.fetchConfig`; new tools should use `toolConfig.ts`
- No action needed immediately but should be consolidated in a future cleanup pass

---

#### ⚠️ PLACEHOLDER — Multiple pages render `<PlaceholderPage>`
The following pages are registered in routing and sidebar but have no real implementation:

| Page ID | Label |
|---|---|
| `ss-compactor` | S&S Compactor |
| `gap-spotter` | Curriculum Gap Spotter |
| `plan-generator` | Lesson Plan Generator |
| `slide-creator` | Slide-creator Studio |
| `improvement-suggestor` | Improvement Suggestor |
| `tts-generator` | TTS Generator |

These are registered future tools. Not redundant — just not yet built.

---

## 10. Reporting Middleware

### Architecture
```
Tool run completes
  └── buildTNReport(ctx)          ← tool-specific report builder
        └── returns { status, summary, reportData, localReport }
  └── saveReport(params)          ← services/reportService.ts (fire-and-forget)
        └── writes to tool_reports/{auto-id}
  └── setCurrentReport(localReport) ← React state (for inline preview)
  └── ReportViewer renders inline collapsible panel
```

### Current adoption
| Tool | Adopted | Notes |
|---|---|---|
| TN Standardiser | ✅ | Pilot — full integration |
| All others | ❌ | Not yet wired |

### Report schema (`types/report.ts`)
- `ReportData.sections[0]` must be type `summary`
- Status values: `success | partial_success | error`
- Schema version: `'1.0'`

### `ReportViewer` (`components/ReportViewer.tsx`)
Shared renderer for all `ToolReport` objects. Renders each section type (summary, scorecard, table, diff, text, raw) with consistent styling. Status badges: success (green), partial_success (amber), error (red), warning (amber), info (blue).

---

## 11. Context Providers

| Context | File | Provides |
|---|---|---|
| `AuthContext` | `context/AuthContext.tsx` | `user`, `isAdmin`, `loading` |
| `ThemeContext` | `context/ThemeContext.tsx` | `theme`, `toggleTheme` |

---

## 12. Shared UI Components

| Component | Purpose |
|---|---|
| `ReportViewer.tsx` | Renders `ToolReport` objects — shared by all tools adopting reporting middleware |
| `UnifiedToolSettingsModal.tsx` | Standard settings modal — locked prompt display + admin additional instructions. Used by TN Standardiser, others |
| `ToolSettingsModal.tsx` | Older settings modal pattern — used by some legacy tools |
| `PlaceholderPage.tsx` | Stub page for not-yet-built tools |
| `ErrorBoundary.tsx` | React error boundary wrapper |
| `FeedbackButton.tsx` / `FeedbackModal.tsx` | Global "Ideas & Fixes" submission |
| `Dashboard.tsx` | App home — tool cards grid, onNavigate callbacks |
| `LoginForm.tsx` | Auth gate |
| `Header.tsx` | Shared page header component (used by some tools) |

---

## 13. Architecture Diagram (text)

```
┌─────────────────────────────────────────────────────────────────┐
│  App.tsx — routing state (AppPage) + Suspense                   │
│    ├── Sidebar.tsx (Firestore nav / FALLBACK_GROUPS)            │
│    └── renderContent() → lazy tool component                    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Tool Component (e.g. TNStandardiser/index.tsx)                 │
│    ├── services/toolConfig.ts  → Firestore configurations/      │
│    ├── lib/toolTierResolver   → Firestore tool_settings/        │
│    ├── lib/aiClient           → Google Gemini API               │
│    ├── services/geminiService.logUsage → Firestore usage/       │
│    └── services/reportService.saveReport → Firestore tool_reports/
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI Governance Layer (lib/)                                     │
│    ├── aiClient.ts      — single GoogleGenAI instance           │
│    ├── modelRegistry.ts — tier → model string map              │
│    ├── toolTierResolver.ts — per-call Firestore tier lookup     │
│    └── modelCostMap.ts  — model → cost_units                   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Firebase (content-toolkit project)                             │
│    ├── Auth — user sessions                                     │
│    └── Firestore — all persistent state                         │
│          ├── navigation/sidebar_config                          │
│          ├── configurations/{toolId}                            │
│          ├── tool_settings/{toolId}                             │
│          ├── tool_reports/                                      │
│          ├── usage/                                             │
│          └── ... (see collection table in §8)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 14. Key Architectural Rules

1. **AI client is a singleton** — import `ai` from `lib/aiClient.ts` only. No other `GoogleGenAI` instantiation.
2. **Model resolution is per-call** — always call `getResolvedModelForTool()` inside the AI function, not at module load.
3. **Reporting is fire-and-forget** — `saveReport()` must never block tool execution. Never await it inline with logic.
4. **Nav sync is manual** — `FALLBACK_GROUPS`, `repairNavigation()` initialConfig, and `default_nav.md` are not linked by code and must be updated together.
5. **`AppPage` union is the routing contract** — every page ID must be registered here before it can be navigated to.
6. **`toolConfig.ts` over `geminiService.fetchConfig`** — new tools use `toolConfig.ts` for richer config; `geminiService.fetchConfig` is legacy.
7. **`ReportViewer` owns rendering** — tools must not render custom JSX for their report output; they produce `ReportData` and pass it to `ReportViewer`.
