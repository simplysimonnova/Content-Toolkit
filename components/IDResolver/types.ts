// TypeScript interfaces for ID Resolver

export interface ExpandedRow {
    can_do: string;
    cefr: string;
    skill: string;
    triad: string;
    [key: string]: string; // Allow additional columns
}

export interface LibraryRow {
    id: string;
    can_do: string;
    cefr: string;
    skill: string;
    [key: string]: string;
}

export interface LessonRow {
    id: string;
    lul: string;
    [key: string]: string;
}

export interface MatchedRow {
    competency_id: string | null;
    lesson_id: string | null;
    competency_match_found: boolean;
    lesson_match_found: boolean;
    skill_mismatch: boolean;
    skill_mismatch_expanded: string | null;
    skill_mismatch_library: string | null;
    [key: string]: any; // Preserve all original columns
}

export interface MatchResult {
    matched: MatchedRow[];
    stats: {
        total_rows: number;
        competency_matches: number;
        skill_conflicts: number;
        competency_misses: number;
        lesson_matches: number;
        lesson_misses: number;
    };
}

export interface ColumnMapping {
    // Expanded Rows
    can_do_column: string;
    cefr_column: string;
    skill_column: string;
    triad_column: string;

    // Full Library
    library_id_column: string;
    library_can_do_column: string;
    library_cefr_column: string;
    library_skill_column: string;

    // Lessons
    lesson_id_column: string;
    lesson_lul_column: string;
}
