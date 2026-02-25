import { ai } from '../../lib/aiClient';
import { resolveModel } from '../../lib/modelRegistry';
import { fetchConfig, logUsage } from "../../services/geminiService";
import { LessonInfo, OutputMode } from "../../types";
import { SYSTEM_INSTRUCTION } from "../../constants";

export const generateLessonContent = async (info: LessonInfo, mode: OutputMode): Promise<string> => {
    const config = await fetchConfig('lesson-descriptions', SYSTEM_INSTRUCTION);
    const model = resolveModel();
    const stabilityHint = config.isLocked ? "\nSTABILITY NOTE: This is a verified production prompt. Do not deviate from these logic constraints." : "";

    const response = await ai.models.generateContent({
        model,
        contents: `${config.instruction}${stabilityHint}\nMODE: ${mode}\nDATA: ${JSON.stringify(info)}`,
    });
    await logUsage(`Lesson ${mode}`, model, 0.005);
    return response.text || "";
};
