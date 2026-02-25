/**
 * 🔒 AI Client Governance Rule
 *
 * - This is the single source of truth for AI initialisation.
 * - Do NOT access environment variables directly in AI tools.
 * - Do NOT create new GoogleGenAI instances elsewhere.
 * - All AI access must import from this file.
 */

import { GoogleGenAI } from "@google/genai";

if (!process.env.API_KEY) {
  console.error("❌ Missing API_KEY in environment.");
  throw new Error("Server misconfiguration: API_KEY missing.");
}

export const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY,
});
