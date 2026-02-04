# Spreadsheet Deduplicator

The **Spreadsheet Deduplicator** is a specialized CSV processing tool designed to clean datasets by removing redundant information. It is integrated into the Content Toolkit's general utility suite.

## Tool Summary

### Core Functionality
The tool operates in two primary modes:
1.  **Reference De-duplication (External):** Upload a "Reference CSV" (blocklist) to remove matching rows from the "Actionable CSV."
2.  **Internal De-duplication:** Scan the "Actionable CSV" itself to remove duplicate rows within the file.

### Key Technical Features
*   **Intelligent Matching:** Ignores whitespace, quotes, and casing (e.g., `"123 456"` matches `"123456"`).
*   **Granular Column Selection:** Allows selecting specific "Key" columns for comparison.
*   **RFC 4180 Compliance:** Robust CSV parsing handles quoted fields and newlines.
*   **Real-time Statistics:** Provides a breakdown of rows removed and final counts.

## Implementation Details
*   **Component:** [SpreadsheetDeduplicator.tsx](file:///Volumes/MacStorage/AI-NK/Content-Toolkit/components/SpreadsheetDeduplicator.tsx)
*   **Utility:** [csvHelper.ts](file:///Volumes/MacStorage/AI-NK/Content-Toolkit/utils/csvHelper.ts)
*   **Location:** Home > General Tools > Spreadsheet De-duplication

---

## TO-DO: Multi-Column De-duplication

The goal is to allow selecting multiple columns to form a composite key for de-duplication. This handles cases where uniqueness is defined by a combination of fields (e.g., "Can-do Statement" + "CEFR Level").

### Requirements
- [ ] **UI Update:** Allow users to select multiple headers (checkboxes instead of radio buttons).
- [ ] **Validation:** Ensure at least one column is selected for each file being processed.
- [ ] **Logic Enhancement:**
    - Update `handleProcess` to concatenate multiple column values into a single normalized key.
    - Ensure composite keys are created consistently for both reference and actionable files.
- [ ] **Error Handling:** Provide feedback if column counts don't match when using a reference file (if relevant).
- [ ] **Verification:** Test with data where single-column checks would incorrectly flag/miss duplicates (like the CEFR level example).
