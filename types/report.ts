/**
 * Unified Report Framework — type contract.
 *
 * Tools produce ReportData (structured JSON only).
 * ReportViewer consumes ReportData and owns all layout decisions.
 * Tools must NOT render custom JSX for their output.
 */

// ── Allowed section types (strictly controlled) ──────────────────────────────
// To add a new type: extend this union AND extend the renderer in ReportViewer.
// Do NOT allow arbitrary strings through per-tool code.
export type ReportSectionType =
  | 'summary'
  | 'scorecard'
  | 'table'
  | 'diff'
  | 'text'
  | 'raw';

// ── Section shapes ────────────────────────────────────────────────────────────

export interface SummarySection {
  type: 'summary';
  title?: string;
  /** Short status label displayed as a badge (e.g. "Completed", "Error"). */
  status: 'success' | 'error' | 'warning' | 'info';
  /** One-sentence description of the result. */
  text: string;
}

export interface ScorecardSection {
  type: 'scorecard';
  title?: string;
  items: Array<{
    label: string;
    value: string | number;
    /** Optional badge colour hint — renderer maps to fixed palette. */
    variant?: 'success' | 'warning' | 'error' | 'neutral';
  }>;
}

export interface TableSection {
  type: 'table';
  title?: string;
  columns: string[];
  rows: Array<Record<string, string | number | null>>;
}

export interface DiffSection {
  type: 'diff';
  title?: string;
  before: string;
  after: string;
}

export interface TextSection {
  type: 'text';
  title?: string;
  /** Plain text or pre-formatted string. No HTML. No markdown rendering. */
  content: string;
}

export interface RawSection {
  type: 'raw';
  title?: string;
  /** Arbitrary JSON payload. Rendered as formatted JSON tree. */
  data: Record<string, unknown>;
}

export type ReportSection =
  | SummarySection
  | ScorecardSection
  | TableSection
  | DiffSection
  | TextSection
  | RawSection;

// ── Top-level report data ─────────────────────────────────────────────────────

export interface ReportData {
  /**
   * First section MUST be of type "summary".
   * Sections render in order. Renderer decides layout.
   */
  sections: [SummarySection, ...ReportSection[]];
}

// ── Firestore document shape (tool_reports collection) ────────────────────────

export interface ToolReport {
  id?: string;
  tool_id: string;
  user_id: string;
  created_at: string;        // ISO string
  status: 'success' | 'error';
  summary: string;           // one-line summary (mirrors sections[0].text)
  report_data: ReportData;
  schema_version: string;    // e.g. "1.0"
  metadata?: Record<string, unknown>;
}
