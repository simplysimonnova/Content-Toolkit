
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

export interface TNResult {
  fixedNotes: string;
  fixLog: string;
}

export async function fixTeacherNotes(rawNotes: string, systemPrompt: string): Promise<TNResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
[INPUT DATA]:
${rawNotes}

REWRITE NOW.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.1,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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

    const text = response.text?.trim() || "{}";
    try {
      const json = JSON.parse(text);
      return {
        fixedNotes: json.fixedNotes || "Error: No notes generated.",
        fixLog: json.fixLog || "No issues identified.",
      };
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Raw text:", text);
      // Fallback if JSON parsing fails but we have some text
      if (text.includes("fixedNotes")) {
         // Try a very crude extraction if it's almost JSON
         const match = text.match(/"fixedNotes"\s*:\s*"([\s\S]*?)"/);
         if (match && match[1]) {
            return {
              fixedNotes: match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
              fixLog: "Note: Partial recovery from malformed JSON response."
            };
         }
      }
      throw new Error("The AI returned an invalid response format. Please try again with a smaller amount of text.");
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("entity was not found")) {
      throw new Error("API Key issue. Please re-authenticate if required.");
    }
    throw new Error("Failed to process the notes. Please try again.");
  }
}
