import { GoogleGenAI } from "@google/genai";
import { fetchConfig, logUsage } from "../../services/geminiService";
import { LessonInfo, OutputMode } from "../../types";
import { SYSTEM_INSTRUCTION } from "../../constants";

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
    return response.text || "";
};
