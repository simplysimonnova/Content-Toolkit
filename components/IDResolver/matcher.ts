import { ExpandedRow, LibraryRow, LessonRow, MatchedRow, MatchResult, ColumnMapping } from './types';

/**
 * Normalize a string for key comparison
 * Applies: Unicode normalization, quote standardization, lowercase, trim, whitespace collapse
 */
export const normalizeKey = (value: string): string => {
    if (!value) return '';

    return value
        .normalize('NFKD') // Unicode normalization
        .replace(/[\u2018\u2019]/g, "'") // Smart single quotes → standard
        .replace(/[\u201C\u201D]/g, '"') // Smart double quotes → standard
        .replace(/"/g, '') // Remove all double quotes
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' '); // Collapse multiple whitespace
};

/**
 * Create composite key for competency matching
 */
export const createCompetencyKey = (can_do: string, cefr: string, skill: string): string => {
    const normalizedCanDo = normalizeKey(can_do);
    const normalizedCefr = normalizeKey(cefr).replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric from CEFR
    const normalizedSkill = normalizeKey(skill);

    return `${normalizedCanDo}|${normalizedCefr}|${normalizedSkill}`;
};

/**
 * Match competencies using composite key
 */
export const matchCompetencies = (
    expandedRows: any[],
    libraryRows: any[],
    mapping: ColumnMapping
): {
    matched: Map<number, string>;
    unmatched: number[];
    duplicates: number[];
} => {
    const matched = new Map<number, string>();
    const unmatched: number[] = [];
    const duplicates: number[] = [];

    // Build library index: composite key → competency_id
    const libraryIndex = new Map<string, string[]>();

    libraryRows.forEach(libRow => {
        const key = createCompetencyKey(
            libRow[mapping.library_can_do_column],
            libRow[mapping.library_cefr_column],
            libRow[mapping.library_skill_column]
        );

        if (!libraryIndex.has(key)) {
            libraryIndex.set(key, []);
        }
        libraryIndex.get(key)!.push(libRow[mapping.library_id_column]);
    });

    // Match each expanded row
    expandedRows.forEach((row, index) => {
        const key = createCompetencyKey(
            row[mapping.can_do_column],
            row[mapping.cefr_column],
            row[mapping.skill_column]
        );

        const matches = libraryIndex.get(key);

        if (!matches || matches.length === 0) {
            unmatched.push(index);
        } else if (matches.length > 1) {
            duplicates.push(index);
        } else {
            matched.set(index, matches[0]);
        }
    });

    return { matched, unmatched, duplicates };
};

/**
 * Match lessons using exact triad matching
 */
export const matchLessons = (
    expandedRows: any[],
    lessonRows: any[],
    mapping: ColumnMapping
): {
    matched: Map<number, string>;
    unmatched: number[];
    duplicates: number[];
} => {
    const matched = new Map<number, string>();
    const unmatched: number[] = [];
    const duplicates: number[] = [];

    // Build lesson index: triad → lesson_id
    const lessonIndex = new Map<string, string[]>();

    lessonRows.forEach(lessonRow => {
        const triad = (lessonRow[mapping.lesson_lul_column] || '').trim();

        if (!lessonIndex.has(triad)) {
            lessonIndex.set(triad, []);
        }
        lessonIndex.get(triad)!.push(lessonRow[mapping.lesson_id_column]);
    });

    // Match each expanded row
    expandedRows.forEach((row, index) => {
        const triad = (row[mapping.triad_column] || '').trim();
        const matches = lessonIndex.get(triad);

        if (!matches || matches.length === 0) {
            unmatched.push(index);
        } else if (matches.length > 1) {
            duplicates.push(index);
        } else {
            matched.set(index, matches[0]);
        }
    });

    return { matched, unmatched, duplicates };
};

/**
 * Main resolver function
 */
export const resolveIDs = (
    expandedRows: any[],
    libraryRows: any[],
    lessonRows: any[],
    mapping: ColumnMapping
): MatchResult => {
    const total_rows = expandedRows.length;

    // Step 1: Match competencies
    const compResult = matchCompetencies(expandedRows, libraryRows, mapping);

    // Step 2: Match lessons
    const lessonResult = matchLessons(expandedRows, lessonRows, mapping);

    // Collect unmatched/duplicate rows
    const competency_unmatched = compResult.unmatched.map(i => expandedRows[i]);
    const competency_duplicate_matches = compResult.duplicates.map(i => expandedRows[i]);
    const lesson_unmatched = lessonResult.unmatched.map(i => expandedRows[i]);
    const lesson_duplicate_matches = lessonResult.duplicates.map(i => expandedRows[i]);

    // Build final matched rows (only if both competency AND lesson matched)
    const matched: MatchedRow[] = [];

    expandedRows.forEach((row, index) => {
        const competency_id = compResult.matched.get(index);
        const lesson_id = lessonResult.matched.get(index);

        if (competency_id && lesson_id) {
            matched.push({
                lesson_id,
                competency_id,
                triad: row[mapping.triad_column],
                can_do: row[mapping.can_do_column],
                cefr: row[mapping.cefr_column],
                skill: row[mapping.skill_column]
            });
        }
    });

    return {
        matched,
        competency_unmatched,
        competency_duplicate_matches,
        lesson_unmatched,
        lesson_duplicate_matches,
        stats: {
            total_rows,
            competency_matched: compResult.matched.size,
            competency_unmatched: compResult.unmatched.length,
            competency_duplicate_matches: compResult.duplicates.length,
            lesson_matched: lessonResult.matched.size,
            lesson_unmatched: lessonResult.unmatched.length,
            lesson_duplicate_matches: lessonResult.duplicates.length,
            final_row_count: matched.length
        }
    };
};
