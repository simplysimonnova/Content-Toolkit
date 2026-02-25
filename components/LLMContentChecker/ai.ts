import { ai } from '../../lib/aiClient';
import { resolveModel } from '../../lib/modelRegistry';
import { fetchConfig, logUsage } from "../../services/geminiService";

export const generateProofReport = async (data: any): Promise<string> => {
    const config = await fetchConfig('proofing-bot', `Proofread this text for UK English spelling and grammar. Ensure all headings follow the same format. Only suggest tonal changes if the tone is inconsistent within the document or if the writing feels unfinished. Output the findings in a simple, clear list for the user to action.`);
    const model = resolveModel();

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
    return response.text || "No specific issues found.";
};
