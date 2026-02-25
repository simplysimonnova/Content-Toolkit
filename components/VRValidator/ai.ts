import { ai } from '../../lib/aiClient';
import { type CapabilityTier } from '../../lib/modelRegistry';
import { getResolvedModelForTool } from '../../lib/toolTierResolver';
import { fetchConfig, logUsage } from "../../services/geminiService";

export const ALLOWED_TIERS: CapabilityTier[] = ['default'];
const TOOL_ID = 'vr-validator';

export const validateVRLink = async (url: string): Promise<string> => {
    const { model, tier } = await getResolvedModelForTool(TOOL_ID, ALLOWED_TIERS);
    const config = await fetchConfig('vr-validator', "You are a validation tool for Novakid classroom VR links.");

    const response = await ai.models.generateContent({
        model,
        contents: `${config.instruction}\n\nINPUT URL: ${url}`,
    });

    await logUsage("VR Validator", model, 0.005, tier);
    return response.text || "Error validating link.";
};
