# Vercel Deployment Guide

Based on the Gemini SDK Coding Guidelines and standard Vercel deployment patterns, your code is highly compliant. Follow these steps to complete the deployment.

## 1. API Keys & Environment Variables [IN PROGRESS]
The code in your services (e.g., `geminiService.ts`) calls `process.env.API_KEY`.

- **Action:** On the Vercel Dashboard, go to **Settings > Environment Variables** and add a key named `API_KEY`.
- **Status:** API keys are defined in the Google Cloud project; these will be managed during the Vercel deployment set up.

## 2. Build Pipeline [DONE]
- **Status:** Verified. `package.json` contains the necessary `"build": "vite build"` script. Vercel will automatically detect this and transpile your TSX files into browser-ready JavaScript.

## 3. Firebase & Domain Authorization [IN PROGRESS]
- **Requirement:** Authorized domains must be updated in both **Firebase Console** and **Google Cloud Console** to allow the Vercel URL to communicate with Firebase services.
- **Status:** The `firebase.rules` are already synced in the Firebase console.
- **Pending:** Add your production Vercel URL (e.g., `*.vercel.app`) to the "Authorized Domains" list in Firebase Auth and the Cloud Console.

## 4. Gemini SDK Compliance Audit [PENDING]
While the code is architected for compliance, the final verification against the live environment is pending.

- **Initialization:** Uses named parameter `{ apiKey: process.env.API_KEY }`.
- **Models:** Configured for `gemini-3-flash-preview` and `gemini-2.5-flash-preview-tts`.
- **Audio:** `SoundGenerator` implements low-latency PCM streaming.

## Summary
The build system is ready. The remaining manual tasks are environment variable injection and domain whitelisting in the Firebase/Cloud consoles.