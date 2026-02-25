import { GoogleGenAI, Type, Modality } from "@google/genai";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import { LessonInfo, OutputMode, Subscription } from '../types';
import { SYSTEM_INSTRUCTION } from '../constants';

export interface TopicAssignmentResult {
  word: string;
  topicId: string;
  topic: string;
  canDo: string;
  status: 'New' | 'Existing';
}

export interface TopicReference {
  id: string;
  topic: string;
  canDo: string;
}

export interface ToolConfig {
  instruction: string;
  isLocked: boolean;
}

export const fetchConfig = async (toolId: string, fallback: string): Promise<ToolConfig> => {
  try {
    const d = await getDoc(doc(db, 'configurations', toolId));
    if (d.exists()) {
      const data = d.data();
      return {
        instruction: data.instruction || fallback,
        isLocked: !!data.isLocked
      };
    }
    return { instruction: fallback, isLocked: false };
  } catch (e) {
    return { instruction: fallback, isLocked: false };
  }
};

export const logUsage = async (tool: string, model: string, cost: number = 0.01) => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, "usage"), {
      userId: user.uid,
      userEmail: user.email,
      tool,
      tool_id: tool.toLowerCase().replace(/\s+/g, '-'),
      tool_name: tool,
      model,
      timestamp: serverTimestamp(),
      cost,
      is_ai_tool: true,
      status: 'success',
    });
  } catch (e) {
    console.error("Failed to log usage", e);
  }
};

/**
 * Log usage for non-AI tools. Writes to the same `usage` collection.
 * Fire-and-forget — never throws, never blocks execution.
 */
export const logToolUsage = async (params: {
  tool_id: string;
  tool_name: string;
  status?: 'success' | 'error';
  execution_time_ms?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, "usage"), {
      userId: user.uid,
      userEmail: user.email,
      tool: params.tool_name,
      tool_id: params.tool_id,
      tool_name: params.tool_name,
      model: null,
      cost: 0,
      timestamp: serverTimestamp(),
      is_ai_tool: false,
      status: params.status ?? 'success',
      ...(params.execution_time_ms !== undefined ? { execution_time_ms: params.execution_time_ms } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    });
  } catch (e) {
    console.error("Failed to log tool usage", e);
  }
};

export const parseSubscriptionsFromPDF = async (base64Data: string): Promise<Partial<Subscription>[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';

  const prompt = `Extract all AI services from this subscription report PDF table. 
  
  MAPPING RULES:
  1. Provider -> name
  2. Service -> planName
  3. Status (Active -> 'Active', anything else -> 'Paused')
  4. Price (Extract number only, e.g. "$11.99" -> 11.99)
  5. Cycle (Monthly/Yearly) -> frequency
  6. Keep Active: Yes -> category: 'Keep Active'
  7. For Testing: Yes -> category: 'For Testing'
  8. Notes -> notes
  
  Return a JSON array of objects matching the schema.`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            planName: { type: Type.STRING },
            price: { type: Type.NUMBER },
            frequency: { type: Type.STRING, enum: ['Monthly', 'Yearly'] },
            status: { type: Type.STRING, enum: ['Active', 'Paused'] },
            category: { type: Type.STRING, enum: ['Keep Active', 'For Testing'] },
            notes: { type: Type.STRING },
            isEssential: { type: Type.BOOLEAN }
          },
          required: ['name', 'price', 'frequency', 'status', 'category']
        }
      }
    }
  });

  await logUsage("Subscription PDF Import", model, 0.05);
  // Fix: Access .text property directly as per GenAI guidelines
  return JSON.parse(response.text || "[]");
};

export const rewriteImagePrompt = async (source: string, instruction: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = await fetchConfig('prompt-rewriter', "Follow image consistency rules.");
  const model = 'gemini-3-flash-preview';
  const response = await ai.models.generateContent({
    model,
    contents: `${config.instruction}\nRewrite image prompt: ${source}\nInst: ${instruction}`,
  });
  await logUsage("Image Rewrite", model, 0.01);
  // Fix: Access .text property directly
  return response.text || "";
};

export const generateNewImagePrompt = async (keywords: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';

  // Use explicit tool ID 'prompt-writer' to match the UI settings
  const config = await fetchConfig('prompt-writer', "You are an expert AI image prompt engineer for Novakid materials.");

  const response = await ai.models.generateContent({
    model,
    contents: `${config.instruction}\n\nUSER KEYWORDS: ${keywords}\n\nSTRICT OUTPUT RULE: Return exactly ONE single paragraph. No lists. No intro text. No options. Only the prompt.`,
  });
  await logUsage("Prompt Creator", model, 0.01);
  // Fix: Access .text property directly
  return response.text || "";
};