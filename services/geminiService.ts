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

interface ToolConfig {
  instruction: string;
  isLocked: boolean;
}

const fetchConfig = async (toolId: string, fallback: string): Promise<ToolConfig> => {
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

const logUsage = async (tool: string, model: string, cost: number = 0.01) => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await addDoc(collection(db, "usage"), {
      userId: user.uid,
      userEmail: user.email,
      tool,
      model,
      timestamp: serverTimestamp(),
      cost
    });
  } catch (e) {
    console.error("Failed to log usage", e);
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
  // Fix: Access .text property directly
  return JSON.parse(response.text || "{}");
};

export const generateLessonContent = async (info: LessonInfo, mode: OutputMode): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = await fetchConfig('lesson-descriptions', SYSTEM_INSTRUCTION);
  const model = 'gemini-3-flash-preview';
  const stabilityHint = config.isLocked ? "\nSTABILITY NOTE: This is a verified production prompt. Do not deviate from these logic constraints." : "";
  
  const response = await ai.models.generateContent({
    model,
    contents: `${config.instruction}${stabilityHint}\nMODE: ${mode}\nDATA: ${JSON.stringify(info)}`,
  });
  await logUsage(`Lesson ${mode}`, model, 0.005);
  // Fix: Access .text property directly
  return response.text || "";
};

export const generateAudioSound = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = await fetchConfig('sound-generator', "Generate success chimes and effects.");
  const model = "gemini-2.5-flash-preview-tts";
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: `${config.instruction}\nSound: ${prompt}` }] }],
    config: { 
      // Fix: Use Modality enum instead of string literal
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Puck' }
        }
      }
    },
  });
  await logUsage("Sound Gen", model, 0.02);
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "";
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

export const validateVRLink = async (url: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  const config = await fetchConfig('vr-validator', "You are a validation tool for Novakid classroom VR links.");

  const response = await ai.models.generateContent({
    model,
    contents: `${config.instruction}\n\nINPUT URL: ${url}`,
  });

  await logUsage("VR Validator", model, 0.005);
  // Fix: Access .text property directly
  return response.text || "Error validating link.";
};

export const assignTopicsWithAI = async (words: string[], references: any[], onProgress: any): Promise<TopicAssignmentResult[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
  // Fix: Access .text property directly
  return JSON.parse(response.text || "[]");
};

export const generateTAF = async (lessonData: any, metadata: string, ruleset: any): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = await fetchConfig('taf-generator', "Generate TAF rows based on ruleset.");
  const model = 'gemini-3-flash-preview';
  const stabilityHint = config.isLocked ? "\nSTABILITY NOTE: This is a verified production prompt. Do not deviate from these logic constraints." : "";

  const parts: any[] = [
    { text: `${config.instruction}${stabilityHint}\nMetadata: ${metadata}\nRules: ${JSON.stringify(ruleset)}\nCRITICAL: Do NOT end statements with a full stop or any punctuation at the very end.` }
  ];

  if (typeof lessonData === 'object' && lessonData.data) {
    parts.push({
      inlineData: {
        data: lessonData.data,
        mimeType: lessonData.mimeType
      }
    });
    parts.push({ text: "Please extract the lesson content from the provided document and generate the TAF rows. Remember: NO full stops at the end of statements." });
  } else {
    parts.push({ text: `Lesson Content: ${lessonData}\nGenerate TAF row object. NO full stops at end of statements.` });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: { responseMimeType: "application/json" }
  });
  
  await logUsage("TAF Gen", model, 0.03);
  // Fix: Access .text property directly
  return JSON.parse(response.text || "{}");
};

export const generateProofReport = async (data: any): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const config = await fetchConfig('proofing-bot', `Proofread this text for UK English spelling and grammar. Ensure all headings follow the same format. Only suggest tonal changes if the tone is inconsistent within the document or if the writing feels unfinished. Output the findings in a simple, clear list for the user to action.`);
  const model = 'gemini-3-flash-preview';

  const parts: any[] = [{ text: config.instruction }];

  if (typeof data === 'object' && data.data) {
    parts.push({ inlineData: { data: data.data, mimeType: data.mimeType } });
    parts.push({ text: "Please proofread the text within this document according to the provided instructions." });
  } else {
    parts.push({ text: `Text to proofread: ${data}` });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts }
  });

  await logUsage("Proofing Audit", model, 0.02);
  // Fix: Access .text property directly
  return response.text || "No specific issues found.";
};