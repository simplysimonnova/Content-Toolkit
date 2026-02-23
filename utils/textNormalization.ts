export const CANONICAL_MAPPINGS: Record<string, Record<string, string>> = {
    skill: {
        speaking: "speaking",
        phonics: "phonics",
        grammar: "grammar",
        vocabulary: "vocabulary",
        vocab: "vocabulary",
        writing: "writing",
        reading: "reading",
        listening: "listening",
        spelling: "spelling",
    },
    skillarea: { // Handles "Skill Area", "skill area", etc.
        speaking: "speaking",
        phonics: "phonics",
        grammar: "grammar",
        vocabulary: "vocabulary",
        vocab: "vocabulary",
        writing: "writing",
        reading: "reading",
        listening: "listening",
        spelling: "spelling",
    },
};

export const normalizeColumnName = (columnName: string): string => {
    return columnName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ''); // Remove all non-alphanumeric characters
};

/**
 * Basic text cleaning (Unicode, Smart Quotes, Whitespace)
 * Does NOT lowercase or canonicalize.
 */
export const cleanText = (text: string | undefined): string => {
    if (!text) return '';

    let cleaned = text.toString();

    // Step 1: Unicode normalization (NFKD)
    cleaned = cleaned.normalize('NFKD');

    // Step 2: Convert smart quotes, dashes, and non-breaking spaces to ASCII
    cleaned = cleaned
        .replace(/[\u2018\u2019]/g, '"')  // Smart single quotes → "
        .replace(/'/g, '"')               // Straight single quotes → "
        .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes → "
        .replace(/[\u2013\u2014]/g, '-')  // En/em dashes → -
        .replace(/\u00A0/g, ' ')          // Non-breaking space → space
        .replace(/\u2026/g, '...');       // Ellipsis → ...

    // Step 3: Whitespace normalization
    cleaned = cleaned.trim().replace(/\s+/g, ' ');

    return cleaned;
};

/**
 * Full normalization (Cleaning + Lowercase + Canonicalization)
 */
export const normalizeText = (text: string | undefined, columnName?: string): string => {
    if (!text) return '';

    let normalized = cleanText(text);

    // Step 4: Convert to lowercase
    normalized = normalized.toLowerCase();

    // Step 5: Special handling for CEFR columns
    if (columnName) {
        const colKey = normalizeColumnName(columnName);
        if (colKey === 'cefr' || colKey === 'cefrlevel') {
            normalized = normalized
                .replace(/[^a-z0-9]/g, ' ')  // Remove all non-alphanumeric
                .replace(/\s+/g, ' ')         // Collapse whitespace
                .trim();
        }
    }

    // Step 6: Optional canonicalization for categorical columns
    if (columnName) {
        const normalizedColName = normalizeColumnName(columnName);
        if (CANONICAL_MAPPINGS[normalizedColName]) {
            const canonical = CANONICAL_MAPPINGS[normalizedColName][normalized];
            if (canonical) {
                normalized = canonical;
            }
        }
    }

    return normalized;
};
