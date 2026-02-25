import { Type } from "@google/genai";
import { ai } from '../../lib/aiClient';
import { logUsage } from "../../services/geminiService";

export interface TopicAssignmentResult {
    word: string;
    topicId: string;
    topic: string;
    canDo: string;
    status: 'New' | 'Existing';
}

export const assignTopicsWithAI = async (words: string[], references: any[], onProgress: any): Promise<TopicAssignmentResult[]> => {
    const model = 'gemini-3-flash-preview';
    const response = await ai.models.generateContent({
        model,
        contents: `Assign topics for: ${words.join(', ')}. Use references: ${JSON.stringify(references)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        word: { type: Type.STRING },
                        topicId: { type: Type.STRING },
                        topic: { type: Type.STRING },
                        canDo: { type: Type.STRING },
                        status: { type: Type.STRING }
                    },
                    required: ["word", "topicId", "topic", "canDo", "status"]
                }
            }
        }
    });
    await logUsage("Topic Assigner", model, 0.05);
    return JSON.parse(response.text || "[]");
};
