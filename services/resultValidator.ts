import type { QAResult, QAVerdict } from '../components/AIQARunner/types';

const VALID_VERDICTS: QAVerdict[] = ['pass', 'pass-with-warnings', 'revision-required', 'fail'];
const VALID_SEVERITIES = ['critical', 'major', 'minor'];

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationOutcome {
  valid: boolean;
  errors: ValidationError[];
  result: QAResult | null;
}

export function validateQAResult(raw: unknown): ValidationOutcome {
  const errors: ValidationError[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: [{ field: 'root', message: 'Response is not an object.' }], result: null };
  }

  const r = raw as Record<string, unknown>;

  // total_score
  if (typeof r.total_score !== 'number' || r.total_score < 0 || r.total_score > 100) {
    errors.push({ field: 'total_score', message: 'Must be a number between 0 and 100.' });
  }

  // verdict
  if (!VALID_VERDICTS.includes(r.verdict as QAVerdict)) {
    errors.push({ field: 'verdict', message: `Must be one of: ${VALID_VERDICTS.join(', ')}.` });
  }

  // short_summary
  if (typeof r.short_summary !== 'string' || r.short_summary.trim().length < 5) {
    errors.push({ field: 'short_summary', message: 'Must be a non-empty string.' });
  }

  // revision_required
  if (typeof r.revision_required !== 'boolean') {
    errors.push({ field: 'revision_required', message: 'Must be a boolean.' });
  }

  // revision_triggers
  if (!Array.isArray(r.revision_triggers)) {
    errors.push({ field: 'revision_triggers', message: 'Must be an array.' });
  }

  // strengths
  if (!Array.isArray(r.strengths)) {
    errors.push({ field: 'strengths', message: 'Must be an array of strings.' });
  }

  // issues
  if (!Array.isArray(r.issues)) {
    errors.push({ field: 'issues', message: 'Must be an array.' });
  } else {
    r.issues.forEach((issue: any, idx: number) => {
      if (!issue || typeof issue !== 'object') {
        errors.push({ field: `issues[${idx}]`, message: 'Each issue must be an object.' });
        return;
      }
      if (!VALID_SEVERITIES.includes(issue.severity)) {
        errors.push({ field: `issues[${idx}].severity`, message: `Must be one of: ${VALID_SEVERITIES.join(', ')}.` });
      }
      if (typeof issue.description !== 'string' || issue.description.trim().length === 0) {
        errors.push({ field: `issues[${idx}].description`, message: 'Must be a non-empty string.' });
      }
      if (typeof issue.suggestion !== 'string') {
        errors.push({ field: `issues[${idx}].suggestion`, message: 'Must be a string.' });
      }
    });
  }

  // risks
  if (!Array.isArray(r.risks)) {
    errors.push({ field: 'risks', message: 'Must be an array of strings.' });
  }

  // suggestions
  if (!Array.isArray(r.suggestions)) {
    errors.push({ field: 'suggestions', message: 'Must be an array of strings.' });
  }

  // scores
  if (!Array.isArray(r.scores)) {
    errors.push({ field: 'scores', message: 'Must be an array.' });
  }

  if (errors.length > 0) {
    return { valid: false, errors, result: null };
  }

  return {
    valid: true,
    errors: [],
    result: raw as QAResult,
  };
}
