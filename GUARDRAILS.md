# Content Toolkit Guardrails

These rules are for any AI assistant or contributor making changes in this repo.

They exist to reduce accidental architecture drift, cross-tool breakage, and unsafe refactors.

---

## 1. Scope discipline

Do only the task requested.

Do not:
- expand scope
- add cleanup work unless requested
- refactor neighboring modules “while here”
- rename files or structures without need
- redesign architecture from a local task

If a broader issue is noticed, mention it separately. Do not fold it into the current change.

---

## 2. Respect modular boundaries

Each tool is treated as an independent product unit.

Do not:
- move tool logic into shared layers without a clear existing pattern
- merge unrelated tool behavior
- create hidden dependencies between tools
- introduce shared abstractions just because two tools look similar

Shared logic belongs in shared services only when there is a proven existing repo pattern or an explicit request.

---

## 3. Keep app orchestration lightweight

Do not turn app-level routing or page orchestration into a heavy state-management layer unless explicitly requested.

When adding pages or tools:
- mirror existing routing patterns
- mirror existing sidebar patterns
- mirror existing default/repair-default registration patterns

Inspect first. Then match.

---

## 4. Navigation changes must be fully synced

Navigation is not controlled from one place only.

If a task adds, removes, renames, reorders, or exposes a page in navigation, inspect the current nav architecture first and update all required locations.

Do not assume one sidebar edit is enough.

Where relevant, keep these in sync:
- page ID / app page typing
- route registration
- render mapping
- sidebar fallback config
- repair/default config
- human-readable nav docs if maintained manually

If the repo documents a nav checklist, follow it exactly.

---

## 5. Do not casually change AI initialization

Treat AI initialization and Gemini access as sensitive.

The AI client is a module-level singleton in `lib/aiClient.ts`. Model and config are resolved per call at runtime.

Do not:
- create a new `GoogleGenAI` instance anywhere other than `lib/aiClient.ts`
- move the `ai` singleton into React context, React state, or props
- hardcode model strings in tool files — model selection must go through `lib/toolTierResolver` + `lib/modelRegistry`
- read tool config inline — use `services/toolConfig.ts` (new tools) or `geminiService.fetchConfig` (legacy tools)
- change call-time model or config resolution behavior without reason — this is the "late binding" the architecture depends on

Any AI service changes must align with `AI_Implementation.md`.

---

## 6. Do not casually change reporting or storage patterns

If a task touches reporting, usage logging, Firestore, or report persistence:
- inspect the current pattern first
- extend the existing approach where possible
- avoid partial rewrites
- avoid mixing reporting concerns into UI work unless already part of the pattern

Do not invent a new report schema or storage flow in a narrow feature task unless explicitly asked.

---

## 7. Preserve current behavior unless behavior change is requested

When editing:
- keep current UI behavior intact
- keep modal behavior intact
- keep existing outputs intact unless the task changes them
- keep admin behavior intact unless the task changes it

An implementation should not “improve” behavior by surprise.

---

## 8. Prefer additive changes

Prefer:
- adding a page
- adding a route
- adding a sidebar item
- adding a small helper
- adding a targeted config entry

Avoid broad replacement when a minimal additive change will work.

---

## 9. Mirror existing patterns before creating new ones

Before changing code:
- inspect a similar existing page
- inspect a similar existing tool
- inspect a similar service integration
- inspect a similar config/default/repair-default registration

Use the existing repo pattern as the default solution.

**UI patterns:** Every new tool or resource page must use `PageHeader` from `components/ui/PageHeader.tsx` for its page header. Do not hand-copy the header pattern. Do not use bare inline icons in page headers. See `UI_STYLE_GUIDE.md` for the full checklist before building any new page UI.

---

## 10. Keep prompts strict

When writing implementation prompts for this repo:
- define the goal
- define allowed changes
- define forbidden changes
- reference the relevant project docs
- require minimal changes only
- ask for a concise file change summary

Do not use vague instructions such as:
- “clean this up”
- “improve architecture”
- “make it more scalable”
- “modernize the pattern”

unless that is the actual task.

---

## 11. Safe escalation rule

If the requested task genuinely requires broader architecture work:
- say so explicitly
- separate the minimal implementation from the larger refactor option
- do not silently perform both

Default to the minimal safe implementation.

---

## 12. Summary expectation

At the end of any meaningful code task, provide:
- files added
- files changed
- what was intentionally not changed
- any assumptions or risks

This helps preserve reviewability and reduces hidden drift.