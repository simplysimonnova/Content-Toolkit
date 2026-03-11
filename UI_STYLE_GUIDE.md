# Content Toolkit — UI Style Guide

> Phase 1+2 | March 2026
> Grounded in `UI_AUDIT.md` findings. Documents the real existing patterns — not a new design language.
> See `DEVELOPER_GUIDE.md` for integration notes. See `UI_AUDIT.md` for full audit findings and context.

---

## Guiding Rule

**Reuse shared UI components before writing local class strings.**
If a shared component exists for a pattern, use it. Do not copy-paste the pattern inline.
If no shared component exists yet, copy from the canonical reference listed in this guide.

---

## 1. Color Palette

| Role | Color | Usage |
|---|---|---|
| Primary accent | `orange-500` / `orange-600` | Dashboard hero, sidebar active state, brand header |
| Secondary accent | `indigo-600` / `indigo-500` | Tool page icon badges, action button hover, primary CTA |
| Neutral | `slate-*` | Backgrounds, borders, labels, muted text |
| Success | `emerald-*` | Status badges — see `ReportViewer.tsx` `STATUS_CONFIG` |
| Warning | `amber-*` | Status badges |
| Error | `red-*` | Status badges |

**Do not use orange for page-header icon badges.** Orange is legacy in this context. It is reserved for the dashboard hero banner and sidebar active states only. The `PageHeader` component does not accept `orange` as a valid `iconColor` value — this is enforced by the component's type.
**Do not use bare colored icons in page headers.** See §3.

---

## 2. Page Header

### When to use
Every tool page and resource page gets one page header. It is the first visual element on the page.

### Shared component
Use `components/ui/PageHeader.tsx`.
Do not hand-copy the header pattern.

### Props
```tsx
<PageHeader
  icon={<BookOpen />}           // Lucide icon — no size or color needed
  iconColor="indigo"            // 'indigo' only — orange is not valid for page headers
  title="Tool Name"             // uppercase, font-black — applied by component
  description="Short subtitle"
  actions={<>...</>}            // optional — right-side buttons area
/>
```

### Structure (what the component produces)
```
bg-white dark:bg-slate-900
p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm
flex items-center justify-between gap-4 flex-wrap

  ├── Left: flex items-center gap-4
  │     ├── IconBadge (solid variant — see §3)
  │     └── Title block
  │           ├── h1: text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white
  │           └── p:  text-slate-500 dark:text-slate-400 font-medium
  └── Right (actions): flex items-center gap-2
```

### Canonical reference (before `PageHeader` existed)
`components/ThematicQA/index.tsx` lines 168–190

---

## 3. Icon Badge

### Two variants — use the right one

**Variant: `solid`** — for page headers only
```
p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20
Icon: w-8 h-8 text-white
```
Used by: `PageHeader` (via `IconBadge` with `variant="solid"`)
Never use a bare colored inline icon in a page header. Always use the solid badge.

**Variant: `tinted`** — for card items, list items, inline indicators
```
p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl
Icon: w-5 h-5 text-indigo-500
```
Used by: data cards, tool list items (e.g. `ToolkitInfo` tool cards)

### Shared component
Use `components/ui/IconBadge.tsx`.

```tsx
// Page header badge (solid)
<IconBadge icon={<ShieldCheck />} variant="solid" color="indigo" />

// Card item badge (tinted)
<IconBadge icon={<BookOpen />} variant="tinted" color="indigo" />
```

### What NOT to do
```tsx
// ❌ Bare inline icon in a page header — Convention C, do not use
<ShieldCheck className="w-7 h-7 text-indigo-500" />

// ❌ Hand-copied solid badge — use IconBadge instead
<div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
  <ShieldCheck className="w-8 h-8 text-white" />
</div>
```

---

## 4. Header Action Buttons

Icon-only buttons placed in the right-side `actions` area of `PageHeader`.

```tsx
<button
  onClick={handler}
  title="Label"
  className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all"
>
  <Info className="w-5 h-5" />
</button>
```

- Use `p-2.5` — not `p-2` or `p-3`
- Default color: `text-slate-400`
- Hover: `hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800`

---

## 5. Content Card

Secondary panel used for inputs, settings, results, and section blocks.

```tsx
// Standard content card
<div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
```

**Dark mode standard: `dark:bg-slate-900` + `dark:border-slate-800`.**
Do not use `dark:bg-slate-800` + `dark:border-slate-700` for content cards (that is Dashboard-specific and has drifted).

---

## 6. Max-Width Conventions

| Page type | Max-width |
|---|---|
| Tool pages (AI tools, QA tools, processing tools) | `max-w-5xl` or `max-w-6xl` — match nearest existing tool |
| Resource/info pages (`ToolkitInfo`, `UsefulLinks`, `DirectusGuides`) | `max-w-4xl` or `max-w-7xl` depending on content density |
| Dashboard | No max-width constraint |

No single universal max-width — use the nearest equivalent existing page as reference. Do not introduce a new one without noting it in the summary.

---

## 7. Section Label (Micro-heading)

```tsx
<p className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">
  Section Title
</p>
```

- Use `text-xs` (not `text-[10px]`)
- Use `tracking-widest` (not `tracking-wider`)
- Use `font-black` (not `font-bold` or `font-semibold`)

---

## 8. Pill Tab Toggle

For mode/view switchers. Already the most consistent pattern in the repo — do not deviate.

```tsx
<div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
  <button className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all
    ${active ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white'
             : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
    Label
  </button>
</div>
```

---

## 9. Status / State Colors

Source of truth: `STATUS_CONFIG` in `components/ReportViewer.tsx`.

| State | Color |
|---|---|
| success | emerald |
| partial_success | amber |
| error | red |
| warning | amber |
| info | slate |

Do not introduce new status color mappings outside this table.

---

## 10. Page Entry Animation and Root Wrapper Spacing

All page root `<div>` elements must include both `animate-fade-in` and `space-y-6`. The `space-y-6` is what produces the consistent gap between the `PageHeader` card and the first content section below it. Do not use `mb-*` on the header card itself as a substitute — that pattern breaks when migrated to `PageHeader`.

```tsx
<div className="max-w-5xl mx-auto animate-fade-in space-y-6">
  <PageHeader ... />
  <div> {/* first content section — gets 24px gap above automatically */} </div>
</div>
```

If the page also needs bottom padding, add `pb-20` after `space-y-6`:

```tsx
<div className="max-w-5xl mx-auto animate-fade-in space-y-6 pb-20">
```

---

## 11. Adding a New Page — UI Checklist

1. Use `PageHeader` — import from `components/ui/PageHeader`
2. Use `IconBadge` via `PageHeader` — do not inline badge classes
3. Use `solid` badge variant for page headers — not `tinted` or bare icon
4. Use `indigo` badge color unless the page is explicitly orange-branded (dashboard only)
5. Use `dark:bg-slate-900` + `dark:border-slate-800` for content cards
6. Add `animate-fade-in space-y-6` to the root wrapper div — do not use `mb-*` on the header card for spacing
7. Keep header action buttons at `p-2.5` with the standard hover classes
8. Do not copy header JSX from `Dashboard.tsx`, `UsefulLinks.tsx`, or `DirectusGuides.tsx` — these have not yet been migrated and use older conventions

---

## Shared UI Component Index

| Component | File | Use for |
|---|---|---|
| `PageHeader` | `components/ui/PageHeader.tsx` | All page headers |
| `IconBadge` | `components/ui/IconBadge.tsx` | Icon containers in headers and cards |
| `PlaceholderPage` | `components/PlaceholderPage.tsx` | Not-yet-built tool pages |
| `UnifiedToolSettingsModal` | `components/UnifiedToolSettingsModal.tsx` | Tool settings/config modals (new tools) |
| `ReportViewer` | `components/ReportViewer.tsx` | Report output rendering |

---

## Out of Scope for Phase 1

The following are noted inconsistencies that are **not standardized in this phase**:
- `Dashboard.tsx` dark card palette drift (`slate-800`/`slate-700`) — left as-is
- `UsefulLinks.tsx` / `DirectusGuides.tsx` bare inline icon headers — not migrated yet
- `ToolSettingsModal` vs `UnifiedToolSettingsModal` split — not resolved in this phase
- Modal shell standardization — deferred
- `STATUS_CONFIG` token promotion — deferred

These are Phase 2+ candidates. See `UI_AUDIT.md §8` and the Phase 2 plan.
