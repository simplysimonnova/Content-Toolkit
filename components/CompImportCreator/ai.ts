import { GoogleGenAI } from "@google/genai";
import { logUsage } from "../../services/geminiService";

interface CompImportResult {
    statement: string;
    skill: string;
    cefr: string;
}

const SYSTEM_INSTRUCTION = `
Purpose
Transform a raw list of “Student can …” statements into a clean, import-ready data structure with pedagogically accurate skill and CEFR tagging.

Process rules

Split statements
- Treat each individual “Student can …” sentence as its own row.
- Ignore quotation marks and blank lines.
- Do not merge statements, even if they originally appear together.

Skill tagging
- EACH statement must be tagged with exactly ONE of the following values:
  - vocabulary: naming, identifying, topic language, idioms, phrases, reading-for-meaning
  - grammar: tenses, conditionals, modals, structures, function words
  - speaking: opinion phrases, clarifying phrases, functional spoken communication
  - phonics: sound–spelling focus (only if clearly present)
- Do not assign multiple skills to a single statement.

CEFR tagging
- Assign one CEFR level based on standard pedagogical expectations:
  - A1: basic naming, concrete nouns, simple questions, prepositions
  - A2: topic vocabulary, short factual texts, past simple, zero conditional
  - B1: phrasal verbs, passives, reported speech, first conditional, abstract topics
  - B2: second conditional, contrast structures, nuanced discourse markers
- Be conservative and consistent; prefer the lower level if borderline.

Output format API Requirement
- You must return valid JSON only.
- The output should be an array of objects.
- Each object must have these keys: "statement", "skill", "cefr".
- Preserve the original wording of each statement (minor punctuation cleanup allowed).
`;

export const generateCompImport = async (text: string): Promise<CompImportResult[]> => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    // Using a robust model for complex instruction following
    const model = 'gemini-2.0-flash';

    try {
        const response = await ai.models.generateContent({
            model,
            contents: `${SYSTEM_INSTRUCTION}\n\nINPUT TEXT:\n${text}`,
            config: {
                responseMimeType: "application/json",
            }
        });

        await logUsage('Comp Import Creator', model, 0.01);

        const responseText = response.text || "[]";
        const data = JSON.parse(responseText);

        if (Array.isArray(data)) {
            return data as CompImportResult[];
        } else if (data && Array.isArray(data.items)) {
            return data.items as CompImportResult[];
        }

        return [];

    } catch (error) {
        console.error("Comp Import Generation Failed:", error);
        throw new Error("Failed to process statements. Please try again.");
    }
};
