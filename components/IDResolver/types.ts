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
    lesson_id: string;
    competency_id: string;
    triad: string;
    can_do: string;
    cefr: string;
    skill: string;
}

export interface MatchResult {
    matched: MatchedRow[];
    competency_unmatched: ExpandedRow[];
    competency_duplicate_matches: ExpandedRow[];
    lesson_unmatched: ExpandedRow[];
    lesson_duplicate_matches: ExpandedRow[];
    stats: {
        total_rows: number;
        competency_matched: number;
        competency_unmatched: number;
        competency_duplicate_matches: number;
        lesson_matched: number;
        lesson_unmatched: number;
        lesson_duplicate_matches: number;
        final_row_count: number;
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
