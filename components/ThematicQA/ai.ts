import { Type } from "@google/genai";
import { ai } from '../../lib/aiClient';
import { type CapabilityTier } from '../../lib/modelRegistry';
import { getResolvedModelForTool } from '../../lib/toolTierResolver';
import { logUsage } from "../../services/geminiService";
import { ThematicQAResult, QASettings, DEFAULT_SETTINGS } from "./types";

export const ALLOWED_TIERS: CapabilityTier[] = ['default'];
const TOOL_ID = 'thematic-qa';

export type { ThematicQAResult } from "./types";

function buildSystemPrompt(settings: QASettings): string {
  const visualRule =
    settings.visualSensitivity === 'conservative'
      ? '10. If uncertain visually, do NOT flag. Only flag unmistakably clear elements.'
      : settings.visualSensitivity === 'aggressive'
      ? '10. Flag any visual element that could plausibly relate to the theme, including ambiguous cases.'
      : '10. If uncertain visually, do NOT flag.';

  return `You are a compliance-focused thematic QA engine.

RULES:
1. Stay strictly relevant to the theme.
2. Do NOT include weak, abstract, or loosely related associations.
3. Do NOT speculate.
4. No narrative explanation.
5. No commentary.
6. No redundancy.
7. Lowercase all generated keywords.
8. Maximum ${settings.maxKeywords} total generated keywords.
9. Only flag findings with clear evidence.
${visualRule}
${settings.strictMode ? '11. STRICT MODE: Even a single ambiguous indirect match must be escalated to moderate risk.' : ''}

STAGE 1 — THEME EXPANSION
Generate structured keyword sets under:
- direct_terms
- characters
- objects
- symbols
- phrases
- visual_indicators
Only include items strongly and recognizably associated with the theme.

STAGE 2 — TEXT SCAN
Scan PDF_TEXT for exact matches, plural variations, short phrase matches.
Record: slide number (if available), matched term, surrounding sentence.

STAGE 3 — VISUAL SCAN
Analyze slide images for objects, symbols, and scenes matching the keyword sets.
Only flag clear, identifiable elements.
Do NOT infer based on color alone unless explicitly symbolic.

STAGE 4 — RISK ASSESSMENT
Assign:
- none (no matches)
- low (1 minor indirect match)
- moderate (multiple indirect matches)
- high (direct thematic content present)

Return ONLY valid JSON matching the schema exactly. No markdown. No commentary.`;
}

export async function runThematicQA(
  theme: string,
  parsedText: string,
  slideImages: { slide: number; dataUrl: string }[],
  settings: QASettings = DEFAULT_SETTINGS
): Promise<ThematicQAResult> {
  const { model, tier } = await getResolvedModelForTool(TOOL_ID, ALLOWED_TIERS);

  // Build contents array: text prompt + inline images
  const imageParts = slideImages.map((img) => ({
    inlineData: {
      mimeType: "image/png" as const,
      data: img.dataUrl.replace(/^data:image\/png;base64,/, ""),
    },
  }));

  const textPrompt = `THEME: ${theme}

PDF_TEXT:
${parsedText}

PDF_IMAGES: ${slideImages.length} slide images are attached above (one per slide in order).

Analyze all content and return the compliance report as JSON.`;

  const contents: any[] = [
    ...imageParts.map((part, i) => ({
      role: "user" as const,
      parts: [{ text: `Slide ${slideImages[i].slide} image:` }, part],
    })),
    {
      role: "user" as const,
      parts: [{ text: textPrompt }],
    },
  ];

  const response = await ai.models.generateContent({
    model,
    contents: contents.flatMap((c) => c.parts),
    config: {
      systemInstruction: buildSystemPrompt(settings),
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING },
          generated_keywords: {
            type: Type.OBJECT,
            properties: {
              direct_terms: { type: Type.ARRAY, items: { type: Type.STRING } },
              characters: { type: Type.ARRAY, items: { type: Type.STRING } },
              objects: { type: Type.ARRAY, items: { type: Type.STRING } },
              symbols: { type: Type.ARRAY, items: { type: Type.STRING } },
              phrases: { type: Type.ARRAY, items: { type: Type.STRING } },
              visual_indicators: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["direct_terms", "characters", "objects", "symbols", "phrases", "visual_indicators"],
          },
          text_matches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                slide: { type: Type.STRING },
                matched_term: { type: Type.STRING },
                context: { type: Type.STRING },
              },
              required: ["slide", "matched_term", "context"],
            },
          },
          visual_matches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                slide: { type: Type.STRING },
                matched_element: { type: Type.STRING },
                confidence: { type: Type.STRING },
              },
              required: ["slide", "matched_element", "confidence"],
            },
          },
          risk_level: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ["theme", "generated_keywords", "text_matches", "visual_matches", "risk_level", "summary"],
      },
    },
  });

  await logUsage("Thematic QA", model, 0.05, tier);

  const json = JSON.parse(response.text || "{}");
  return json as ThematicQAResult;
}
