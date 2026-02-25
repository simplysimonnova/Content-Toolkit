
import { Type } from "@google/genai";
import { ai } from '../../lib/aiClient';
import { type CapabilityTier } from '../../lib/modelRegistry';
import { getResolvedModelForTool } from '../../lib/toolTierResolver';

export const ALLOWED_TIERS: CapabilityTier[] = ['default'];
const TOOL_ID = 'tn-fixer';

export interface TNResult {
  fixedNotes: string;
  fixLog: string;
}

export async function fixTeacherNotes(rawNotes: string, systemPrompt: string): Promise<TNResult> {
  
  const prompt = `
[INPUT DATA]:
${rawNotes}

REWRITE NOW.
`;

  try {
    const response = await ai.models.generateContent({
      model: (await getResolvedModelForTool(TOOL_ID, ALLOWED_TIERS)).model,
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fixedNotes: {
              type: Type.STRING,
              description: "The clean, standardized, numbered teacher notes.",
            },
            fixLog: {
              type: Type.STRING,
              description: "Concise log of changes made and why.",
            },
          },
          required: ["fixedNotes", "fixLog"],
        },
      },
    });

    const json = JSON.parse(response.text || "{}");
    return {
      fixedNotes: json.fixedNotes || "Error: No notes generated.",
      fixLog: json.fixLog || "No issues identified.",
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("entity was not found")) {
      throw new Error("API Key issue. Please re-authenticate if required.");
    }
    throw new Error("Failed to process the notes. Please try again.");
  }
}
