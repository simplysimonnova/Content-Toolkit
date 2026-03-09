/**
 * QA Engine v1 — Core Service Layer
 *
 * GOVERNANCE ENFORCEMENT (architecture-level, not convention):
 *
 * 1. Stage fields are written ONLY by this service (updateLessonStage).
 *    Firestore rules deny writers from writing stage fields directly.
 *
 * 2. QA runs are CREATE-ONLY. This service has NO updateDoc or deleteDoc.
 *    Firestore rules enforce `allow update, delete: if false` on qa_runs_v1.
 *
 * 3. Trigger severity is resolved from QATriggerDefinition (module definition).
 *    AI returns trigger_type strings only. resolveTriggers() performs the lookup.
 *    Unknown trigger types are discarded — AI cannot invent severity.
 *
 * 4. Thresholds are ALWAYS fetched from qa_config_v1. Never hardcoded.
 *    threshold_used and threshold_version are captured on every run.
 *
 * 5. Disagreements auto-create escalation via batched write.
 *    Both docs are written atomically — escalation cannot be skipped.
 */

import { Type } from '@google/genai';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    serverTimestamp,
    writeBatch,
    query,
    where,
    orderBy,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { ai } from '../lib/aiClient';
import { getResolvedModelForTool } from '../lib/toolTierResolver';
import { logToolUsage } from './geminiService';
import type { CapabilityTier } from '../lib/modelRegistry';
import type {
    QALesson,
    QAModule,
    QAConfigV1,
    QARunV1,
    QAStage,
    QAStageStatus,
    StageExecutionStatus,
    QATriggerDefinition,
    QATriggerResult,
    QADisagreement,
    QALessonSnapshot,
    QAProofreadingRunV1,
    QADesignRunV1,
} from '../types/qa-v1';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * ENGINE_VERSION is the single source of truth for the version tag.
 * It is stamped on every QARunV1 and QALesson document.
 * Never use the string 'v1' directly — always reference this constant.
 */
export const ENGINE_VERSION = 'v1' as const;
export type EngineVersion = typeof ENGINE_VERSION;

const CORE_MAX = 30;
const MODULE_MAX = 20;
const TOOL_ID = 'qa-engine-v1';
const ALLOWED_TIERS: CapabilityTier[] = ['default'];

const COLLECTIONS = {
    LESSONS: 'qa_lessons',
    RUNS: 'qa_runs_v1',
    MODULES: 'qa_modules',
    CONFIG: 'qa_config_v1',
    DISAGREEMENTS: 'qa_disagreements',
    OVERRIDES: 'qa_overrides',
    ESCALATIONS: 'qa_escalations',
    SNAPSHOTS: 'qa_snapshots',
    PROOFREADING_RUNS: 'qa_proofreading_runs_v1',
    DESIGN_RUNS: 'qa_design_runs_v1',
} as const;

const PROOFREADING_TOOL_ID = 'qa-engine-v1-stage3';
const DESIGN_TOOL_ID = 'qa-engine-v1-stage4';
const LEAN_TIERS: CapabilityTier[] = ['default'];

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

export class GateBlockedError extends Error {
    constructor(public readonly reason: string) {
        super(`QA gate blocked: ${reason}`);
        this.name = 'GateBlockedError';
    }
}

export class QAEngineError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QAEngineError';
    }
}

/**
 * Thrown when the qa_config_v1 collection has zero OR more than one active document.
 * Either state is a governance violation — exactly one must be active at all times.
 */
export class ConfigIntegrityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigIntegrityError';
    }
}

// ---------------------------------------------------------------------------
// AI Response Schema
// ---------------------------------------------------------------------------

/**
 * The AI is told ONLY to return trigger_type strings from the module's trigger list.
 * Severity is resolved server-side from module definition — never from AI text.
 */
const AI_RESPONSE_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        core_score: {
            type: Type.NUMBER,
            description: 'Core academic score, 0-30',
        },
        module_score: {
            type: Type.NUMBER,
            description: 'Module-specific score, 0-20',
        },
        short_summary: { type: Type.STRING },
        trigger_types: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Trigger type strings only, chosen from the provided trigger list',
        },
        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
        issues: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    slide_number: { type: Type.NUMBER },
                    severity: { type: Type.STRING, enum: ['critical', 'major', 'minor'] },
                    description: { type: Type.STRING },
                    suggestion: { type: Type.STRING },
                },
                required: ['severity', 'description', 'suggestion'],
            },
        },
    },
    required: ['core_score', 'module_score', 'short_summary', 'trigger_types', 'strengths', 'issues'],
};

// ---------------------------------------------------------------------------
// Phase 2B — Stage 3 AI Schema (lean: language only)
// ---------------------------------------------------------------------------

/**
 * Minimal schema — no scoring, no pedagogy, language clearance only.
 * Prompt is kept short to hit the < 5s target.
 */
const PROOFREADING_AI_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        correction_count: {
            type: Type.NUMBER,
            description: 'Total number of language corrections identified',
        },
        correction_types: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Category labels only (e.g. "spelling", "grammar", "punctuation"). No raw text.',
        },
        unresolved_errors_flag: {
            type: Type.BOOLEAN,
            description: 'true if errors remain that must be fixed before design handover',
        },
    },
    required: ['correction_count', 'correction_types', 'unresolved_errors_flag'],
};

const PROOFREADING_SYSTEM_PROMPT =
    'You are a language proofreader for children\'s EFL lesson materials.\n' +
    'Check ONLY for spelling, grammar, punctuation, and capitalisation errors.\n' +
    'Do NOT evaluate pedagogy, content quality, or design.\n' +
    'Do NOT reproduce corrected text — return category labels only.\n' +
    'Set unresolved_errors_flag to true if any errors require author action before production.\n' +
    'Return JSON matching the schema exactly.';

// ---------------------------------------------------------------------------
// Phase 2C — Stage 4 AI Schema (lean: checklist-based visual alignment)
// ---------------------------------------------------------------------------

/**
 * Minimal schema — checklist evaluation against task slides only.
 * No aesthetic commentary. No pedagogy re-evaluation.
 * Prompt is bounded to task_slide_indices to hit the < 7s target.
 */
const DESIGN_AI_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        design_issues_count: {
            type: Type.NUMBER,
            description: 'Total number of design checklist failures',
        },
        critical_visual_mismatch_flag: {
            type: Type.BOOLEAN,
            description: 'true if a task slide instruction does not match its visual content',
        },
        issue_types: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Checklist item keys that failed (e.g. "instruction_image_mismatch", "missing_task_visual")',
        },
    },
    required: ['design_issues_count', 'critical_visual_mismatch_flag', 'issue_types'],
};

const DESIGN_SYSTEM_PROMPT =
    'You are a design QA checker for children\'s EFL lesson slides.\n' +
    'Check ONLY whether task slide instructions match their visual content.\n' +
    'Evaluate ONLY the task slides provided — do not evaluate non-task slides.\n' +
    'Do NOT comment on aesthetics, colour, or layout style.\n' +
    'Do NOT re-evaluate pedagogy or academic content.\n' +
    'Set critical_visual_mismatch_flag to true if any task instruction is visually misrepresented.\n' +
    'Return JSON matching the schema exactly.';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the EXACTLY ONE active QAConfigV1.
 * Throws ConfigIntegrityError if:
 *   - No active config exists (admin must create one)
 *   - MORE than one active config exists (data integrity violation)
 * This is a hard gate — QA cannot run without a valid config.
 */
async function fetchActiveConfig(): Promise<{ config: QAConfigV1; configId: string }> {
    const q = query(
        collection(db, COLLECTIONS.CONFIG),
        where('active', '==', true),
        orderBy('updated_at', 'desc')
    );
    const snap = await getDocs(q);

    if (snap.empty) {
        throw new ConfigIntegrityError(
            '[QA Config] No active qa_config_v1 document found. ' +
            'An admin must create a threshold config before QA can run.'
        );
    }

    // Exactly one active config must exist at all times
    if (snap.docs.length > 1) {
        const ids = snap.docs.map(d => d.id).join(', ');
        throw new ConfigIntegrityError(
            `[QA Config] Data integrity violation: ${snap.docs.length} active configs found (IDs: ${ids}). ` +
            'Only one qa_config_v1 document may be active. Resolve in Admin → QA Config.'
        );
    }

    const configDoc = snap.docs[0];
    return { config: configDoc.data() as QAConfigV1, configId: configDoc.id };
}

/** Fetch a lesson by ID. */
async function fetchLesson(lessonId: string): Promise<QALesson> {
    const snap = await getDoc(doc(db, COLLECTIONS.LESSONS, lessonId));
    if (!snap.exists()) throw new QAEngineError(`Lesson not found: ${lessonId}`);
    return { id: snap.id, ...snap.data() } as QALesson;
}

/** Fetch a module by ID. */
async function fetchModule(moduleId: string): Promise<QAModule> {
    const snap = await getDoc(doc(db, COLLECTIONS.MODULES, moduleId));
    if (!snap.exists()) throw new QAEngineError(`QA Module not found: ${moduleId}`);
    return { id: snap.id, ...snap.data() } as QAModule;
}

/**
 * Resolve AI-returned trigger_type strings against module trigger definitions.
 * Unknown types are discarded + warned. Severity comes from the definition — never AI text.
 */
function resolveTriggers(
    aiTriggerTypes: string[],
    moduleDefinitions: QATriggerDefinition[]
): QATriggerResult[] {
    const defMap = new Map(moduleDefinitions.map(d => [d.type, d]));
    const resolved: QATriggerResult[] = [];

    for (const type of aiTriggerTypes) {
        const def = defMap.get(type);
        if (!def) {
            console.warn(`[QAEngineV1] Unknown trigger type discarded: "${type}". AI returned a type not in module definition.`);
            continue;
        }
        resolved.push({
            trigger_type: def.type,
            severity: def.severity,
            blocks_progression: def.blocks_progression,
        });
    }

    return resolved;
}

/**
 * Enforce sequential stage gate.
 *
 * Rules (ALL enforced — full chain, not just immediate prerequisite):
 *   Stage 2 requires Stage 1 cleared
 *   Stage 3 requires Stages 1 AND 2 cleared
 *   Stage 4 requires Stages 1, 2, AND 3 cleared
 *   Stage 5 CANNOT be run by AI — throws always, even if all prior stages cleared
 *
 * This function ALWAYS runs before the AI call. It throws GateBlockedError
 * on any violation — fails closed, never silently continues.
 */
function checkGate(lesson: QALesson, stage: QAStage): void {
    if (stage === 5) {
        throw new GateBlockedError(
            'Stage 5 (Final Sign-Off) cannot be AI-cleared. ' +
            'It requires explicit human approval via the admin sign-off action.'
        );
    }

    // Full chain — every stage prior to the requested stage must be cleared.
    const STAGE_LABELS: Record<number, string> = {
        1: 'Stage 1 (Draft Academic QA)',
        2: 'Stage 2 (Full Lesson QA)',
        3: 'Stage 3 (Proofreading)',
        4: 'Stage 4 (Design QA)',
    };
    const STATUS_FIELDS: Record<number, keyof QALesson> = {
        1: 'stage1_status',
        2: 'stage2_status',
        3: 'stage3_status',
        4: 'stage4_status',
    };

    for (let s = 1; s < stage; s++) {
        const field = STATUS_FIELDS[s];
        if (lesson[field] !== 'cleared') {
            throw new GateBlockedError(
                `Stage ${stage} cannot run: ${STAGE_LABELS[s]} status is "${lesson[field]}". ` +
                `All prior stages must be cleared before Stage ${stage} can proceed.`
            );
        }
    }
}

/** Cap and sum scores — enforces the 30/20 model. */
function calculateScore(rawCore: number, rawModule: number): { core: number; module: number; total: number } {
    const core = Math.min(CORE_MAX, Math.max(0, Math.round(rawCore)));
    const module = Math.min(MODULE_MAX, Math.max(0, Math.round(rawModule)));
    return { core, module, total: core + module };
}

/** Build the system prompt for the AI — includes the module's trigger list by type key only. */
function buildSystemPrompt(module: QAModule, stage: QAStage): string {
    const triggerList = module.triggers.map(t => `- "${t.type}": ${t.label}`).join('\n');
    const scopeLabel = stage === 1 ? 'Draft (slides only)' : 'Full Lesson (slides + teacher notes)';

    return `${module.ai_prompt}

STAGE: ${scopeLabel}
SCORING:
  - core_score: 0–${CORE_MAX} (overall academic quality)
  - module_score: 0–${MODULE_MAX} (module-specific criteria)

TRIGGER SELECTION:
You must only select triggers from this fixed list. Return the exact type key strings in trigger_types[].
Do NOT invent new triggers or describe severity — only return the type key.

${triggerList}

Return JSON matching the response schema exactly.`;
}

/** Build the user content prompt from content. */
function buildUserPrompt(content: { slides: string; notes?: string }, stage: QAStage): string {
    const parts = [`SLIDE CONTENT:\n${content.slides}`];
    if (stage === 2 && content.notes) {
        parts.push(`TEACHER NOTES:\n${content.notes}`);
    }
    parts.push('Perform the QA review and return the JSON report.');
    return parts.join('\n\n');
}

/**
 * Write lesson stage state. This is the ONLY path that updates stage fields.
 * Called internally after a QA run is logged. Never exposed externally for direct mutation.
 *
 * Handles stages 1-4 (AI-runnable stages only).
 * Stage 5 (human sign-off) is handled by approveStage5SignOff().
 *
 * Timestamp policy:
 *   - *_started_at is set on every status transition to 'in_review' OR 'revision_required'
 *     (i.e. whenever work is beginning or restarting on a stage).
 *   - *_cleared_at is set ONLY when status === 'cleared'. Never retroactively cleared.
 *   - Neither timestamp is ever unset or overwritten once set to a terminal value.
 */
async function updateLessonStage(
    lessonId: string,
    stage: QAStage,
    status: QAStageStatus,
    blockedReason?: string
): Promise<void> {
    if (stage < 1 || stage > 4) {
        throw new QAEngineError(
            `updateLessonStage called with invalid stage ${stage}. ` +
            'Only stages 1–4 are AI-runnable. Stage 5 is handled by approveStage5SignOff().'
        );
    }

    const stageKey = `stage${stage}_status`;
    const startedAtKey = `stage${stage}_started_at`;
    const clearedAtKey = `stage${stage}_cleared_at`;

    const updates: Record<string, any> = {
        [stageKey]: status,
        updated_at: serverTimestamp(),
    };

    if (status === 'cleared') {
        updates[clearedAtKey] = serverTimestamp();

        // Stage 2 clearance = academic layer complete
        if (stage === 2) {
            updates['final_academic_status'] = 'cleared';
        }

        // Stage 4 clearance enables the Stage 5 gate — human sign-off required.
        // final_production_status is NOT set here; only approveStage5SignOff() sets it.
    } else if (status === 'revision_required') {
        // Revision re-opens the stage — record the attempt timestamp
        updates[startedAtKey] = serverTimestamp();
    }

    if (blockedReason !== undefined) {
        updates['blocked_reason'] = blockedReason;
    } else if (status === 'cleared') {
        // Clear any prior blocked reason when a stage passes
        updates['blocked_reason'] = null;
    }

    await updateDoc(doc(db, COLLECTIONS.LESSONS, lessonId), updates);
}

/**
 * Human Sign-Off: Stage 5 — Final Production Lock.
 *
 * Cannot be called by the AI execution path.
 * Must be called by a human admin/senior lead via the admin UI.
 * Requires all prior stages (1-4) to be cleared before locking.
 * Sets final_production_status to 'production_ready'.
 */
export async function approveStage5SignOff(
    lessonId: string,
    approvedByUserId: string
): Promise<void> {
    const lesson = await fetchLesson(lessonId);

    // Gate 1 — all prior stages must be cleared
    const allPriorStagesCleared =
        lesson.stage1_status === 'cleared' &&
        lesson.stage2_status === 'cleared' &&
        lesson.stage3_status === 'cleared' &&
        lesson.stage4_status === 'cleared';

    if (!allPriorStagesCleared) {
        throw new GateBlockedError(
            'Stage 5 Final Sign-Off cannot be approved: all prior stages (1-4) must be cleared. ' +
            `Stage statuses: 1=${lesson.stage1_status} 2=${lesson.stage2_status} ` +
            `3=${lesson.stage3_status} 4=${lesson.stage4_status}`
        );
    }

    // Gate 2 — no unresolved proofreading errors
    if (lesson.proofreading_correction_count !== undefined &&
        lesson.proofreading_correction_count > 0 &&
        lesson.stage3_status !== 'cleared') {
        throw new GateBlockedError(
            'Stage 5 Final Sign-Off cannot be approved: Stage 3 has unresolved proofreading corrections. ' +
            `Correction count: ${lesson.proofreading_correction_count}`
        );
    }

    // Gate 3 — snapshot must exist before production lock
    const snapshotResult = await fetchSnapshot(lessonId);
    if (!snapshotResult) {
        throw new GateBlockedError(
            'Stage 5 Final Sign-Off cannot be approved: no lesson snapshot found. ' +
            'A snapshot is required for production audit traceability.'
        );
    }

    await updateDoc(doc(db, COLLECTIONS.LESSONS, lessonId), {
        stage5_status: 'cleared',
        stage5_started_at: serverTimestamp(),
        stage5_cleared_at: serverTimestamp(),
        final_production_status: 'production_ready',
        blocked_reason: null,
        updated_at: serverTimestamp(),
    });

    // Log the sign-off as a QA override record (immutable audit trail)
    await addDoc(collection(db, COLLECTIONS.OVERRIDES), {
        lesson_id: lessonId,
        action: 'stage5_signoff',
        approved_by: approvedByUserId,
        engine_version: ENGINE_VERSION,
        snapshot_id: snapshotResult.snapshotId,
        timestamp: serverTimestamp(),
    });
}

// ---------------------------------------------------------------------------
// Core QA Execution
// ---------------------------------------------------------------------------

async function executeQAStage(
    lessonId: string,
    stage: QAStage,
    content: { slides: string; notes?: string }
): Promise<QARunV1> {
    const startTime = Date.now();
    const user = auth.currentUser;
    if (!user) throw new QAEngineError('Authentication required to run QA.');

    // 1. Fetch lesson, module, config — all from Firestore, nothing hardcoded
    const lesson = await fetchLesson(lessonId);
    const module_ = await fetchModule(lesson.selected_module_id);
    const { config, configId } = await fetchActiveConfig();

    // 2. Hard gate check — throws before any AI call if blocked
    checkGate(lesson, stage);

    // 3. Mark stage as in_review + record start timestamp
    const startUpdateFields: Record<string, any> = {
        [`stage${stage}_status`]: 'in_review',
        [`stage${stage}_started_at`]: serverTimestamp(),
        updated_at: serverTimestamp(),
    };
    await updateDoc(doc(db, COLLECTIONS.LESSONS, lessonId), startUpdateFields);

    // 4. Resolve model
    const { model, tier } = await getResolvedModelForTool(TOOL_ID, ALLOWED_TIERS);

    // 5. Build prompts
    const systemPrompt = buildSystemPrompt(module_, stage);
    const userPrompt = buildUserPrompt(content, stage);

    // 6. Call AI — returns trigger_type strings only
    let aiRaw = '';
    let aiParsed: any;
    try {
        const response = await ai.models.generateContent({
            model,
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.1,
                responseMimeType: 'application/json',
                responseSchema: AI_RESPONSE_SCHEMA,
            },
        });
        aiRaw = response.text || '';
        if (!aiRaw.trim()) throw new Error('AI returned an empty response.');
        aiParsed = JSON.parse(aiRaw);
    } catch (err: any) {
        const durationMs = Date.now() - startTime;
        await logToolUsage({
            tool_id: TOOL_ID,
            tool_name: 'QA Engine v1',
            model,
            tier,
            status: 'error',
            execution_time_ms: durationMs,
            metadata: { stage, lessonId, error: err.message },
        });
        // Revert stage status
        await updateLessonStage(lessonId, stage, 'revision_required', `AI call failed: ${err.message}`);
        throw new QAEngineError(`AI QA failed: ${err.message}`);
    }

    // 7. Resolve triggers — severity from module definition ONLY
    const resolvedTriggers = resolveTriggers(
        Array.isArray(aiParsed.trigger_types) ? aiParsed.trigger_types : [],
        module_.triggers
    );

    // 8. Derive serious flag from resolved triggers — never from AI text
    const seriousFlag = resolvedTriggers.some(t => t.blocks_progression);

    // 9. Calculate score — enforces 30/20 caps
    const { core, module: modScore, total } = calculateScore(
        aiParsed.core_score ?? 0,
        aiParsed.module_score ?? 0
    );

    // 10. Determine threshold from config
    const threshold = stage === 1 ? config.stage1_min_score : config.stage2_min_score;

    // 11. Evaluate gate outcome
    let runStatus: 'pass' | 'revision-required' = 'pass';
    let blockedReason: string | undefined;

    if (seriousFlag) {
        runStatus = 'revision-required';
        const seriousTriggers = resolvedTriggers
            .filter(t => t.blocks_progression)
            .map(t => t.trigger_type)
            .join(', ');
        blockedReason = `Serious trigger(s) detected: ${seriousTriggers}. Score cannot override a serious trigger.`;
    } else if (total < threshold) {
        runStatus = 'revision-required';
        blockedReason = `Score ${total}/50 is below the required threshold of ${threshold}.`;
    }

    const stageStatus: QAStageStatus = runStatus === 'pass' ? 'cleared' : 'revision_required';
    const durationMs = Date.now() - startTime;

    // 12. Build immutable run record — ENGINE_VERSION constant prevents string drift
    const run: Omit<QARunV1, 'id'> = {
        lesson_id: lessonId,
        stage,
        engine_version: ENGINE_VERSION,
        qa_version: ENGINE_VERSION,
        core_score: core,
        module_score: modScore,
        total_score: total,
        serious_trigger_flag: seriousFlag,
        triggers: resolvedTriggers,
        threshold_used: threshold,
        threshold_version: configId,
        module_id: lesson.selected_module_id,
        module_version: module_.version,
        status: runStatus,
        reviewer_id: 'ai',
        duration_ms: durationMs,
        timestamp: serverTimestamp() as any,
    };

    // 13. CREATE-ONLY log — this service has no updateDoc for runs
    const runRef = await addDoc(collection(db, COLLECTIONS.RUNS), run);

    // 14. Update lesson stage state (controlled path only)
    await updateLessonStage(lessonId, stage, stageStatus, blockedReason);

    // 15. Log tool usage
    await logToolUsage({
        tool_id: TOOL_ID,
        tool_name: 'QA Engine v1',
        model,
        tier,
        status: 'success',
        execution_time_ms: durationMs,
        metadata: { stage, lessonId, runStatus, total_score: total, serious_flag: seriousFlag },
    });

    return { ...run, id: runRef.id } as QARunV1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Stage 1: Draft Academic QA — slides only. */
export async function runDraftQA(lessonId: string, slides: string): Promise<QARunV1> {
    return executeQAStage(lessonId, 1, { slides });
}

/**
 * Stage 2: Full Lesson QA — slides + teacher notes.
 * Blocked if Stage 1 is not cleared.
 */
export async function runFullQA(
    lessonId: string,
    slides: string,
    notes: string
): Promise<QARunV1> {
    return executeQAStage(lessonId, 2, { slides, notes });
}

/**
 * Submit a writer disagreement on a QA result.
 * ATOMICALLY creates disagreement + escalation entry in a single batch write.
 * escalated_to_user_id must be pre-configured as the Senior Academic Lead uid.
 */
export async function submitDisagreement(
    lessonId: string,
    qaRunId: string,
    writerId: string,
    justification: string,
    seniorLeadUserId: string
): Promise<void> {
    if (!justification.trim()) {
        throw new QAEngineError('A written justification is required to submit a disagreement.');
    }

    const batch = writeBatch(db);
    const disagreementRef = doc(collection(db, COLLECTIONS.DISAGREEMENTS));

    const disagreement: Omit<QADisagreement, 'id'> = {
        lesson_id: lessonId,
        qa_run_id: qaRunId,
        writer_id: writerId,
        justification: justification.trim(),
        requires_escalation: true,
        escalated_to_user_id: seniorLeadUserId,
        escalation_created_at: serverTimestamp() as any,
        resolution_status: 'pending',
    };

    batch.set(disagreementRef, disagreement);

    // The escalation entry is ALWAYS written in the same batch — cannot be skipped
    const escalationRef = doc(collection(db, 'qa_escalations'));
    batch.set(escalationRef, {
        disagreement_id: disagreementRef.id,
        lesson_id: lessonId,
        qa_run_id: qaRunId,
        writer_id: writerId,
        escalated_to_user_id: seniorLeadUserId,
        status: 'pending',
        created_at: serverTimestamp(),
    });

    await batch.commit();
}

// ---------------------------------------------------------------------------
// Phase 2A — Snapshot
// ---------------------------------------------------------------------------

/**
 * Fetch an existing snapshot for a lesson, or return null if none exists.
 * Stages 3 and 4 call this first — they never re-parse the deck.
 */
async function fetchSnapshot(lessonId: string): Promise<{ snapshot: QALessonSnapshot; snapshotId: string } | null> {
    const q = query(
        collection(db, COLLECTIONS.SNAPSHOTS),
        where('lesson_id', '==', lessonId),
        where('engine_version', '==', ENGINE_VERSION)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { snapshot: { id: d.id, ...d.data() } as QALessonSnapshot, snapshotId: d.id };
}

/**
 * Create and persist the lesson analysis snapshot.
 *
 * Must be called after Stage 2 clears — before Stage 3 or 4 can run.
 * Idempotent: if a snapshot already exists for this lesson, returns it without
 * creating a duplicate.
 *
 * @param lessonId  - The lesson to snapshot.
 * @param slidesText - Concatenated slide text (caller extracts from deck).
 * @param notesText  - Concatenated teacher notes text.
 * @param taskSlideIndices - 0-based indices of task/activity slides.
 * @param slideImageRefs  - Storage refs or URLs for slide images (Stage 4 input).
 */
export async function createLessonSnapshot(
    lessonId: string,
    slidesText: string,
    notesText: string,
    taskSlideIndices: number[],
    slideImageRefs: string[],
    slideCount: number = 0,
    sourceHash: string | null = null
): Promise<{ snapshot: QALessonSnapshot; snapshotId: string }> {
    const user = auth.currentUser;
    if (!user) throw new QAEngineError('Authentication required to create a snapshot.');

    // Idempotency — return existing snapshot if already created
    const existing = await fetchSnapshot(lessonId);
    if (existing) return existing;

    // Verify Stage 2 is cleared before allowing snapshot creation
    const lesson = await fetchLesson(lessonId);
    if (lesson.stage2_status !== 'cleared') {
        throw new GateBlockedError(
            'Snapshot cannot be created: Stage 2 (Full Lesson QA) must be cleared first.'
        );
    }

    const wordCount = (slidesText + ' ' + notesText)
        .split(/\s+/)
        .filter(w => w.length > 0).length;

    const snapshotData: Omit<QALessonSnapshot, 'id'> = {
        lesson_id: lessonId,
        engine_version: ENGINE_VERSION,
        slides_text: slidesText,
        teacher_notes_text: notesText,
        word_count: wordCount,
        slide_count: slideCount,
        task_slide_indices: taskSlideIndices,
        slide_image_refs: slideImageRefs,
        source_hash: sourceHash,
        created_at: serverTimestamp() as any,
    };

    const ref = await addDoc(collection(db, COLLECTIONS.SNAPSHOTS), snapshotData);
    return { snapshot: { ...snapshotData, id: ref.id }, snapshotId: ref.id };
}

// ---------------------------------------------------------------------------
// Phase 2B — Stage 3: Proofreading
// ---------------------------------------------------------------------------

/**
 * Run Stage 3 Proofreading QA.
 *
 * Governance:
 *   - Requires Stage 1 + 2 cleared (enforced by checkGate).
 *   - Requires a snapshot — throws if none exists.
 *   - Consumes snapshot.slides_text + snapshot.teacher_notes_text ONLY.
 *   - Uses lean model — no scoring, no pedagogy.
 *   - Blocks Stage 4 if unresolved_errors_flag === true.
 *   - Writes immutable QAProofreadingRunV1 record (CREATE-ONLY).
 *   - Writes proofreading_correction_count + proofreading_density to lesson.
 *
 * Execution model: independent — not chained from Stage 2 runtime.
 * Trigger: manual admin action or background job after snapshot exists.
 */
export async function runProofreadingQA(lessonId: string): Promise<QAProofreadingRunV1> {
    const startTime = Date.now();
    const user = auth.currentUser;
    if (!user) throw new QAEngineError('Authentication required to run QA.');

    // 1. Fetch lesson + gate check
    const lesson = await fetchLesson(lessonId);
    checkGate(lesson, 3);

    // 2. Idempotency guard — block re-run unless revision_required or failed
    const execStatus = lesson.stage3_execution_status;
    if (execStatus === 'running') {
        throw new QAEngineError(
            'Stage 3 is already running. Wait for the current execution to complete before retrying.'
        );
    }
    if (execStatus === 'complete' && lesson.stage3_status === 'cleared') {
        throw new QAEngineError(
            'Stage 3 is already cleared. Re-run is only permitted if status is revision_required.'
        );
    }

    // 3. Require snapshot — Stage 3 never re-parses the deck
    const snapshotResult = await fetchSnapshot(lessonId);
    if (!snapshotResult) {
        throw new QAEngineError(
            'Stage 3 requires a lesson snapshot. ' +
            'Call createLessonSnapshot() after Stage 2 clears before running Stage 3.'
        );
    }
    const { snapshot, snapshotId } = snapshotResult;

    // 4. Snapshot integrity check — fail closed if snapshot data is unusable
    if (snapshot.word_count <= 0) {
        throw new QAEngineError(
            'Stage 3 aborted: snapshot word_count is 0. ' +
            'Re-create the snapshot with valid slide and notes content.'
        );
    }

    // 5. Mark execution running + stage in_review
    await updateDoc(doc(db, COLLECTIONS.LESSONS, lessonId), {
        stage3_status: 'in_review',
        stage3_started_at: serverTimestamp(),
        stage3_execution_status: 'running' as StageExecutionStatus,
        updated_at: serverTimestamp(),
    });

    // 6. Resolve lean model
    const { model, tier } = await getResolvedModelForTool(PROOFREADING_TOOL_ID, LEAN_TIERS);

    // 7. Build lean user prompt — slides + notes text from snapshot only
    const userPrompt =
        `SLIDE TEXT:\n${snapshot.slides_text}\n\n` +
        `TEACHER NOTES:\n${snapshot.teacher_notes_text}\n\n` +
        'Identify all language errors and return the JSON report.';

    // 8. AI call — lean schema, low temperature
    let aiParsed: any;
    try {
        const response = await ai.models.generateContent({
            model,
            contents: userPrompt,
            config: {
                systemInstruction: PROOFREADING_SYSTEM_PROMPT,
                temperature: 0.05,
                responseMimeType: 'application/json',
                responseSchema: PROOFREADING_AI_SCHEMA,
            },
        });
        const aiRaw = response.text || '';
        if (!aiRaw.trim()) throw new Error('AI returned an empty response.');
        aiParsed = JSON.parse(aiRaw);
    } catch (err: any) {
        const durationMs = Date.now() - startTime;
        await logToolUsage({
            tool_id: PROOFREADING_TOOL_ID,
            tool_name: 'QA Engine v1 — Stage 3 Proofreading',
            model,
            tier,
            status: 'error',
            execution_time_ms: durationMs,
            metadata: { stage: 3, lessonId, error: err.message },
        });
        // Mark failed — safe to retry manually
        await updateDoc(doc(db, COLLECTIONS.LESSONS, lessonId), {
            stage3_execution_status: 'failed' as StageExecutionStatus,
            blocked_reason: `Stage 3 AI call failed: ${err.message}`,
            updated_at: serverTimestamp(),
        });
        throw new QAEngineError(`Stage 3 Proofreading failed: ${err.message}`);
    }

    // 9. Derive structured fields
    const correctionCount: number = Math.max(0, Math.round(aiParsed.correction_count ?? 0));
    const correctionTypes: string[] = Array.isArray(aiParsed.correction_types) ? aiParsed.correction_types : [];
    const unresolvedFlag: boolean = Boolean(aiParsed.unresolved_errors_flag);

    // 10. Calculate density — corrections per 100 words
    const density = snapshot.word_count > 0
        ? Math.round((correctionCount / snapshot.word_count) * 100 * 100) / 100
        : 0;

    // 11. Gate outcome
    const stageStatus: QAStageStatus = unresolvedFlag ? 'revision_required' : 'cleared';
    const runStatus: 'cleared' | 'blocked' = unresolvedFlag ? 'blocked' : 'cleared';
    const blockedReason = unresolvedFlag
        ? `Unresolved language errors detected (${correctionCount} correction(s)). Must be resolved before design handover.`
        : undefined;

    const durationMs = Date.now() - startTime;

    // 12. Build immutable run record
    const run: Omit<QAProofreadingRunV1, 'id'> = {
        lesson_id: lessonId,
        snapshot_id: snapshotId,
        engine_version: ENGINE_VERSION,
        correction_count: correctionCount,
        correction_types: correctionTypes,
        unresolved_errors_flag: unresolvedFlag,
        proofreading_density: density,
        status: runStatus,
        reviewer_id: 'ai',
        duration_ms: durationMs,
        timestamp: serverTimestamp() as any,
    };

    // 13. CREATE-ONLY persist
    const runRef = await addDoc(collection(db, COLLECTIONS.PROOFREADING_RUNS), run);

    // 14. Update lesson stage + execution_status + logging fields
    const lessonUpdates: Record<string, any> = {
        stage3_status: stageStatus,
        stage3_execution_status: 'complete' as StageExecutionStatus,
        proofreading_correction_count: correctionCount,
        proofreading_density: density,
        updated_at: serverTimestamp(),
    };
    if (stageStatus === 'cleared') {
        lessonUpdates.stage3_cleared_at = serverTimestamp();
        lessonUpdates.blocked_reason = null;
    } else {
        lessonUpdates.blocked_reason = blockedReason ?? null;
    }
    await updateDoc(doc(db, COLLECTIONS.LESSONS, lessonId), lessonUpdates);

    // 15. Log tool usage
    await logToolUsage({
        tool_id: PROOFREADING_TOOL_ID,
        tool_name: 'QA Engine v1 — Stage 3 Proofreading',
        model,
        tier,
        status: 'success',
        execution_time_ms: durationMs,
        metadata: { stage: 3, lessonId, runStatus, correction_count: correctionCount, unresolved: unresolvedFlag },
    });

    return { ...run, id: runRef.id } as QAProofreadingRunV1;
}

// ---------------------------------------------------------------------------
// Phase 2C — Stage 4: Design QA
// ---------------------------------------------------------------------------

/**
 * Run Stage 4 Design QA.
 *
 * Governance:
 *   - Requires Stages 1, 2, 3 cleared (enforced by checkGate).
 *   - Requires a snapshot — throws if none exists.
 *   - Consumes snapshot.task_slide_indices + snapshot.slide_image_refs ONLY.
 *   - Full deck text is NOT passed to the AI.
 *   - Checklist-based — no pedagogy, no aesthetics.
 *   - Blocks Stage 5 if critical_visual_mismatch_flag === true.
 *   - Writes immutable QADesignRunV1 record (CREATE-ONLY).
 *   - Writes design_correction_count to lesson.
 *
 * Execution model: independent — can run in parallel with Stage 3 if
 * the state machine allows (i.e. Stage 3 is already cleared). Caller controls timing.
 */
export async function runDesignQA(lessonId: string): Promise<QADesignRunV1> {
    const startTime = Date.now();
    const user = auth.currentUser;
    if (!user) throw new QAEngineError('Authentication required to run QA.');

    // 1. Fetch lesson + gate check
    const lesson = await fetchLesson(lessonId);
    checkGate(lesson, 4);

    // 2. Idempotency guard — block re-run unless revision_required or failed
    const execStatus = lesson.stage4_execution_status;
    if (execStatus === 'running') {
        throw new QAEngineError(
            'Stage 4 is already running. Wait for the current execution to complete before retrying.'
        );
    }
    if (execStatus === 'complete' && lesson.stage4_status === 'cleared') {
        throw new QAEngineError(
            'Stage 4 is already cleared. Re-run is only permitted if status is revision_required.'
        );
    }

    // 3. Require snapshot — Stage 4 never re-parses the deck
    const snapshotResult = await fetchSnapshot(lessonId);
    if (!snapshotResult) {
        throw new QAEngineError(
            'Stage 4 requires a lesson snapshot. ' +
            'Ensure createLessonSnapshot() was called after Stage 2 cleared.'
        );
    }
    const { snapshot, snapshotId } = snapshotResult;

    // 4. Snapshot integrity check — fail closed if task_slide_indices is empty
    if (snapshot.task_slide_indices.length === 0) {
        throw new QAEngineError(
            'Stage 4 aborted: snapshot task_slide_indices is empty. ' +
            'Re-create the snapshot with at least one task slide identified.'
        );
    }

    // 5. Mark execution running + stage in_review
    await updateDoc(doc(db, COLLECTIONS.LESSONS, lessonId), {
        stage4_status: 'in_review',
        stage4_started_at: serverTimestamp(),
        stage4_execution_status: 'running' as StageExecutionStatus,
        updated_at: serverTimestamp(),
    });

    // 6. Resolve lean model
    const { model, tier } = await getResolvedModelForTool(DESIGN_TOOL_ID, LEAN_TIERS);

    // 7. Build bounded user prompt — task slides only, NO full deck text
    const taskSlideCount = snapshot.task_slide_indices.length;
    const imageRefsList = snapshot.slide_image_refs
        .filter((_, i) => snapshot.task_slide_indices.includes(i))
        .map((ref, i) => `  Task slide ${snapshot.task_slide_indices[i] + 1}: ${ref}`)
        .join('\n');

    const userPrompt =
        `TASK SLIDES (${taskSlideCount} of ${snapshot.slide_image_refs.length} total):\n` +
        `${imageRefsList || '(no image refs provided)'}\n\n` +
        'Check each task slide: does the visual content match the instruction text?\n' +
        'Return the JSON checklist report.';

    // 8. AI call — lean schema
    let aiParsed: any;
    try {
        const response = await ai.models.generateContent({
            model,
            contents: userPrompt,
            config: {
                systemInstruction: DESIGN_SYSTEM_PROMPT,
                temperature: 0.05,
                responseMimeType: 'application/json',
                responseSchema: DESIGN_AI_SCHEMA,
            },
        });
        const aiRaw = response.text || '';
        if (!aiRaw.trim()) throw new Error('AI returned an empty response.');
        aiParsed = JSON.parse(aiRaw);
    } catch (err: any) {
        const durationMs = Date.now() - startTime;
        await logToolUsage({
            tool_id: DESIGN_TOOL_ID,
            tool_name: 'QA Engine v1 — Stage 4 Design QA',
            model,
            tier,
            status: 'error',
            execution_time_ms: durationMs,
            metadata: { stage: 4, lessonId, error: err.message },
        });
        // Mark failed — safe to retry manually
        await updateDoc(doc(db, COLLECTIONS.LESSONS, lessonId), {
            stage4_execution_status: 'failed' as StageExecutionStatus,
            blocked_reason: `Stage 4 AI call failed: ${err.message}`,
            updated_at: serverTimestamp(),
        });
        throw new QAEngineError(`Stage 4 Design QA failed: ${err.message}`);
    }

    // 9. Derive structured fields
    const designIssuesCount: number = Math.max(0, Math.round(aiParsed.design_issues_count ?? 0));
    const criticalFlag: boolean = Boolean(aiParsed.critical_visual_mismatch_flag);
    const issueTypes: string[] = Array.isArray(aiParsed.issue_types) ? aiParsed.issue_types : [];

    // 10. Gate outcome
    const stageStatus: QAStageStatus = criticalFlag ? 'revision_required' : 'cleared';
    const runStatus: 'cleared' | 'blocked' = criticalFlag ? 'blocked' : 'cleared';
    const blockedReason = criticalFlag
        ? `Critical visual mismatch detected. Task slide instructions do not match visual content. Lesson cannot proceed to sign-off.`
        : undefined;

    const durationMs = Date.now() - startTime;

    // 11. Build immutable run record
    const run: Omit<QADesignRunV1, 'id'> = {
        lesson_id: lessonId,
        snapshot_id: snapshotId,
        engine_version: ENGINE_VERSION,
        design_issues_count: designIssuesCount,
        critical_visual_mismatch_flag: criticalFlag,
        issue_types: issueTypes,
        status: runStatus,
        reviewer_id: 'ai',
        duration_ms: durationMs,
        timestamp: serverTimestamp() as any,
    };

    // 12. CREATE-ONLY persist
    const runRef = await addDoc(collection(db, COLLECTIONS.DESIGN_RUNS), run);

    // 13. Update lesson stage + execution_status + logging fields
    const lessonUpdates: Record<string, any> = {
        stage4_status: stageStatus,
        stage4_execution_status: 'complete' as StageExecutionStatus,
        design_correction_count: designIssuesCount,
        updated_at: serverTimestamp(),
    };
    if (stageStatus === 'cleared') {
        lessonUpdates.stage4_cleared_at = serverTimestamp();
        lessonUpdates.blocked_reason = null;
    } else {
        lessonUpdates.blocked_reason = blockedReason ?? null;
    }
    await updateDoc(doc(db, COLLECTIONS.LESSONS, lessonId), lessonUpdates);

    // 14. Log tool usage
    await logToolUsage({
        tool_id: DESIGN_TOOL_ID,
        tool_name: 'QA Engine v1 — Stage 4 Design QA',
        model,
        tier,
        status: 'success',
        execution_time_ms: durationMs,
        metadata: { stage: 4, lessonId, runStatus, design_issues: designIssuesCount, critical_flag: criticalFlag },
    });

    return { ...run, id: runRef.id } as QADesignRunV1;
}

/**
 * Utility: calculateScore
 * Validates the 30/20 cap model predictably — also used in tests.
 */
export { calculateScore };

/**
 * Utility: resolveTriggers
 * Exported so tests can verify unknown types are discarded correctly.
 */
export { resolveTriggers };
