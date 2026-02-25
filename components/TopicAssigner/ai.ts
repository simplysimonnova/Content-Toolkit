import { Type } from "@google/genai";
import { ai } from '../../lib/aiClient';
import { type CapabilityTier } from '../../lib/modelRegistry';
import { getResolvedModelForTool } from '../../lib/toolTierResolver';
import { logUsage } from "../../services/geminiService";

export const ALLOWED_TIERS: CapabilityTier[] = ['default'];
const TOOL_ID = 'topic-assigner';

export interface TopicAssignmentResult {
    word: string;
    topicId: string;
    topic: string;
    canDo: string;
    status: 'New' | 'Existing';
}

export const assignTopicsWithAI = async (words: string[], references: any[], onProgress: any): Promise<TopicAssignmentResult[]> => {
    const { model, tier } = await getResolvedModelForTool(TOOL_ID, ALLOWED_TIERS);
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
    await logUsage("Topic Assigner", model, 0.05, tier);
    return JSON.parse(response.text || "[]");
};
