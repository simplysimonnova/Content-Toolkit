import { GoogleGenAI, Modality } from "@google/genai";
import { fetchConfig, logUsage } from "../../services/geminiService";

export const generateAudioSound = async (prompt: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const config = await fetchConfig('sound-generator', "Generate success chimes and effects.");
    const model = "gemini-2.5-flash-preview-tts";
    const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: `${config.instruction}\nSound: ${prompt}` }] }],
        config: {
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
