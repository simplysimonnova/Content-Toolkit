import type { QALessonSnapshot } from '../types/qa-v1';
import { ENGINE_VERSION } from './qaEngineV1';

// ---------------------------------------------------------------------------
// Input type — mirrors ParseResult / SlideData from SlidesZipUpload
// ---------------------------------------------------------------------------

export interface ParsedZipSlide {
    slideIndex: number;   // 1-based, as produced by parseSlidesZip
    slidesText: string;
    notesText: string;
    imageCount: number;
}

export interface ParsedZipResult {
    slides: ParsedZipSlide[];
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export interface SnapshotAdapterOptions {
    lessonId?: string;      // If provided, used as lesson_id; else a fresh UUID is generated
    sourceHash?: string;    // SHA-256 of raw ZIP ArrayBuffer, computed by the upload component
}

/**
 * Converts SlidesZipUpload parsed output into a QALessonSnapshot object.
 *
 * Pure function — no Firestore writes, no AI calls, no UI side-effects.
 * Word count is recalculated from source data (not reused from ParseResult totals).
 * task_slide_indices: 0-based indices of slides with non-empty slide text.
 * slide_image_refs: empty array at this stage (no image URL extraction yet).
 * source_hash: pass the SHA-256 hex string computed before calling this function.
 *
 * Throws if slides array is empty or snapshot fails validation.
 */
export function buildSnapshotFromZip(
    parsedZip: ParsedZipResult,
    options: SnapshotAdapterOptions = {}
): QALessonSnapshot {
    if (!parsedZip.slides || parsedZip.slides.length === 0) {
        throw new Error('buildSnapshotFromZip: slides array is empty — cannot build snapshot.');
    }

    const DELIMITER = '\n---\n';

    // Filter undefined/null before joining to prevent empty delimiter blocks
    const slides_text = parsedZip.slides
        .map(s => (s.slidesText ?? '').trim())
        .filter(t => t.length > 0)
        .join(DELIMITER);

    const teacher_notes_text = parsedZip.slides
        .map(s => (s.notesText ?? '').trim())
        .filter(t => t.length > 0)
        .join(DELIMITER);

    const slide_count = parsedZip.slides.length;

    // Recalculate word count from source — do not reuse ParseResult totals
    const word_count = (slides_text + ' ' + teacher_notes_text)
        .split(/\s+/)
        .filter(Boolean).length;

    // 0-based indices of slides that have non-empty slide text (task/activity slides)
    const task_slide_indices: number[] = parsedZip.slides
        .map((s, i) => ({ i, hasText: (s.slidesText ?? '').trim().length > 0 }))
        .filter(s => s.hasText)
        .map(s => s.i);

    // Image refs not available at ZIP-parse stage
    const slide_image_refs: string[] = [];

    const snapshot: QALessonSnapshot = {
        lesson_id: options.lessonId ?? crypto.randomUUID(),
        engine_version: ENGINE_VERSION,
        slides_text,
        teacher_notes_text,
        word_count,
        slide_count,
        task_slide_indices,
        slide_image_refs,
        source_hash: options.sourceHash ?? null,
        created_at: new Date() as any,
    };

    // Validation — fail loudly rather than silently pass bad data downstream
    if (snapshot.slide_count <= 0) {
        throw new Error('buildSnapshotFromZip: slide_count is 0.');
    }
    if (snapshot.slides_text.length === 0) {
        throw new Error('buildSnapshotFromZip: slides_text is empty after joining.');
    }
    if (snapshot.word_count <= 0) {
        throw new Error('buildSnapshotFromZip: word_count is 0 — slide and notes content appears empty.');
    }
    if (!Array.isArray(snapshot.task_slide_indices)) {
        throw new Error('buildSnapshotFromZip: task_slide_indices is not an array.');
    }

    console.log('[lessonSnapshotAdapter] Snapshot built:', {
        lesson_id: snapshot.lesson_id,
        slide_count: snapshot.slide_count,
        word_count: snapshot.word_count,
        task_slide_count: snapshot.task_slide_indices.length,
        slides_text_length: snapshot.slides_text.length,
        notes_text_length: snapshot.teacher_notes_text.length,
        source_hash: snapshot.source_hash ?? '(none)',
    });

    return snapshot;
}
