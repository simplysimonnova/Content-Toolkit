import { GoogleGenAI } from "@google/genai";
import { fetchConfig, logUsage } from "../../services/geminiService";

export interface TicketData {
    notes: string;
    image?: {
        data: string;
        mimeType: string;
    };
}

export const generateJiraTicket = async (data: TicketData): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const fallbackInstruction = `
Your job is to take raw notes and/or screenshots and generate a clean, short, structured Jira/Trello ticket draft.

Always output in this exact format:

Title: [Short Summary of Issue]

Description:
[Clear, concise explanation. Include screenshots if provided.]

Steps to reproduce:
1.
2.

Expected:

Actual:

Severity:

Severity guidance: Always choose Low unless clear user-facing breakage or revenue impact is described.
Noise filter: If no clear reproduction steps are found, leave blank — don’t invent.
  `.trim();

    const config = await fetchConfig('jira-ticketer', fallbackInstruction);
    const model = 'gemini-3-flash-preview';

    const parts: any[] = [{ text: config.instruction }];

    if (data.image) {
        parts.push({ inlineData: { data: data.image.data, mimeType: data.image.mimeType } });
        parts.push({ text: `Raw notes accompanying this screenshot: ${data.notes || "None provided"}` });
    } else {
        parts.push({ text: `Raw notes: ${data.notes}` });
    }

    const response = await ai.models.generateContent({
        model,
        contents: { parts }
    });

    await logUsage("Jira Ticketer", model, 0.02);
    return response.text || "Failed to generate ticket.";
};
