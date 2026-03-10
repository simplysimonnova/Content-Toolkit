import { Type } from '@google/genai';
import { ai } from '../../lib/aiClient';
import { type CapabilityTier } from '../../lib/modelRegistry';
import { getResolvedModelForTool } from '../../lib/toolTierResolver';
import { logToolUsage } from '../../services/geminiService';
import { TOOL_ID, TOOL_LABEL } from './constants';

export const ALLOWED_TIERS: CapabilityTier[] = ['default'];

export interface TNResult {
  fixedNotes: string;
  fixLog: string;
}

/**
 * Calls the AI to standardise a single slide's teacher notes.
 * Uses shared ai client, model resolution, and usage logging.
 * systemPrompt is sourced from Firestore (getToolConfig) or DEFAULT_SYSTEM_INSTRUCTION.
 */
/**
 * Strips technical markup tokens from teacher-note text before AI processing.
 * Only removes {{ ... }} blocks — does not alter normal prose content.
 *
 * Examples:
 *   "Ask S. to describe the picture.\n{{ MarkupId: 6-1-80-VE-hw-ngw-334c3cew }}"
 *   → "Ask S. to describe the picture."
 *
 *   "{{ MarkupId: abc123 }}\nTeacher asks CCQs."
 *   → "Teacher asks CCQs."
 *
 *   "Introduce vocab: {{ term }} and explain."  ← normal {{ }} not a markup ID — left intact
 *   → "Introduce vocab: {{ term }} and explain."  (no match — regex requires MarkupId pattern)
 *
 * Risk note: regex targets {{ MarkupId: <alphanumeric-dash> }} specifically to avoid
 * over-stripping {{ }} used in normal lesson templates or variable placeholders.
 */
export function stripTeacherNoteMarkup(text: string): string {
  return text
    .replace(/\{\{\s*MarkupId\s*:[^}]+\}\}/gi, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function fixTeacherNotes(
  rawNotes: string,
  systemPrompt: string
): Promise<TNResult> {
  const startTime = Date.now();
  const { model, tier } = await getResolvedModelForTool(TOOL_ID, ALLOWED_TIERS);

  const cleanedNotes = stripTeacherNoteMarkup(rawNotes);
  const prompt = `[INPUT DATA]:\n${cleanedNotes}\n\nREWRITE NOW.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fixedNotes: {
              type: Type.STRING,
              description: 'The clean, standardized, numbered teacher notes.',
            },
            fixLog: {
              type: Type.STRING,
              description: 'Concise log of changes made and why.',
            },
          },
          required: ['fixedNotes', 'fixLog'],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      // Crude recovery from near-JSON responses
      const match = text.match(/"fixedNotes"\s*:\s*"([\s\S]*?)"/);
      if (match?.[1]) {
        return {
          fixedNotes: match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
          fixLog: 'Partial recovery from malformed JSON response.',
        };
      }
      throw new Error('The AI returned an invalid response format. Please try again.');
    }

    const durationMs = Date.now() - startTime;
    await logToolUsage({
      tool_id: TOOL_ID,
      tool_name: TOOL_LABEL,
      model,
      tier,
      status: 'success',
      execution_time_ms: durationMs,
    });

    return {
      fixedNotes: json.fixedNotes || 'Error: No notes generated.',
      fixLog: json.fixLog || 'No issues identified.',
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    await logToolUsage({
      tool_id: TOOL_ID,
      tool_name: TOOL_LABEL,
      model,
      tier,
      status: 'error',
      execution_time_ms: durationMs,
    });
    if (err.message?.includes('entity was not found')) {
      throw new Error('API key issue. Please re-authenticate if required.');
    }
    throw new Error(err.message || 'Failed to process the notes. Please try again.');
  }
}
