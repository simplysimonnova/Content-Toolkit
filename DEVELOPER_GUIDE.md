# Content Toolkit — Internal Developer Guide

This guide is for anyone building new tools or integrating them into the Content Toolkit.
Its purpose is to keep new development consistent with the existing architecture, reduce refactoring overhead, and prevent gradual architecture drift.

This is not a replacement for the main docs. It points to them and tells you when to read each one.

---

## Read these before starting any new tool

Choose based on task type. Do not skip this step.

| What you need to know | Read |
|---|---|
| Product purpose, human-in-the-loop expectations, and toolkit intent | `mission_statement.md` |
| Module boundaries, tool isolation, routing shape, and shared services model | `app_modularity.md` |
| AI constraints, Gemini client handling, model/tier system, sidebar/nav sync rules | `AI_Implementation.md` |
| Expected working style, pattern-mirroring behavior, inspection-first rule | `AGENT_GUIDE.md` |
| Strict scope control and forbidden change patterns | `GUARDRAILS.md` |

If a task touches navigation or sidebar, read the **Sidebar Nav System** section of `AI_Implementation.md` specifically — the nav has multiple manually synced locations.

---

## Core development principles

- **Tools are independent units.** Each tool owns its own UI state, file handling, and error handling. Changes to one tool must not affect another. See `app_modularity.md §1`.
- **App orchestration stays lightweight.** `App.tsx` is a router, not a state manager. Do not expand it. See `app_modularity.md §2`.
- **Mirror before introducing.** Before creating a new pattern, inspect how the nearest existing tool does it. Use that pattern unless there is a clear reason not to.
- **Shared services are not casual edit targets.** `geminiService.ts`, `toolConfig.ts`, `reportService.ts`, and `lib/` are shared across all tools. Changes there affect everything. See `GUARDRAILS.md §6`.
- **Preserve behavior outside the requested scope.** Do not "improve" adjacent UI, modals, or outputs unless the task asks for it. See `GUARDRAILS.md §7`.
- **Flag broader issues — don't silently fix them.** If something looks inconsistent, note it in the summary. Don't fold cleanup into a feature task. See `GUARDRAILS.md §11`.

---

## New tool integration notes

When building a tool that will later be integrated into the toolkit UI:

**Structure**
- Keep all tool logic inside its own folder under `components/YourTool/`
- Separate AI calls into a co-located `ai.ts` — do not inline Gemini calls in the UI component
- Use `lib/aiClient` for the AI instance — never create a new `GoogleGenAI` elsewhere
- Use `lib/toolTierResolver` + `lib/modelRegistry` for model selection — do not hardcode model strings

**Configuration & locking**
- Use `services/toolConfig.ts` to read tool config from Firestore (`configurations/{toolId}`)
- Respect `isLocked` — check it before executing, mirror the pattern in existing tools

**Usage logging**
- Call `logUsage()` (AI tools) or `logToolUsage()` (non-AI tools) from `services/geminiService.ts` after each run
- Do not invent a new logging schema

**Reporting**
- If the tool produces a structured output, inspect `services/reportService.ts` and `types/report.ts` before adding any persistence
- Use the existing `ReportData` / `ToolReport` shape — do not create a bespoke report format
- `ReportViewer.tsx` is the shared renderer — tools produce data, not custom JSX

**UI patterns (page shell)**
Before building the page UI for a new tool:
- Read `UI_STYLE_GUIDE.md` — specifically §11 (Adding a New Page checklist)
- Use `PageHeader` from `components/ui/PageHeader.tsx` for the page header — do not hand-copy it
- Use `iconColor="indigo"` — do not use orange for tool page headers
- Use `dark:bg-slate-900` + `dark:border-slate-800` for content cards
- Add `animate-fade-in` to the root wrapper div

**Routing & sidebar (if the tool needs a page)**
Follow the full checklist — all five locations must be updated together:
1. `types.ts` — add page ID to `AppPage` union
2. `App.tsx` — lazy import + `case` in `renderContent()`
3. `Sidebar.tsx` `FALLBACK_GROUPS` — add item to correct group
4. `AdminConsoleModal.tsx` `repairNavigation()` — add same item to `initialConfig`
5. `default_nav.md` — update docs

See `AI_Implementation.md → Sidebar Nav System` for full detail.

---

## AIStudio starter block — mini-app for later toolkit integration

Use this as a starting instruction block when building a mini-app in AIStudio that may later be transplanted into the Content Toolkit.

---

```
You are building a self-contained mini-app that may later be integrated into a larger React + TypeScript toolkit.

Structure requirements:
- Keep all logic inside a single folder. Do not create app-wide abstractions.
- Separate UI state (React component) from service logic (a co-located service or ai.ts file).
- Do not create a global router, global auth layer, or global theme provider — those exist in the host app.
- Do not assume the mini-app will own the page shell, sidebar, or navigation.
- Export the main component as a named export so it can be imported and mounted directly.

AI / API calls:
- Keep AI calls in a dedicated service file (e.g. ai.ts), not inline in the UI component.
- Accept the AI client as an import or parameter — do not hardcode initialization inside the component.
- Return structured typed results from AI functions. Do not return raw strings if a typed shape is possible.

Outputs:
- Prefer returning structured data objects over rendering bespoke JSX for results.
- If the tool produces a report or summary, model it as a plain typed object that a shared viewer could later consume.

Styling:
- Use Tailwind CSS utility classes. The host app uses Tailwind + dark mode (dark: variants).
- Do not add a separate CSS file or CSS-in-JS library.

General:
- Avoid premature cleanup or "architecture improvements" that are not required for the task.
- Avoid creating shared utilities unless two or more parts of the mini-app clearly need them.
- Keep it additive — build only what the task requires.
- Add a short README comment at the top of the main component describing: what it does, what it takes as input, and what it produces as output.
```

---

## Navigation exposure (when the time comes)

If the mini-app or new tool later needs to appear in the toolkit sidebar, the nav sync checklist above applies in full. Do not update only one location. Check `AI_Implementation.md → Sidebar Nav System — Adding a new page` before making any nav changes.
