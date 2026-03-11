# Content Toolkit — UI/UX & Styling System Audit

> March 2026 | Audit only — no code changes applied.
> Purpose: Identify the real existing UI patterns, shared styling logic, inconsistencies, and likely causes of visual drift. Input for a future `UI_STYLE_GUIDE.md`.

---

## 1. Executive Summary

The toolkit has a strong and coherent visual language that is mostly consistent across its newer tools. The core design vocabulary — rounded-3xl cards, slate/orange/indigo palette, `font-black` uppercase labels, Lucide icons — is well established and repeated across the majority of components.

**Biggest styling system issue:** There is no shared component for the single most-repeated structure in the repo — the **page header card** (icon badge + title + subtitle + action buttons). This exact pattern appears in at least 7 tools, hand-copied each time with small but compounding variations. Every new tool that copies a slightly different version drifts further from the reference.

**Biggest likely cause of repeated drift:** Styling lives entirely in inline Tailwind class strings inside each tool file. There is no shared component, no token file, and no class-string constant that acts as a single source of truth for any repeated visual pattern. New tools are built by copying the nearest existing tool's JSX, which introduces micro-variations with each copy.

**Secondary issue:** There are two distinct icon badge conventions actively in use — one with a solid colored background (`bg-indigo-600` or `bg-orange-500`) and one without (`text-indigo-500` icon on `bg-indigo-50`). Both appear in the same pages. No canonical rule exists for which to use where.

---

## 2. Existing Sources of UI Truth

There is no single dedicated UI system file. The following are the closest things to shared visual references currently in the repo:

| Source | Role | Shared? |
|---|---|---|
| `components/ReportViewer.tsx` | `STATUS_CONFIG` map + `VARIANT_BADGE` map — the only explicit token-like maps in the repo | ✅ Genuinely shared |
| `components/Sidebar.tsx` — `NavLink` / `NavGroup` | Only truly reused nav sub-components in the app | ✅ Genuinely shared |
| `components/PlaceholderPage.tsx` | Single canonical shell for unbuilt tools | ✅ Genuinely shared |
| `components/UnifiedToolSettingsModal.tsx` | Shared settings modal pattern (newer tools) | ✅ Genuinely shared |
| `components/ToolSettingsModal.tsx` | Older settings modal — some tools still use this | ⚠️ Legacy duplicate |
| `components/ThematicQA/index.tsx` — header block | Most complete and cleanest example of the standard tool page header | 📋 Informal reference only |
| `components/TNStandardiser/index.tsx` — header block | Second strongest header reference | 📋 Informal reference only |
| `components/Dashboard.tsx` — hero banner | Only example of the orange gradient hero; not reused elsewhere | 📋 One-off |

**No shared token file, no CSS module, no class-string constant file exists.**
All visual consistency currently depends on developers copying class strings from existing components.

---

## 3. Existing Reusable Patterns

### 3.1 Page Header Card

The dominant page structure across all active tools. Appears in:
`TNStandardiser`, `ThematicQA`, `GeneralProofingBot`, `AIQARunner`, `ToolkitInfo`, `UsefulLinks`, `DirectusGuides`, and others.

**Canonical form (best observed in `ThematicQA` and `TNStandardiser`):**
```
bg-white dark:bg-slate-900
p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm
flex items-center justify-between gap-4

  ├── Left: flex items-center gap-4
  │     ├── Icon badge: p-4 bg-{color}-{shade} rounded-2xl shadow-lg shadow-{color}-500/20
  │     │     └── Icon: w-8 h-8 text-white
  │     └── Title block:
  │           ├── h1: text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white
  │           └── p: text-slate-500 dark:text-slate-400 font-medium
  └── Right: flex items-center gap-2
        └── Icon buttons: p-2.5 text-slate-400 hover:text-indigo-500
                          hover:bg-indigo-50 dark:hover:bg-slate-800
                          rounded-xl transition-all
```

**Status: Informally repeated — not a shared component.** Each tool copies this by hand.

---

### 3.2 Section/Content Card

Secondary card used for input panels, settings blocks, results. Appears in nearly every tool.

**Dominant form:**
```
bg-white dark:bg-slate-900
p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm
```

Variation found in `Dashboard.tsx`:
```
bg-white dark:bg-slate-800   ← note: slate-800 not slate-900
rounded-2xl border border-slate-200 dark:border-slate-700   ← slate-700 not slate-800
```

This is a real inconsistency — dark mode card backgrounds alternate between `slate-800` and `slate-900`, and borders alternate between `slate-700` and `slate-800` with no pattern. New tools that copy from `Dashboard` will drift from tools that copy from `ThematicQA`.

---

### 3.3 Icon Badge / Icon Container

Two conventions in active simultaneous use:

**Convention A — Solid colored badge (tool page headers)**
```
p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20
Icon: w-8 h-8 text-white
```
Found in: `ThematicQA`, `TNStandardiser`, `GeneralProofingBot`, `AIQARunner`

**Convention B — Tinted light badge (info pages, card items)**
```
p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl
Icon: w-5 h-5 text-indigo-500
```
Found in: `ToolkitInfo` (tool cards), `Dashboard` activity items (`bg-orange-100 dark:bg-orange-900/30`)

**Convention C — Colored icon inline, no badge background (resource page headers)**
```
Icon: w-7 h-7 text-indigo-500   (no container div)
```
Found in: `UsefulLinks`, `DirectusGuides` header blocks

Three different icon badge conventions with no documented rule for which to use. This is the **primary reason a new page might show a different icon treatment** — there is no canonical "use this for page headers" rule, so developers pick whichever nearby example they copied from.

---

### 3.4 Info/Intro Panel

A secondary descriptive block that appears beneath some page headers.

**Form found in `ToolkitInfo`:**
```
bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4
text-sm text-slate-600 dark:text-slate-400
```

Not present in most tool pages. Only `ToolkitInfo` and `Dashboard` (modal variant) use this pattern. Not yet standardised.

---

### 3.5 Header Action Buttons (Info / Settings)

Icon-only buttons in the top-right of tool headers. Most consistent pattern in the repo.

**Canonical form:**
```
p-2.5
text-slate-400
hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800
rounded-xl transition-all
```

Present in: `TNStandardiser`, `ThematicQA`, `SpreadsheetDeduplicator`.

`GeneralProofingBot` uses a slightly different variant:
```
p-3   ← p-3 not p-2.5
text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800
```

Minor drift — same visual intent, inconsistent padding.

---

### 3.6 Toggle / Mode Selector (Pill Tabs)

Appears in multiple tools for switching modes (single/batch, single/full-lesson, card/list).

**Canonical form:**
```
bg-slate-100 dark:bg-slate-800 rounded-xl p-1
  Button active:   bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white
  Button inactive: text-slate-500 hover:text-slate-700 dark:hover:text-slate-300
```

Found consistently in: `ThematicQA`, `TNStandardiser`, `UsefulLinks`, `DirectusGuides`, `InternalNotes`.

This is the **most consistently applied repeated pattern** in the UI.

---

### 3.7 Primary Action Button

```
py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50
text-white font-bold rounded-xl shadow-lg
active:scale-95 transition-all
flex items-center justify-center gap-3
```

Found in: `GeneralProofingBot`, `SpreadsheetDeduplicator`, others. Mostly consistent.

---

### 3.8 Text Input

```
w-full px-4 py-3 rounded-xl
border border-slate-200 dark:border-slate-700
bg-slate-50 dark:bg-slate-800
text-slate-900 dark:text-white text-sm
focus:outline-none focus:ring-2 focus:ring-indigo-500 transition
```

Found in: `ThematicQA`, `GeneralProofingBot`, others. Mostly consistent with minor `bg` variation (`dark:bg-slate-900` vs `dark:bg-slate-800`).

---

### 3.9 Section Label (Micro-heading)

```
text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider
```
or
```
text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500
```

Two nearly identical variants in use — `tracking-wider` vs `tracking-widest`, `text-xs` vs `text-[10px]`. Not a visual problem but reflects the copy-paste drift pattern.

---

### 3.10 Status / State Badge Colors (only formalized area)

`ReportViewer.tsx` is the one file with an explicit map:

```
STATUS_CONFIG: success → emerald, partial_success → amber, error → red, warning → amber, info → slate
VARIANT_BADGE: success → emerald, warning → amber, error → red, neutral → slate
```

This is the closest thing to a design token the repo currently has. It is only consumed by `ReportViewer`, not referenced elsewhere.

---

### 3.11 Modal Shell

Two modal patterns coexist:

**Pattern A — Full overlay modal (newer, used by `Dashboard` info modal, `TNInfoModal`)**
```
fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm
  └── bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl
        border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]
```

**Pattern B — `ToolSettingsModal` / `UnifiedToolSettingsModal`** — separate components with their own shell. `ToolSettingsModal` (legacy) and `UnifiedToolSettingsModal` (newer) have slightly different headers and padding.

No single canonical modal shell component exists. Header modals, info modals, and settings modals are all shaped by hand or via one of two competing modal components.

---

## 4. Inconsistency Findings

| Pattern | Inconsistency | Where | Why It Matters |
|---|---|---|---|
| Dark card background | `dark:bg-slate-800` vs `dark:bg-slate-900` | `Dashboard` vs `ThematicQA`/`TNStandardiser` | New tools copying from Dashboard will visually differ from tools copying from ThematicQA |
| Dark card border | `dark:border-slate-700` vs `dark:border-slate-800` | Same split | Same issue — slight hue mismatch between card generations |
| Icon badge convention | 3 different badge types (solid, tinted, bare inline) | `ToolkitInfo`, `UsefulLinks`/`DirectusGuides`, all tool headers | Inconsistent visual weight across pages; no documented rule |
| Page header outer padding | `p-8` (tools) vs `p-6` (resources) | Resource pages use `p-6`, tool pages use `p-8` | Resource page headers feel slightly lighter/smaller |
| Header icon size | `w-8 h-8` in badge (tools) vs `w-7 h-7` bare inline (resources) | Same split as above | Visual inconsistency when navigating between tool and resource pages |
| Settings modal component | `ToolSettingsModal` vs `UnifiedToolSettingsModal` | Legacy vs newer tools | Two different admin settings UIs exist; newer tools use Unified, older don't |
| Action button padding | `p-2.5` vs `p-3` | `TNStandardiser`/`ThematicQA` vs `GeneralProofingBot` | Hairline difference but reflects drift pattern |
| Section label size | `text-xs` vs `text-[10px]`, `tracking-wider` vs `tracking-widest` | Various tools | No visual problem today but indicates string-level copy drift |
| Max-width constraint | `max-w-4xl` (`ToolkitInfo`) vs `max-w-5xl` (`ThematicQA`, `ProofingBot`) vs `max-w-6xl` (`TNStandardiser`) vs `max-w-7xl` (resource pages) | All pages | Each tool picked its own max-width; no rule exists |
| Animation class | `animate-fade-in` on root div | Consistent across all tools ✅ | This is actually the most consistent convention |

---

## 5. Icon State Audit

### Current sidebar icon behavior (from `Sidebar.tsx` `NavLink`)

```jsx
// Active state:
'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
Icon: 'text-white'   (overridden by parent)

// Inactive default:
'text-slate-400 dark:text-slate-500'
Icon: 'text-slate-500 group-hover:text-orange-500'

// Inactive hover:
'hover:bg-slate-800 hover:text-orange-500 dark:hover:text-slate-200'
Icon: 'group-hover:text-orange-500'
```

**Active = orange fill card + white icon. Hover = orange icon on dark bg. Default = slate icon.**

### Tool header action button icon behavior

```jsx
// Default: text-slate-400
// Hover: text-indigo-500 + bg-indigo-50 (light) / bg-slate-800 (dark)
```

### Why a new page shows hover-only purple (indigo) icon treatment

When building `ToolkitInfo`, the icon badges in the tool cards use:
```jsx
<div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
  {entry.icon}  // icon is pre-colored text-indigo-500 in TOOLS array
</div>
```

This is **Convention B** — the tinted light badge. The icon color is baked into the `TOOLS` data array as `text-indigo-500`, not applied conditionally. There is no hover treatment on these card badges because they are static info cards.

However, in tool **page headers** (Convention A), the icon is `text-white` inside a solid `bg-indigo-600` container. When a new tool is built copying from a **resource page** (`UsefulLinks`/`DirectusGuides`) rather than a **tool page** (`ThematicQA`/`TNStandardiser`), it gets:
- A bare inline icon colored `text-indigo-500` 
- No container div
- No hover treatment specific to the icon badge

This creates the appearance of a "hover-only purple" state on the action buttons (which do have `hover:text-indigo-500`), while the page icon badge itself appears as always-purple because the inline icon is statically `text-indigo-500`.

**Root cause:** No documented rule separates "icon badge in a page header" from "icon inside an action button" from "icon inside a data card". All three use `text-indigo-500` but in different structural contexts. A developer building a new page chooses whichever nearby example they referenced, resulting in the wrong convention being applied.

---

## 6. Best Canonical References

| Pattern | Best existing reference | File |
|---|---|---|
| Standard tool page header | `ThematicQA` header block | `components/ThematicQA/index.tsx` lines 168–190 |
| Standard resource page header | `UsefulLinks` header block | `components/UsefulLinks.tsx` lines 50–73 |
| Standard info card (tool item) | `ToolkitInfo` tool cards | `components/ToolkitInfo.tsx` lines 271–299 |
| Standard icon badge (solid, tool header) | `TNStandardiser` / `ThematicQA` | Icon badge: `p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20` |
| Standard icon badge (tinted, card item) | `ToolkitInfo` | Icon badge: `p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl` |
| Standard action button (header) | `TNStandardiser` | `p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all` |
| Standard pill tab toggle | `ThematicQA` mode switcher | `bg-slate-100 dark:bg-slate-800 rounded-xl p-1` pill pattern |
| Standard primary action button | `GeneralProofingBot` run button | `py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all` |
| Standard text input | `ThematicQA` theme input | `px-4 py-3 rounded-xl border ... focus:ring-2 focus:ring-indigo-500` |
| Standard status badge system | `ReportViewer.tsx` | `STATUS_CONFIG` map |
| Standard modal shell | `Dashboard.tsx` info modal | `fixed inset-0 z-[100] ... rounded-3xl shadow-2xl` |
| Standard placeholder page | `PlaceholderPage.tsx` | Only genuinely shared page-shell component |

---

## 7. Recommendations for a Future UI System

**Page structure**
- Define one canonical `PageHeader` component: icon badge + title + subtitle + right-side action buttons. This alone would fix the most common drift vector.
- Define one canonical `ContentCard` component with consistent dark mode values (`dark:bg-slate-900`, `dark:border-slate-800`).
- Settle on max-width per page type (tool pages vs resource pages) and document it.

**Icon badges**
- Define two explicit badge variants: `badge-solid` (page headers, `bg-indigo-600`, white icon, `w-8 h-8`) and `badge-tinted` (card items, `bg-indigo-50`, colored icon, `w-5 h-5`). Document when to use each.
- Never use bare inline icons (`text-indigo-500` with no container) in page headers.

**Color conventions**
- Tool page headers: `indigo-600` icon badge.
- Dashboard/hero: `orange-500` gradient — one-off, not for tool pages.
- Resource page headers: should migrate to same `indigo-600` badge convention as tool pages for consistency (currently use bare inline icon).
- Action buttons on hover: `hover:text-indigo-500` is the standard — already consistent, preserve it.

**Dark mode**
- Standardize: content cards → `dark:bg-slate-900` + `dark:border-slate-800`. Currently `Dashboard` uses `slate-800`/`slate-700` which is one level lighter. Pick one.

**Status/state colors**
- Promote `STATUS_CONFIG` from `ReportViewer.tsx` into a shared token file. It is the only existing token-like map and should be the source of truth for all status colors toolkit-wide.

**Modals**
- Deprecate `ToolSettingsModal` in favor of `UnifiedToolSettingsModal` for new tools.
- Document the canonical modal shell structure for info/help modals.

**Guardrails**
- Add to `GUARDRAILS.md`: before building a new tool page header, copy from `ThematicQA` header block as the canonical reference — not from resource pages or `Dashboard`.
- Add to `DEVELOPER_GUIDE.md`: icon badge convention rules (solid vs tinted vs inline).

---

## 8. Suggested Next Artifacts

### `UI_STYLE_GUIDE.md` should cover
1. Color palette — primary (orange), secondary (indigo), neutral (slate), status (emerald/amber/red)
2. Page header pattern — canonical JSX structure with class string definitions
3. Icon badge variants — solid (page headers) and tinted (card items) with explicit sizes
4. Content card shell — class strings for `bg`, `border`, `rounded`, `shadow` in both modes
5. Action button patterns — header icon buttons, primary CTA, secondary
6. Input pattern — text input, textarea, file drop zone
7. Toggle/pill tab — canonical pattern already exists in ThematicQA
8. Status badge colors — promote and cite `STATUS_CONFIG` from `ReportViewer`
9. Max-width conventions by page type
10. Dark mode card background standard — `slate-900` + `slate-800` border

### Shared components worth creating
| Component | Current state | Priority |
|---|---|---|
| `PageHeader` | Hand-copied in 7+ tools | High |
| `ContentCard` | Hand-copied everywhere | Medium |
| `IconBadge` (solid variant) | Hand-copied in 7+ tool headers | High |
| `ActionIconButton` | Nearly consistent — small wrapper | Medium |
| `StatusBadge` | Partially exists in `ReportViewer` `STATUS_CONFIG` | Medium |
| `PillToggle` | Consistent but not shared | Low |

### Guardrail / prompt additions
- Add to `GUARDRAILS.md §9` (Mirror existing patterns): explicitly name `ThematicQA/index.tsx` header as the canonical tool page header reference.
- Add to `DEVELOPER_GUIDE.md` (New tool integration notes): a short "UI patterns to copy" block listing header, card, badge, and action button references.
- Add to AIStudio starter block: note that icon badges in page headers should use the solid `bg-indigo-600` convention, not inline colored icons.

---

## Appendix: Files Inspected

**Components inspected:**
- `components/Dashboard.tsx`
- `components/ToolkitInfo.tsx`
- `components/TNStandardiser/index.tsx`
- `components/ThematicQA/index.tsx`
- `components/GeneralProofingBot/index.tsx`
- `components/InternalNotes.tsx`
- `components/UsefulLinks.tsx`
- `components/DirectusGuides.tsx`
- `components/Sidebar.tsx`
- `components/Header.tsx`
- `components/PlaceholderPage.tsx`
- `components/ReportViewer.tsx`
- `components/SpreadsheetDeduplicator.tsx`

**Docs inspected (pre-read):**
- `app_modularity.md`
- `AGENT_GUIDE.md`
- `GUARDRAILS.md`
- `DEVELOPER_GUIDE.md`
- `AI_Implementation.md`

---

**Likely root-cause files for style drift:**
- `components/Dashboard.tsx` — uses slightly different dark card palette (`slate-800`/`slate-700`) from the rest; often the first file new developers see
- `components/UsefulLinks.tsx` / `components/DirectusGuides.tsx` — use inline bare icon in header instead of badge container; copied pattern produces Convention C mismatches
- `components/ToolkitInfo.tsx` — uses Convention B (tinted badge) in a context that could have used Convention A; was built from resource page references rather than tool page references

**Highest-priority candidates for future standardization:**
1. `PageHeader` component — eliminates the #1 drift vector
2. Icon badge variant documentation — eliminates the icon color/treatment inconsistency
3. Dark mode card background standard — `slate-900` vs `slate-800` needs a definitive answer
4. `STATUS_CONFIG` promoted to a shared token — already exists, just needs to be moved out of `ReportViewer`
