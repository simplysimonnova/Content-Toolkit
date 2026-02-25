import { Type } from "@google/genai";
import { ai } from '../../lib/aiClient';
import { type CapabilityTier } from '../../lib/modelRegistry';
import { getResolvedModelForTool } from '../../lib/toolTierResolver';
import { logUsage } from "../../services/geminiService";

export const ALLOWED_TIERS: CapabilityTier[] = ['default'];
const TOOL_ID = 'tn-standardizer';

export interface TNResult {
  fixedNotes: string;
  fixLog: string;
}

export async function fixTeacherNotes(rawNotes: string, systemPrompt: string): Promise<TNResult> {
  const { model, tier } = await getResolvedModelForTool(TOOL_ID, ALLOWED_TIERS);

  const prompt = `
[INPUT DATA]:
${rawNotes}

REWRITE NOW.
`;

  const response = await ai.models.generateContent({
    model,
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

  await logUsage("TN Standardizer", model, 0.01, tier);

  const json = JSON.parse(response.text || "{}");
  return {
    fixedNotes: json.fixedNotes || "Error: No notes generated.",
    fixLog: json.fixLog || "No issues identified.",
  };
}
