export type QAMode = 'full-lesson' | 'chunk-qa' | 'stem-qa' | 'post-design-qa';
export type PDFSourceType = 'gslides' | 'slidescom';
export type NotesPattern = 'inline' | 'separate' | 'none';
export type QAVerdict = 'pass' | 'pass-with-warnings' | 'revision-required' | 'fail';

export interface NormalizedSlide {
  slideNumber: number;
  slideText: string;
  speakerNotes: string | null;
}

export interface NormalizationResult {
  slides: NormalizedSlide[];
  detectedNotesPattern: NotesPattern;
  normalizationConfidence: number;
}

export interface DeterministicResult {
  deterministicPass: boolean;
  flags: string[];
  criticalFail: boolean;
}

export interface QAScore {
  category: string;
  score: number;
  maxScore: number;
  notes: string;
}

export interface QAIssue {
  slideNumber: number | null;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  suggestion: string;
}

export interface QAResult {
  total_score: number;
  verdict: QAVerdict;
  short_summary: string;
  revision_required: boolean;
  revision_triggers: string[];
  strengths: string[];
  issues: QAIssue[];
  risks: string[];
  suggestions: string[];
  scores: QAScore[];
}

export interface QARun {
  id?: string;
  mode: QAMode;
  title: string;
  source_type: PDFSourceType;
  normalized_slide_count: number;
  notes_detected_count: number;
  deterministic_flags: string[];
  structured_scores: QAScore[];
  revision_required: boolean;
  revision_triggers: string[];
  total_score: number;
  verdict: QAVerdict;
  short_summary: string;
  full_report: QAResult;
  raw_ai_response: string;
  parsed_ai_json: QAResult;
  prompt_version: string;
  ai_model: string;
  execution_time_ms: number;
  triggered_by_user_id: string;
  triggered_by_user_email: string;
  created_at: any;
}

export interface QAVersion {
  id?: string;
  mode: QAMode;
  version_tag: string;
  prompt_template: string;
  active: boolean;
  created_at: any;
}

export type ProgressStage =
  | 'idle'
  | 'uploading'
  | 'normalizing'
  | 'deterministic'
  | 'ai-review'
  | 'saving'
  | 'complete'
  | 'error';

export const PROGRESS_LABELS: Record<ProgressStage, string> = {
  idle: '',
  uploading: 'Uploading PDF…',
  normalizing: 'Extracting slides and speaker notes…',
  deterministic: 'Running structural checks…',
  'ai-review': 'Running AI quality review…',
  saving: 'Saving structured results…',
  complete: 'QA complete.',
  error: 'An error occurred.',
};

export const QA_MODE_LABELS: Record<QAMode, string> = {
  'full-lesson': 'Full Lesson QA',
  'chunk-qa': 'Chunk QA',
  'stem-qa': 'STEM QA',
  'post-design-qa': 'Post-Design QA',
};
