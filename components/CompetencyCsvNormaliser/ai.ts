import { ai } from '../../lib/aiClient';
import { resolveModel } from '../../lib/modelRegistry';
import { fetchConfig, logUsage } from "../../services/geminiService";

export const normalizeCompetencies = async (csvData: string): Promise<string> => {

  // Fetch user-configurable prompt from Firestore, or use default
  const config = await fetchConfig('competency-csv-normaliser', `
You are a curriculum data-preparation tool designed to create import-ready competency rows while deliberately avoiding fine-grained pedagogical decisions.

Goal:
Ensure every required skill has a corresponding competency row, with correct CEFR alignment and clear flagging for human review — without attempting to fully design curriculum outcomes.

Input
A CSV containing:
- A CEFR Level Check column (may include multiple skill + CEFR pairs)
- A “Comps in Directus” column (may contain zero, one, or multiple competencies)
- Additional informational columns: Grammar, Vocabulary, Secondary Vocabulary, Speaking, Reading

Output Format (CSV)
Columns (exact order):
can_do, skill, cefr, flag

Core Rules

1. Competency Boundary Detection
Treat each case-insensitive occurrence of:
- "Student can …"
- "Students can …"
as the start of a new competency.
Ignore punctuation, line breaks, or spacing noise.

2. Preserve Existing Competencies
- Never modify, split, rewrite, or replace existing “Student(s) can …” statements.
- Existing competencies must pass through unchanged and unflagged.

3. Skill & CEFR Extraction
- Extract all Skill: CEFR pairs from the CEFR Level Check column.
- Normalize skills to lowercase: grammar, vocabulary, speaking, reading.
- Normalize CEFR to lowercase (pre-a1, a1, a2, b1).

4. Sequential Alignment
- Align existing competencies to extracted skill+CEFR pairs by position:
  1st competency ↔ 1st skill/CEFR
  2nd competency ↔ 2nd skill/CEFR
- Do not create Cartesian combinations.

5. Create Missing Competencies (Safe Mode)
- If a skill+CEFR pair has no corresponding competency, create one placeholder competency.
- Placeholders must:
  - Use standard “Student can …” phrasing
  - Match the skill and CEFR
  - Be generic but pedagogically safe
  - Avoid enumerating or splitting individual lexical or grammatical items
Examples (templates only):
Grammar → "Student can use the target grammatical structure accurately in context."
Vocabulary → "Student can use topic-specific vocabulary accurately in context."
Speaking → "Student can speak using appropriate language for the target context."
Reading → "Student can understand written texts on familiar topics."
- Flag all such rows as "created".

6. Secondary Vocabulary Handling
- Always create a vocabulary competency for Secondary Vocabulary if present.
- Do not split individual lexical items.
- Use a generic vocabulary placeholder.
- Infer CEFR using methodological alignment.
- Flag these rows as: "secondary created".

7. Generic Fallback
- If no usable information exists for a required skill, create a generic placeholder.
- Flag as: "created-generic".

8. Duplication Policy
- Do not deduplicate. Identical rows may pass through unchanged.

Design Constraints (Important)
- Do not split comma-separated or list-like content into multiple competencies.
- Do not attempt to infer teaching intent beyond safe placeholders.
- This tool prepares reviewable structure, not final curriculum.

Output Guarantee
- One row = one competency + one skill + one CEFR
- All created content is explicitly flagged
- Output is safe for import and efficient for methodologist review
- Return strictly the CSV content.
`);

  const model = resolveModel();

  const prompt = `
${config.instruction}

Input Data:
${csvData}
`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt
  });

  await logUsage("Competency Normalization", model, 0.05); // Estimated cost
  return response.text || "";
};
