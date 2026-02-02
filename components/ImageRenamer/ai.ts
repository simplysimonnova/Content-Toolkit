import { GoogleGenAI } from "@google/genai";
import { logUsage } from "../../services/geminiService";

export const analyzeImageForRenaming = async (base64Data: string, mimeType: string, stylePrefix: string): Promise<any> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-flash-preview';

    const prompt = `Visually analyze this image and provide a standardized filename following these Novakid rules:
  1. Format: ${stylePrefix}[type]-[subject]-[descriptor]-[variant]
  2. Types: char, prop, bg, icon, anim
  3. Rules: Lowercase, hyphens only, concise but descriptive.
  Return a JSON object with: 
  {
    "type": "string",
    "subject": "string",
    "descriptor": "string",
    "proposedName": "string",
    "reasoning": "string"
  }`;

    const response = await ai.models.generateContent({
        model,
        contents: {
            parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: prompt }
            ]
        },
        config: { responseMimeType: "application/json" }
    });

    await logUsage("Image Analysis", model, 0.01);
    return JSON.parse(response.text || "{}");
};
