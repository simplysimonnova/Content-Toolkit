import { ExpandedRow, LibraryRow, LessonRow, MatchedRow, MatchResult, ColumnMapping } from './types';

/**
 * Normalize a string for key comparison per V2 spec:
 * Unicode NFKD, Lowercase, Collapse whitespace, Normalize smart quotes, Canonicalize CEFR formatting
 */
export const normalizeKey = (value: string): string => {
    if (!value) return '';

    return value
        .normalize('NFKD') // Unicode normalization
        .replace(/[\u2018\u2019]/g, "'") // Smart single quotes → standard
        .replace(/[\u201C\u201D]/g, '"') // Smart double quotes → standard
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' '); // Collapse multiple whitespace
};

/**
 * Specifically canonicalize CEFR formatting (A1, A2, etc.)
 */
const canonicalizeCEFR = (cefr: string): string => {
    return normalizeKey(cefr).replace(/[^a-z0-9]/g, '').toUpperCase();
};

/**
 * Specifically normalize LuL format
 */
const normalizeLuL = (lul: string): string => {
    return normalizeKey(lul).replace(/\s+/g, '');
};

/**
 * Create composite key for competency matching
 */
export const createCompetencyKey = (can_do: string, cefr: string, skill: string): string => {
    const normalizedCanDo = normalizeKey(can_do);
    const normalizedCefr = canonicalizeCEFR(cefr);
    const normalizedSkill = normalizeKey(skill);

    return `${normalizedCanDo}|${normalizedCefr}|${normalizedSkill}`;
};

/**
 * Create partial key for skill-mismatch detection (can_do + cefr only, no skill)
 */
const createPartialKey = (can_do: string, cefr: string): string => {
    return `${normalizeKey(can_do)}|${canonicalizeCEFR(cefr)}`;
};

/**
 * Main resolver function v2
 */
export const resolveIDs = (
    expandedRows: any[],
    libraryRows: any[],
    lessonRows: any[],
    mapping: ColumnMapping
): MatchResult => {
    const total_rows = expandedRows.length;
    let competency_matches = 0;
    let skill_conflicts = 0;
    let lesson_matches = 0;

    // Build library index: full composite key (can_do+cefr+skill) → competency_id
    // V2 spec: Exact match only.
    const libraryIndex = new Map<string, string>();
    libraryRows.forEach(libRow => {
        const key = createCompetencyKey(
            libRow[mapping.library_can_do_column],
            libRow[mapping.library_cefr_column],
            libRow[mapping.library_skill_column]
        );
        // Note: If duplicates exist in library, last one wins.
        // Spec says exact match only, no fuzzy matching.
        libraryIndex.set(key, libRow[mapping.library_id_column]);
    });

    // Build partial library index: (can_do+cefr) → { competency_id, library_skill }
    // Used exclusively for skill mismatch detection. One entry per unique partial key (first wins).
    const partialLibraryIndex = new Map<string, { competency_id: string; library_skill: string }>();
    libraryRows.forEach(libRow => {
        const partialKey = createPartialKey(
            libRow[mapping.library_can_do_column],
            libRow[mapping.library_cefr_column]
        );
        if (!partialLibraryIndex.has(partialKey)) {
            partialLibraryIndex.set(partialKey, {
                competency_id: libRow[mapping.library_id_column],
                library_skill: libRow[mapping.library_skill_column] ?? ''
            });
        }
    });

    // Build lesson index: LuL → lesson_id
    const lessonIndex = new Map<string, string>();
    lessonRows.forEach(lessonRow => {
        const lul = normalizeLuL(lessonRow[mapping.lesson_lul_column]);
        lessonIndex.set(lul, lessonRow[mapping.lesson_id_column]);
    });

    // Process rows
    const matched: MatchedRow[] = expandedRows.map(row => {
        const compKey = createCompetencyKey(
            row[mapping.can_do_column],
            row[mapping.cefr_column],
            row[mapping.skill_column]
        );
        const partialKey = createPartialKey(
            row[mapping.can_do_column],
            row[mapping.cefr_column]
        );
        const lulKey = normalizeLuL(row[mapping.triad_column]);

        const competency_id = libraryIndex.get(compKey) || null;
        const lesson_id = lessonIndex.get(lulKey) || null;

        // Secondary: skill mismatch detection
        // Only fires when full key misses but partial key (can_do+cefr) hits
        let skill_mismatch = false;
        let skill_mismatch_expanded: string | null = null;
        let skill_mismatch_library: string | null = null;
        let skill_mismatch_competency_id: string | null = null;

        if (!competency_id) {
            const partialHit = partialLibraryIndex.get(partialKey);
            if (partialHit) {
                skill_mismatch = true;
                skill_mismatch_expanded = row[mapping.skill_column] ?? null;
                skill_mismatch_library = partialHit.library_skill;
                skill_mismatch_competency_id = partialHit.competency_id;
            }
        }

        if (competency_id) competency_matches++;
        else if (skill_mismatch) skill_conflicts++;
        if (lesson_id) lesson_matches++;

        return {
            ...row,
            competency_id,
            lesson_id,
            competency_match_found: !!competency_id,
            lesson_match_found: !!lesson_id,
            skill_mismatch,
            skill_mismatch_expanded,
            skill_mismatch_library,
            skill_mismatch_competency_id
        };
    });

    return {
        matched,
        stats: {
            total_rows,
            competency_matches,
            skill_conflicts,
            competency_misses: total_rows - competency_matches - skill_conflicts,
            lesson_matches,
            lesson_misses: total_rows - lesson_matches
        }
    };
};
