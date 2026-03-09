/**
 * QA Engine v1 — Governance Types
 *
 * NON-NEGOTIABLE RULES:
 * - QARunV1 is create-only. No update/delete anywhere in the codebase.
 * - Trigger severity must be resolved from QATriggerDefinition, never parsed from AI text.
 * - Stage status fields on QALesson are written only by QAEngineV1Service.
 * - Thresholds are always fetched from qa_config_v1; never hardcoded.
 * - ENGINE_VERSION = 'v1' is the canonical constant; never use the literal string directly.
 */

import type { Timestamp, FieldValue } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Stage Model
// ---------------------------------------------------------------------------

export type QAStage = 1 | 2 | 3 | 4 | 5;

export type QAStageStatus =
    | 'not_started'
    | 'in_review'
    | 'revision_required'
    | 'cleared';

/** Stage 5 is human-only — final production lock. */
export type QAFinalStatus = 'not_locked' | 'production_ready';

/**
 * Execution status for async-runnable stages (3 and 4).
 * Tracked separately from QAStageStatus to enable retry logic and UI clarity.
 *   idle     — not yet triggered
 *   running  — AI call in progress
 *   complete — run finished (pass or fail outcome recorded)
 *   failed   — unexpected error; safe to retry
 */
export type StageExecutionStatus = 'idle' | 'running' | 'complete' | 'failed';

// ---------------------------------------------------------------------------
// Lesson
// ---------------------------------------------------------------------------

/**
 * Represents a lesson tracked through the QA pipeline.
 * Stage status fields must ONLY be written by QAEngineV1Service.
 * Firestore rules enforce this — writers cannot write these fields directly.
 */
export interface QALesson {
    id?: string;
    title: string;
    qa_version: 'v1';              // permanent version tag — never changes

    selected_module_id: string;
    writer_id: string;

    // -----------------------------------------------------------------------
    // Stage statuses — service-layer writes only.
    // Firestore rules deny writers from writing these fields directly.
    // -----------------------------------------------------------------------
    stage1_status: QAStageStatus;
    stage2_status: QAStageStatus;
    stage3_status: QAStageStatus;  // Proofreading — Phase 2A
    stage4_status: QAStageStatus;  // Design QA    — Phase 2A
    stage5_status: QAStageStatus;  // Human Sign-Off (cannot be AI-cleared)

    /** Set when all 5 stages are cleared. Final production lock. */
    final_production_status: QAFinalStatus;

    /** Legacy field — represents academic clearance (Stages 1+2 only). */
    final_academic_status: QAStageStatus;

    // Set whenever a gate blocks. Cleared only when the stage is re-run and passes.
    blocked_reason?: string;

    // -----------------------------------------------------------------------
    // Audit timestamps — written by service at each transition.
    // Required for stage_time_delta capture (Phase 2C).
    // -----------------------------------------------------------------------
    stage1_started_at?: Timestamp | FieldValue;
    stage1_cleared_at?: Timestamp | FieldValue;
    stage2_started_at?: Timestamp | FieldValue;
    stage2_cleared_at?: Timestamp | FieldValue;
    stage3_started_at?: Timestamp | FieldValue;
    stage3_cleared_at?: Timestamp | FieldValue;
    stage4_started_at?: Timestamp | FieldValue;
    stage4_cleared_at?: Timestamp | FieldValue;
    stage5_started_at?: Timestamp | FieldValue;
    stage5_cleared_at?: Timestamp | FieldValue;

    // -----------------------------------------------------------------------
    // Phase 3 — Execution status (async stages only)
    // Tracks in-flight state for double-trigger prevention and retry logic.
    // Written ONLY by the service layer — protected by Firestore rules.
    // -----------------------------------------------------------------------
    stage3_execution_status?: StageExecutionStatus;
    stage4_execution_status?: StageExecutionStatus;

    // -----------------------------------------------------------------------
    // Structured logging capture — Phase 2C
    // Stored per lesson for audit; not shown in Phase 1 dashboard.
    // -----------------------------------------------------------------------
    proofreading_correction_count?: number;
    proofreading_density?: number;          // corrections per 100 words
    design_correction_count?: number;

    created_at: Timestamp | FieldValue;
    updated_at: Timestamp | FieldValue;
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

/**
 * Admin-controlled definition of a QA module.
 * Severity and blocks_progression are defined HERE — never by AI.
 */
export interface QATriggerDefinition {
    type: string;                               // key that AI selects by name
    label: string;                              // human-readable
    severity: 'minor' | 'major' | 'serious';
    blocks_progression: boolean;                // true for serious triggers
}

export interface QAModule {
    id?: string;
    name: string;
    academic_focus: string;
    ai_prompt: string;                          // system prompt sent to AI
    triggers: QATriggerDefinition[];            // fixed list — AI cannot add to this
    version: number;
    active: boolean;
    created_at?: Timestamp | FieldValue;
    updated_by?: string;
}

// ---------------------------------------------------------------------------
// Trigger Resolution
// ---------------------------------------------------------------------------

/**
 * A trigger result stored on a QA run.
 * severity and blocks_progression are RESOLVED from QATriggerDefinition
 * by resolveTriggers() — never inferred from AI-generated text.
 */
export interface QATriggerResult {
    trigger_type: string;
    severity: 'minor' | 'major' | 'serious';
    blocks_progression: boolean;
}

// ---------------------------------------------------------------------------
// Config (Versioned Thresholds)
// ---------------------------------------------------------------------------

/**
 * Centrally governed QA thresholds.
 * Updating thresholds = creating a new document (active: true) + marking old active: false.
 * Historical runs reference the config version, not the current values.
 */
export interface QAConfigV1 {
    id?: string;
    stage1_min_score: number;       // minimum pass threshold for Stage 1 (out of 50)
    stage2_min_score: number;       // minimum pass threshold for Stage 2 (out of 50)
    active: boolean;
    version: string;                // e.g. "v1.0", "v1.1"
    updated_by: string;
    updated_at: Timestamp | FieldValue;
}

// ---------------------------------------------------------------------------
// QA Run (Immutable)
// ---------------------------------------------------------------------------

/**
 * Immutable record of a single QA execution.
 *
 * CREATE-ONLY. No update or delete is permitted in service code or Firestore rules.
 * All thresholds and module versions are captured at time of run.
 */
export interface QARunV1 {
    id?: string;
    lesson_id: string;
    stage: QAStage;
    engine_version: 'v1';                  // permanent tag
    qa_version: 'v1';                      // mirrors lesson.qa_version

    core_score: number;                    // 0–30
    module_score: number;                  // 0–20
    total_score: number;                   // 0–50

    /**
     * Derived from resolved triggers (blocks_progression = true).
     * NEVER set from AI verdict text.
     */
    serious_trigger_flag: boolean;
    triggers: QATriggerResult[];

    // Threshold governance snapshot
    threshold_used: number;
    threshold_version: string;             // id of the qa_config_v1 doc used

    // Module provenance snapshot
    module_id: string;
    module_version: number;

    status: 'pass' | 'revision-required';
    reviewer_id: string;                   // 'ai' | user uid
    duration_ms: number;

    timestamp: Timestamp | FieldValue;
}

// ---------------------------------------------------------------------------
// Override (Admin-created, immutable)
// ---------------------------------------------------------------------------

export interface QAOverride {
    id?: string;
    qa_run_id: string;
    lesson_id: string;
    override_reason: string;
    approved_by: string;               // Senior Academic Lead uid
    timestamp: Timestamp | FieldValue;
}

// ---------------------------------------------------------------------------
// Disagreement + Escalation (Atomic)
// ---------------------------------------------------------------------------

/**
 * Submitted by a writer when disputing a QA result.
 * Escalation fields are ALWAYS populated on creation — requires_escalation is always true.
 * Created atomically with an escalation entry via batched write.
 * Immutable once resolved_at is set (enforced by Firestore rules).
 */
export interface QADisagreement {
    id?: string;
    lesson_id: string;
    qa_run_id: string;
    writer_id: string;
    justification: string;

    // Escalation — mandatory, set on creation
    requires_escalation: true;
    escalated_to_user_id: string;
    escalation_created_at: Timestamp | FieldValue;

    resolution_status: 'pending' | 'resolved' | 'rejected';
    resolved_by?: string;
    resolved_at?: Timestamp | FieldValue;    // once set, Firestore denies further updates
    resolution_note?: string;
}

// ---------------------------------------------------------------------------
// Lesson Snapshot (Phase 2A)
// ---------------------------------------------------------------------------

/**
 * Created once after Stage 2 clears. Consumed by Stages 3 and 4.
 * Prevents re-parsing the lesson deck on every subsequent stage.
 * CREATE-ONLY — no update or delete permitted.
 */
export interface QALessonSnapshot {
    id?: string;
    lesson_id: string;
    engine_version: 'v1';

    slides_text: string;            // full concatenated slide text
    teacher_notes_text: string;     // full concatenated teacher notes text
    word_count: number;             // total word count across slides + notes
    slide_count: number;            // explicit slide count — do not infer from text
    task_slide_indices: number[];   // 0-based indices of slides identified as task/activity slides
    slide_image_refs: string[];     // storage refs or URLs for slide images (for Stage 4)
    source_hash: string | null;     // SHA-256 of raw ZIP ArrayBuffer — enables future snapshot reuse

    created_at: Timestamp | FieldValue;
}

// ---------------------------------------------------------------------------
// Proofreading Run (Stage 3 — Phase 2B)
// ---------------------------------------------------------------------------

/**
 * Immutable record of a Stage 3 proofreading execution.
 * CREATE-ONLY. No scoring — language clearance only.
 * Gate: blocks Stage 4 if unresolved_errors_flag === true.
 */
export interface QAProofreadingRunV1 {
    id?: string;
    lesson_id: string;
    snapshot_id: string;            // references the QALessonSnapshot consumed
    engine_version: 'v1';

    correction_count: number;
    correction_types: string[];     // categories only — no raw text
    unresolved_errors_flag: boolean; // true = Stage 4 is blocked

    // Derived from snapshot.word_count at time of run
    proofreading_density: number;   // corrections per 100 words

    status: 'cleared' | 'blocked';
    reviewer_id: string;            // 'ai'
    duration_ms: number;

    timestamp: Timestamp | FieldValue;
}

// ---------------------------------------------------------------------------
// Design QA Run (Stage 4 — Phase 2C)
// ---------------------------------------------------------------------------

/**
 * Immutable record of a Stage 4 design QA execution.
 * CREATE-ONLY. Checklist-based — no pedagogy evaluation, no aesthetic commentary.
 * Gate: blocks Stage 5 if critical_visual_mismatch_flag === true.
 */
export interface QADesignRunV1 {
    id?: string;
    lesson_id: string;
    snapshot_id: string;            // references the QALessonSnapshot consumed
    engine_version: 'v1';

    design_issues_count: number;
    critical_visual_mismatch_flag: boolean; // true = Stage 5 is blocked
    issue_types: string[];          // checklist item keys only

    status: 'cleared' | 'blocked';
    reviewer_id: string;            // 'ai'
    duration_ms: number;

    timestamp: Timestamp | FieldValue;
}

// ---------------------------------------------------------------------------
// Metrics Aggregate (Phase 4 — structure only, not used in Phase 1)
// ---------------------------------------------------------------------------

export interface QAMetricsAggregate {
    avg_core_score: number;
    avg_module_score: number;
    revision_rate: number;
    serious_trigger_freq: Record<string, number>;
    time_to_clear_per_stage: Record<QAStage, number>;
    updated_at: Timestamp | FieldValue;
}
