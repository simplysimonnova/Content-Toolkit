# Content Toolkit Agent Guide

This file is the first-stop guide for AI coding assistants working in the Content Toolkit repo.

It does not replace the main docs. It tells the assistant what to read first, how to behave, and what to avoid.

---

## 1. Purpose

The Content Toolkit is a modular internal platform for educational content workflows.

Its purpose is to support content creators with specialized, AI-augmented tools that reduce manual work, improve consistency, and support downstream operational use.

This is a human-in-the-loop system.
Assistants should support reviewable, reliable workflows — not introduce hidden automation, broad autonomous behavior, or architecture drift.

---

## 2. Read these docs first

Choose based on task type:

### For product purpose / scope / decision intent
- `mission_statement.md`

### For architecture / routing / module boundaries / page integration
- `app_modularity.md`

### For AI service changes / model usage / Gemini initialization / shared implementation constraints / navigation sync rules
- `AI_Implementation.md`

### For assistant working style / repo-level prompt behavior
- `AGENT_GUIDE.md`

### For change limits / protected areas / scope control
- `GUARDRAILS.md`

### For local setup / basic run context
- `README.md`

### For tool-specific work
- Read any tool-specific planning or implementation doc if one exists before editing that module.

---

## 3. Core working model

The toolkit is designed around modular independence.

Key principles:
- Each tool is a self-contained unit
- App-level orchestration should stay lightweight
- Shared services should remain centralized
- Admin-configurable behavior should stay dynamic where already supported
- Changes to one tool must not destabilize unrelated tools

Do not assume the repo should be “cleaned up” into a more abstract or unified architecture unless explicitly requested.

---

## 4. What good changes look like

Good changes are:
- tightly scoped
- easy to review
- aligned to the existing architecture
- low-risk to unrelated tools
- consistent with current routing, sidebar, config, and reporting patterns
- additive when possible instead of cross-cutting

Prefer:
- small targeted edits
- mirroring existing patterns
- preserving current behavior unless the task explicitly changes behavior

---

## 5. What to inspect before editing

Before making changes, inspect the existing pattern in code.

Examples:
- adding a page -> inspect current page registration, routing, sidebar placement, and any default/repair-default registration
- integrating a tool -> inspect how similar tools mount, log usage, save reports, and expose settings
- editing AI logic -> inspect `geminiService.ts` and existing tool AI wrappers before changing initialization or model flow
- adding reporting -> inspect current report types, service flow, and viewer pattern before extending

Do not invent a new pattern if a working project pattern already exists.

---

## 6. Navigation / sidebar sync rule

If a task touches navigation, routes, pages, or sidebar entries, inspect the current nav system first.

The sidebar has multiple manually synced parts.
When adding a page, do not update only one place.

Check and keep aligned where relevant:
- page type / page ID definition
- route registration
- app render mapping
- fallback sidebar config
- repair/default sidebar config
- any human-readable nav doc if maintained manually

If an existing repo checklist or pattern exists, mirror it exactly.

---

## 7. Prompting rule for Windsurf-style implementation prompts

When generating implementation prompts for this repo:
- reference the relevant project docs explicitly
- state scope tightly
- list allowed changes
- list forbidden changes
- require mirroring existing patterns before creating new ones
- ask for a short file change summary at the end

Recommended doc references in prompts:
- `mission_statement.md`
- `app_modularity.md`
- `AI_Implementation.md`
- `AGENT_GUIDE.md`
- `GUARDRAILS.md`
- plus any tool-specific doc relevant to the task

---

## 8. Default behavior expectations

Unless explicitly asked otherwise:
- do not refactor broadly
- do not rename files unnecessarily
- do not change shared services casually
- do not alter AI initialization flow
- do not alter reporting/storage architecture casually
- do not rewrite unrelated UI
- do not expand scope from “add” into “restructure”

If something looks inconsistent, flag it briefly in the summary instead of silently redesigning it.

---

## 9. Output style expectations

When helping with repo tasks:
- be concise
- be specific
- prefer implementation-ready wording
- prefer direct recommendations over long explanation
- separate “must do now” from “future improvement”

For prompts:
- optimize for low ambiguity
- include guardrails
- avoid open-ended wording like “clean up”, “improve architecture”, or “modernize” unless explicitly requested

---

## 10. If uncertain

If multiple approaches are possible:
1. follow the existing project pattern
2. choose the least invasive option
3. preserve behavior
4. document assumptions briefly in the summary

If a task appears to conflict with the existing architecture, call that out clearly before proposing a broader change.