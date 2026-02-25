import { ai } from '../../lib/aiClient';
import { fetchConfig, logUsage } from "../../services/geminiService";

export const validateVRLink = async (url: string): Promise<string> => {
    const model = 'gemini-3-flash-preview';
    const config = await fetchConfig('vr-validator', "You are a validation tool for Novakid classroom VR links.");

    const response = await ai.models.generateContent({
        model,
        contents: `${config.instruction}\n\nINPUT URL: ${url}`,
    });

    await logUsage("VR Validator", model, 0.005);
    return response.text || "Error validating link.";
};
