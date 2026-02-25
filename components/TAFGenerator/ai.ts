import { ai } from '../../lib/aiClient';
import { resolveModel } from '../../lib/modelRegistry';
import { fetchConfig, logUsage } from "../../services/geminiService";

export const generateTAF = async (lessonData: any, metadata: string, ruleset: any): Promise<any> => {
    const config = await fetchConfig('taf-generator', "Generate TAF rows based on ruleset.");
    const model = resolveModel();
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
    return JSON.parse(response.text || "{}");
};
