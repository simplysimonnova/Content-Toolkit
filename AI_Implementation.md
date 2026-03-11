# Content Toolkit: AI Implementation Guide

This document outlines the **AI client and initialization pattern** used in the Content Toolkit. It should be read alongside `architecture_full.md §5` (AI Governance Layer) and `DEVELOPER_GUIDE.md` (New tool integration notes).

### Core Architectural Rules

1.  **Singleton AI Client (`lib/aiClient.ts`)**
    A single shared `GoogleGenAI` instance is initialised at module load using `process.env.API_KEY` and exported as `ai`. All tool service files import `ai` from this file. Do not create a new `GoogleGenAI` instance anywhere else in the codebase.

    ```
    // lib/aiClient.ts — the one and only initialisation point
    export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    ```

    The client fails fast on a missing key at startup rather than failing silently at call time. Passing the key through React state, context, or props is not used and should not be introduced.

2.  **Call-Time Model Resolution (Late Binding)**
    While the client is a singleton, the **model and tier are resolved per call** via `lib/toolTierResolver.ts`. This is what "late binding" means in the current architecture: model selection is deferred to the moment of the AI call, not fixed at module load. This allows the Admin Console to change a tool's model tier in Firestore without a code deployment.

    ```
    // Inside each AI service function — called at runtime, not at module level
    const { tier, model } = await getResolvedModelForTool(toolId, ALLOWED_TIERS);
    ```

3.  **Call-Time Config Lookup**
    Tool prompt templates and lock state are also read per call from Firestore (`configurations/{toolId}`) via `services/toolConfig.ts` (preferred for new tools) or `geminiService.fetchConfig` (legacy tools). This is a second dimension of late binding — behavior can be changed dynamically without touching code.

4.  **Model-Specific Routing**
    Model strings are never hardcoded in tool files. They are resolved through `lib/modelRegistry.ts` which maps capability tiers to model identifiers:
    - **`default` tier**: `gemini-3-flash-preview` — text/JSON tasks (Proofing, TAF, Lessons, Word Lists)
    - **`reasoning` tier**: `gemini-3-pro` — higher-complexity tasks where enabled
    - **Audio/Speech tasks**: `gemini-2.5-flash-preview-tts` — handles `Modality.AUDIO` requirements (Sound Generator)

### Troubleshooting: Hard Refresh (Cmd+Shift+R) vs. Standard Refresh

A known race condition can occur during **Hard Refreshes**:
- **Standard Refresh (Cmd+R)**: The browser may preserve the environment context or resolve `process.env` injection faster due to cached state.
- **Hard Refresh (Cmd+Shift+R)**: The browser clears all cache and forces a cold start. If the Gemini client initialises before the environment bridge has finished injecting `process.env.API_KEY`, the SDK will receive an empty string or `undefined`, resulting in a `400 Invalid API Key` error.

**Mitigation**: AI calls are only triggered by user interaction (button click), which means the environment has had time to fully initialise before any call is made. The singleton client in `lib/aiClient.ts` fails fast at startup if `API_KEY` is missing, making misconfiguration visible immediately rather than silently at call time.

### Rules for Future Updates

- **Do not** create a new `GoogleGenAI` instance anywhere other than `lib/aiClient.ts`. Import `ai` from there.
- **Do not** move `ai` into React Context, React state, or props.
- **Do not** hardcode model strings in tool files — always use `lib/toolTierResolver` + `lib/modelRegistry`.
- **Do not** read tool config inline in AI functions — use `services/toolConfig.ts` (or `geminiService.fetchConfig` for legacy tools).
- If an `API Key Not Valid` error appears, check the **Browser Console** (F12) to confirm `process.env.API_KEY` is correctly injected into the browser context.

---

## Sidebar Nav System — Architecture & Logic

### Two sources of truth

| Source | When used |
|---|---|
| **Firestore** `navigation/sidebar_config` | Primary — loaded on mount via `onSnapshot` |
| **`FALLBACK_GROUPS`** in `Sidebar.tsx` | Fallback — used if Firestore doc missing or empty |

### Runtime flow

1. `Sidebar.tsx` mounts → `onSnapshot` listener opens on `navigation/sidebar_config`
2. If the doc **exists and has groups** → `setNavGroups(groups)` from Firestore
3. If the doc **is missing or empty** → `setNavGroups(FALLBACK_GROUPS)` (hardcoded in `Sidebar.tsx`)
4. On error → same fallback
5. `navGroups` is filtered through `filteredNavGroups` (useMemo) for the search bar
6. Each group renders as a collapsible `NavGroup`, each item as a `NavLink` button
7. `NavLink` calls `onNavigate(page as AppPage)` → lifts state to `App.tsx` → `renderContent()` switch

### Three places that must stay in sync

| Location | Role |
|---|---|
| `FALLBACK_GROUPS` in `Sidebar.tsx` | Client-side fallback nav (used when Firestore is down or empty) |
| `repairNavigation()` in `AdminConsoleModal.tsx` | Writes `initialConfig` to Firestore — the "repair" button |
| `default_nav.md` | Human-readable documentation only — not read by any code |

**These three are not linked in code — they must be updated manually in parallel whenever a new page is added.**

### Admin controls

- **Navigation tab** in Admin Console → drag-and-drop reorder of groups/items → calls `saveNavigation()` → writes to `navigation/sidebar_config` via `setDoc`
- **Repair button** → calls `repairNavigation()` → overwrites Firestore with the hardcoded `initialConfig` array

### Adding a new page (checklist)

1. `types.ts` — add page ID to `AppPage` union
2. `App.tsx` — add lazy import + `case` in `renderContent()`
3. `FALLBACK_GROUPS` in `Sidebar.tsx` — add item to correct group
4. `repairNavigation()` in `AdminConsoleModal.tsx` — add same item to `initialConfig`
5. `default_nav.md` — update docs