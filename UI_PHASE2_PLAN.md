# Content Toolkit — UI Consistency Phase 2 Plan

> Planning only — no code changes applied.
> Grounded in: `UI_AUDIT.md`, `UI_STYLE_GUIDE.md`, and direct inspection of all relevant pages March 2026.

---

## Phase 1 Recap

The following are confirmed complete and stable:

| Page | PageHeader | Solid indigo badge | Correct action btns | Dark palette |
|---|---|---|---|---|
| `ThematicQA` | ✅ | ✅ | ✅ `p-2.5` | ✅ |
| `TNStandardiser` | ✅ | ✅ | ✅ `p-2.5` | ✅ |
| `ToolkitInfo` | ✅ | ✅ | n/a | ✅ |

Shared components created: `components/ui/PageHeader.tsx`, `components/ui/IconBadge.tsx`.
Style guide created: `UI_STYLE_GUIDE.md`.

---

## 1. Executive Recommendation

Phase 2 should be executed in three independent batches, each mergeable separately.

**Batch 2a** is the safest and highest-value: migrate the remaining tool pages that already use the correct visual pattern (solid indigo badge) but have not been moved to `PageHeader` yet. These are nearly mechanical — the badge color, icon, and dark palette are already correct. The only change is replacing the hand-copied header block with the shared component.

**Batch 2b** is the most structurally different: resource/info pages (`UsefulLinks`, `DirectusGuides`, `InternalNotes`) all use the old bare inline icon convention and have additional structural quirks (view toggles embedded in the header row, orange icon on `InternalNotes`). These need more careful handling and a confirm on whether the view toggle stays in the header area or moves outside it.

**Batch 2c** is isolated card/background cleanup — specifically `InternalNotes` and `Dashboard` dark palette drift. Recommended as its own separate batch because it touches content cards, not page headers, and the risk profile is different.

**Batch 2d** (docs + guardrails) and **Batch 2e** (optional token/wrapper work) can be done last and independently of UI changes.

Do not combine 2b and 2c — they touch overlapping files (`InternalNotes`) for different reasons and the separation keeps each change reviewable on its own merits.

---

## 2. Candidate Scope Inventory

### Tool pages — hand-copied solid indigo badge, not yet on `PageHeader`

| File | Badge | Action buttons | Deviation from canonical |
|---|---|---|---|
| `components/GeneralProofingBot/index.tsx` | `p-4 bg-indigo-600` ✅ | **`p-3`** ⚠️ (should be `p-2.5`) | Action button padding off by one size |
| `components/AIQARunner/index.tsx` | `p-4 bg-indigo-600` ✅ | `p-2.5` ✅ / **settings btn uses `hover:text-orange-500`** ⚠️ | Settings hover uses orange instead of indigo |
| `components/SpreadsheetDeduplicator.tsx` | `p-4 bg-indigo-600` ✅ | `p-2.5` ✅ | Badge wrapped in an extra `<div className="relative">` for lock-indicator overlay — this needs to be preserved or replicated |
| `components/PromptWriter.tsx` | `p-4 bg-indigo-600` ✅ | `p-2.5` ✅ | None |
| `components/PromptRewriter.tsx` | `p-4 bg-indigo-600` ✅ | `p-2.5` ✅ | None |

**All five are safe for Batch 2a.** The visual output is already correct — migration is a structural simplification only.

**Note on `SpreadsheetDeduplicator`:** the `relative` position wrapper around the badge is used to overlay a small teal lock indicator dot on the badge when the tool is in "Stable Mode". When migrating, the `PageHeader` must either support this overlay via the `actions` prop or the lock indicator must be moved to a different location (e.g. next to the title). This is the only non-trivial structural consideration in 2a.

---

### Resource / info pages — bare inline icon, not on `PageHeader`

| File | Badge | Header padding | Title font | Dark palette | Deviation |
|---|---|---|---|---|---|
| `components/UsefulLinks.tsx` | **`<Link2 className="w-7 h-7 text-indigo-500" />`** — bare inline ❌ | `p-6` (not `p-8`) | `font-bold` (not `font-black`) | ✅ `slate-900/800` | View toggle is co-located in the same header div's right side |
| `components/DirectusGuides.tsx` | **`<Presentation className="w-7 h-7 text-indigo-500" />`** — bare inline ❌ | `p-6` (not `p-8`) | `font-bold` (not `font-black`) | ✅ `slate-900/800` | Identical structure to `UsefulLinks` |
| `components/InternalNotes.tsx` | **`<StickyNote className="w-7 h-7 text-orange-500" />`** — bare inline, orange ❌ | `p-6` (not `p-8`) | `font-bold` (not `font-black`) | ❌ **`slate-800/707`** | Orange icon + drifted dark palette on the header card itself |

**These belong in Batch 2b.** All three have the same structural issue: the view toggle (card/list switcher) sits inside the header div's right side. When migrating to `PageHeader`, the view toggle will move into the `actions` prop — this is correct and clean but needs to be done deliberately.

**`InternalNotes` additional note:** its inline icon is orange (`text-orange-500`) rather than indigo. Migrating it to `PageHeader` with `iconColor="indigo"` is the correct correction per the current style guide. Its header card also uses the drifted dark palette (`dark:bg-slate-800 dark:border-slate-700`), which should be corrected at the same time as the header migration since it is the same div.

---

### Dark-mode card/background consistency targets

| File | Issue | Scope |
|---|---|---|
| `components/InternalNotes.tsx` header card | `dark:bg-slate-800 dark:border-slate-700` | Fixed as part of 2b header migration |
| `components/InternalNotes.tsx` note cards (`NoteCard`, `NoteListItem`) | `dark:bg-slate-800 dark:border-slate-700` on content cards | Batch 2c |
| `components/Dashboard.tsx` Quick Start + Recent Activity cards | `dark:bg-slate-800 dark:border-slate-700` | Batch 2c — lowest priority, Dashboard is a one-off layout |

---

### Docs / guardrail follow-up items

| Item | File | Needed |
|---|---|---|
| Add `PageHeader` as the canonical reference for new tool pages | `GUARDRAILS.md` | Yes — currently no mention of the shared UI components in guardrails |
| Add UI checklist reference to new tool integration notes | `DEVELOPER_GUIDE.md` | Yes — currently no reference to `UI_STYLE_GUIDE.md` or `PageHeader` |
| Update `UI_STYLE_GUIDE.md` §2 props example to remove stale `'orange'` from the `iconColor` comment | `UI_STYLE_GUIDE.md` | Minor — the comment still says `'indigo' | 'orange'` but the component type is now `'indigo'` only |
| Update the Phase 1 marker to Phase 1+2 after rollout completes | `UI_STYLE_GUIDE.md` header | Minor |

---

### Shared token / component follow-ups

| Item | Recommendation | Priority |
|---|---|---|
| `STATUS_CONFIG` promotion to `components/ui/statusConfig.ts` | Worth doing — it is the only existing token-like map and is currently locked inside `ReportViewer.tsx`. Any new component that needs status colors has to either re-invent the map or import from `ReportViewer`. Moving it to `components/ui/` is low-risk and creates the right home. | Phase 2e — after 2a/2b/2c |
| `ContentCard` shared wrapper | **Defer to Phase 3.** Content cards are used in dozens of places across every tool. Introducing a `ContentCard` wrapper in Phase 2 would expand scope significantly and create migration pressure across the whole codebase. The dark palette fix (2c) is sufficient for now. Revisit when Phase 2 is fully stable. | Phase 3 |

---

## 3. Recommended Rollout Sequence

### Batch 2a — Remaining tool page header migration
**Scope:** `GeneralProofingBot`, `AIQARunner`, `SpreadsheetDeduplicator`, `PromptWriter`, `PromptRewriter`

**What changes:**
- Replace each hand-copied header block with `<PageHeader icon=... iconColor="indigo" title=... description=... actions={...} />`
- Move all existing action buttons into the `actions` prop — preserving every button, every handler, every conditional (`isAdmin`, etc.)
- Fix `GeneralProofingBot` action button from `p-3` to `p-2.5` (as part of the migration, not a separate fix)
- Fix `AIQARunner` settings button hover from `hover:text-orange-500 hover:bg-orange-50` to `hover:text-indigo-500 hover:bg-indigo-50` (as part of the migration)
- For `SpreadsheetDeduplicator`: the lock indicator overlay on the badge must be re-evaluated. The teal dot currently sits `absolute -top-1 -right-1` on the badge container. Options: (a) keep a `relative` wrapper in the `actions` area next to the title, (b) move the lock badge next to the title text — which is how TNStandardiser handles it (inline text badge). Option (b) is cleaner and consistent with TNStandardiser. Confirm before implementing.

**Risk level: Low**
All five pages already have the correct visual result. This is a structural simplification. No visual regressions expected if `actions` content is preserved exactly.

**Safe to batch together:** Yes — all five can be in a single PR/commit.

---

### Batch 2b — Resource/info page header migration
**Scope:** `UsefulLinks`, `DirectusGuides`, `InternalNotes`

**What changes:**
- Replace each hand-copied header block with `<PageHeader ... />`
- For `UsefulLinks` and `DirectusGuides`: view toggle (card/list switcher) moves into `actions` prop — this is structurally clean
- For `InternalNotes`: bare orange icon → solid indigo badge via `PageHeader iconColor="indigo"`
- For `InternalNotes`: header card dark palette corrected from `dark:bg-slate-800 dark:border-slate-700` → `dark:bg-slate-900 dark:border-slate-800` (this is the same div being replaced by `PageHeader`, so it is fixed automatically)
- For all three: `font-bold` → `font-black` on title (applied automatically by `PageHeader`)
- For all three: `p-6` → `p-8` on header card (applied automatically by `PageHeader`)

**Prerequisite confirmation needed before implementing:**
1. Confirm that resource pages (`UsefulLinks`, `DirectusGuides`, `InternalNotes`) should use the same solid indigo `PageHeader` treatment as tool pages — not a lighter `p-6` resource variant. The audit flagged this as an open question. Current guidance in `UI_STYLE_GUIDE.md` says "every tool page and resource page gets one page header" — this implies yes, but should be confirmed explicitly before 2b starts.
2. Confirm the `InternalNotes` icon should become indigo (not orange). The orange inline icon was a conscious choice at build time; confirm whether orange has any intentional semantic meaning here or whether it is just a legacy holdover.

**Risk level: Low-Medium**
Structurally straightforward, but `InternalNotes` has the most deviations from the standard pattern (orange, dark palette, no existing Phase 1 precedent for this page type). The visual change is more noticeable here than in 2a.

**Safe to batch together:** Yes — all three can be in a single commit, but `InternalNotes` should be reviewed separately if uncertain about the orange-to-indigo intent.

---

### Batch 2c — Dark-mode content card palette
**Scope:** `InternalNotes.tsx` note cards, `Dashboard.tsx` content cards

**What changes:**
- `InternalNotes` `NoteCard` and `NoteListItem`: `dark:bg-slate-800 dark:border-slate-700` → `dark:bg-slate-900 dark:border-slate-800`
- `Dashboard.tsx` Quick Start card and Recent Activity card: `dark:bg-slate-800 dark:border-slate-700` → `dark:bg-slate-900 dark:border-slate-800`

**Prerequisite:** 2b should be done first so that `InternalNotes` header is already on the correct palette before touching the note cards.

**Risk level: Low**
Pure class string replacements on background/border. No layout changes. Dark mode only — light mode is unaffected.

**Dashboard note:** `Dashboard.tsx` is a one-off layout and is intentionally excluded from `PageHeader` migration (it has an orange gradient hero, not a standard header). The dark card fix is still valid and worth doing, but is lowest priority. Can be deferred to Phase 3 if preferred.

**Safe to batch together:** `InternalNotes` note cards + `Dashboard` cards can be in one commit, or split if preferred.

---

### Batch 2d — Docs and guardrail reinforcement
**Scope:** `GUARDRAILS.md`, `DEVELOPER_GUIDE.md`, `UI_STYLE_GUIDE.md`

**What changes:**
- `GUARDRAILS.md` — add a short rule to the "Mirror existing patterns" section: before building a new tool page, use `PageHeader` from `components/ui/PageHeader.tsx`. Reference `UI_STYLE_GUIDE.md` for the full checklist.
- `DEVELOPER_GUIDE.md` — add a short "UI patterns" note to the New Tool Integration Notes section pointing to `UI_STYLE_GUIDE.md §11` (the new-page checklist).
- `UI_STYLE_GUIDE.md` — fix stale `iconColor` comment in §2 props example (currently still says `'indigo' | 'orange'`; should say `'indigo'` only). Update the phase marker from "Phase 1" to "Phase 1+2".

**Risk level: None** — docs only.

**Can be done in the same pass as 2a or independently.**

---

### Batch 2e — Optional: `STATUS_CONFIG` token promotion
**Scope:** `components/ReportViewer.tsx`, new `components/ui/statusConfig.ts`

**What changes:**
- Extract the `STATUS_CONFIG` and `VARIANT_BADGE` maps from `ReportViewer.tsx` into `components/ui/statusConfig.ts`
- Re-import them in `ReportViewer.tsx` — no behavioral or visual change
- Update `UI_STYLE_GUIDE.md §9` to cite `components/ui/statusConfig.ts` as the source of truth

**Risk level: Low**
The maps are used only in `ReportViewer.tsx`. The extraction is a straight move with a re-import. TypeScript will catch any breakage immediately.

**Recommendation:** Do this as a standalone task after 2a/2b/2c are confirmed stable. It is infrastructure cleanup with no visual effect.

---

## 4. Risk Assessment

| Batch | Risk | Why | What could drift if done badly | Safe as mechanical migration? |
|---|---|---|---|---|
| **2a** | **Low** | All pages already visually correct; structural swap only | If action buttons are not fully preserved in `actions` prop, missing buttons would surface | Yes — verify button parity after each page |
| **2b** | **Low-Medium** | More structural deviations; orange→indigo color change on `InternalNotes` is visible | If view toggle is not correctly moved to `actions`, it disappears; orange icon removal is intentional but visible | Review carefully; confirm orange intent before implementation |
| **2c** | **Low** | CSS class replacements only; dark mode only | Barely perceptible visual change if wrong class used | Yes — one class per card |
| **2d** | **None** | Docs only | Stale docs remain stale | Yes |
| **2e** | **Low** | Pure extraction + re-import | TypeScript catches breakage instantly; no visual risk | Yes |

---

## 5. Dependencies and Prerequisites

The following questions should be confirmed before implementation begins:

**Before 2a:**
- Confirm how the `SpreadsheetDeduplicator` lock indicator should be handled when the badge is wrapped in `PageHeader`. Recommended: move the lock indicator to sit next to the title text (matching TNStandardiser's pattern of an inline text badge). If confirmed, this is clean and takes one extra line in the `title` prop or below the `<PageHeader>`.

**Before 2b:**
- Confirm resource pages (`UsefulLinks`, `DirectusGuides`, `InternalNotes`) should use the same solid indigo `PageHeader` treatment as tool pages. This is implied by `UI_STYLE_GUIDE.md §2` but has not been explicitly signed off.
- Confirm `InternalNotes` orange icon is a legacy holdover, not an intentional semantic distinction. If it is intentional (orange = personal/notes context), the plan should note it as a documented exception rather than correcting it.

**Before 2c:**
- Confirm `Dashboard.tsx` dark card palette should be corrected or deferred. The dashboard is the most user-visible page and the change is subtle but measurable. If deferring, document that Dashboard dark cards remain as-is until Phase 3.

**All batches:**
- Phase 1 should be confirmed visually working in the browser before Phase 2 starts.
- No tool logic, AI logic, reporting, routing, or sidebar changes in any Phase 2 batch.

---

## 6. Implementation Guardrails for Phase 2

The implementation task for each batch must protect the following:

**Hard limits — any violation is out of scope:**
- No tool logic changes
- No AI call changes
- No reporting/storage flow changes
- No routing changes
- No sidebar config changes
- No modal redesign
- No form or input restyle
- No broad palette changes outside the specific cards in 2c

**Process rules:**
- Migrate one batch at a time — do not combine 2a + 2b in a single implementation pass
- After each page migration, verify: (1) all action buttons present and functional, (2) title and description correct, (3) icon badge is solid indigo, (4) dark mode card uses `slate-900/slate-800`
- If a page has a genuinely unique structural need that `PageHeader` cannot accommodate cleanly, note it in the summary and leave the page unmigrated rather than adding one-off hacks to `PageHeader`
- TypeScript must pass clean (`tsc --noEmit`) after each batch

---

## 7. Recommended Deliverables for Phase 2 Implementation

When approved and implemented, Phase 2 should produce:

**Batch 2a deliverables:**
- 5 tool pages migrated to `PageHeader` (`GeneralProofingBot`, `AIQARunner`, `SpreadsheetDeduplicator`, `PromptWriter`, `PromptRewriter`)
- `GeneralProofingBot` action button corrected to `p-2.5`
- `AIQARunner` settings button hover corrected to `indigo`
- `SpreadsheetDeduplicator` lock indicator repositioned (confirmed approach)
- No other changes

**Batch 2b deliverables:**
- 3 resource pages migrated to `PageHeader` (`UsefulLinks`, `DirectusGuides`, `InternalNotes`)
- `InternalNotes` header icon corrected to indigo
- `InternalNotes` header card dark palette corrected (auto-corrected by `PageHeader`)
- View toggles preserved in `actions` prop for all three pages
- No other changes

**Batch 2c deliverables:**
- `InternalNotes` note card dark palette corrected
- `Dashboard` content card dark palette corrected (if confirmed in-scope)
- No other changes

**Batch 2d deliverables:**
- `GUARDRAILS.md` — `PageHeader` rule added
- `DEVELOPER_GUIDE.md` — UI checklist reference added
- `UI_STYLE_GUIDE.md` — stale comment fixed, phase marker updated

**Batch 2e deliverables:**
- `components/ui/statusConfig.ts` created
- `STATUS_CONFIG` and `VARIANT_BADGE` extracted from `ReportViewer.tsx` and re-imported
- `UI_STYLE_GUIDE.md §9` updated to cite new file

---

## Appendix: Files Inspected

**Docs:**
- `UI_AUDIT.md`
- `UI_STYLE_GUIDE.md`
- `DEVELOPER_GUIDE.md`
- `GUARDRAILS.md`

**Shared UI components:**
- `components/ui/PageHeader.tsx`
- `components/ui/IconBadge.tsx`

**Phase 1 migrated pages (confirmed state):**
- `components/ThematicQA/index.tsx`
- `components/TNStandardiser/index.tsx`
- `components/ToolkitInfo.tsx`

**Pages inspected for Phase 2 scope:**
- `components/GeneralProofingBot/index.tsx`
- `components/AIQARunner/index.tsx`
- `components/SpreadsheetDeduplicator.tsx`
- `components/PromptWriter.tsx`
- `components/PromptRewriter.tsx`
- `components/UsefulLinks.tsx`
- `components/DirectusGuides.tsx`
- `components/InternalNotes.tsx`
- `components/Dashboard.tsx`

---

## Recommended Phase 2 Batches

| Batch | Scope | Risk | Can batch together |
|---|---|---|---|
| **2a** | Tool page headers: `GeneralProofingBot`, `AIQARunner`, `SpreadsheetDeduplicator`, `PromptWriter`, `PromptRewriter` | Low | Yes |
| **2b** | Resource page headers: `UsefulLinks`, `DirectusGuides`, `InternalNotes` | Low-Medium | Yes (review InternalNotes separately if orange intent unclear) |
| **2c** | Dark card palette: `InternalNotes` note cards, `Dashboard` content cards | Low | Yes |
| **2d** | Docs: `GUARDRAILS.md`, `DEVELOPER_GUIDE.md`, `UI_STYLE_GUIDE.md` | None | Yes, any time |
| **2e** | Token: `STATUS_CONFIG` extracted to `components/ui/statusConfig.ts` | Low | Standalone, after 2a/2b confirmed |

## Highest-Risk Batch
**2b** — `InternalNotes` has the most deviations (orange icon, drifted dark palette, no prior Phase 1 precedent), and the confirm on resource-page header treatment is needed before starting.

## What Should Remain Out of Scope
- `Dashboard.tsx` hero banner and gradient — not a standard page header, never migrate to `PageHeader`
- `Header.tsx` top navigation bar — unrelated, not in scope
- `Sidebar.tsx` — unrelated, not in scope
- `ToolSettingsModal` / `UnifiedToolSettingsModal` split — deferred to Phase 3
- Modal shell standardization — deferred to Phase 3
- `ContentCard` shared wrapper — deferred to Phase 3
- Any tool that uses `PlaceholderPage.tsx` — already on a shared component, leave as-is
- Any tool logic, AI, reporting, routing, Firestore — never in scope
