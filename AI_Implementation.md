# Content Toolkit: AI Implementation Guide

This document outlines the **Defensive Initialization Pattern** used in the Content Toolkit to ensure high reliability and prevent authentication failures (400 Invalid Argument) in a modular frontend environment.

### Core Architectural Rules

1.  **Direct Environment Access**
    The SDK is initialized using `process.env.API_KEY` directly at the point of request. We avoid passing the key through React state, context, or props across multiple layers, as this can result in the key being lost or replaced by `undefined` strings during complex re-renders.

2.  **Strict Key Sanitization**
    Before any API call, a validation helper performs strict sanitization:
    - Trims leading/trailing whitespace.
    - Removes accidental quotes (`'` or `"`) that may be injected by deployment consoles or build tools.
    - Blocks execution if the key is detected as literal strings like `"undefined"`, `"null"`, or the boilerplate `"YOUR_API_KEY"`.

3.  **Late Binding (On-Demand Instances)**
    Instead of a single global `ai` instance, a fresh `GoogleGenAI` instance is created inside each service function immediately before the `generateContent` call. This ensures the client always uses the most up-to-date environment state and project configuration.

4.  **Diagnostic Handshaking**
    The service performs a "secure handshake" log on every call. It prints:
    - The first 6 characters of the key.
    - The total length of the key.
    This allows developers to verify that the environment variable is correctly injected into the browser context without exposing the full credential in the logs.

5.  **Model-Specific Routing**
    - **Text/JSON Tasks**: Uses `gemini-3-flash-preview` for high-speed reasoning and structured data extraction (Proofing, TAF, Lessons, Word Lists).
    - **Audio/Speech Tasks**: Uses `gemini-2.5-flash-preview-tts` specifically to handle the `Modality.AUDIO` requirements.

### Troubleshooting: Hard Refresh (Cmd+Shift+R) vs. Standard Refresh

A known race condition occurs during **Hard Refreshes**:
- **Standard Refresh (Cmd+R)**: The browser may preserve the environment context or resolve the async `process.env` injection faster due to cached hooks.
- **Hard Refresh (Cmd+Shift+R)**: The browser clears all cache and forces a cold start. If the Gemini call triggers before the environment bridge has finished injecting `process.env.API_KEY`, the SDK will receive an empty string or `undefined`, resulting in a `400 Invalid API Key` error.

**Solution implemented**: The app uses **Late Initialization**. By creating the `GoogleGenAI` instance only after a user interaction (button click), we ensure the environment has had several seconds to fully initialize, effectively bypassing the startup race condition.

### Best Practices for Future Updates

- **Do not** modify the `validateAndGetClient` function in `geminiService.ts` unless the SDK initialization signature changes.
- **Do not** attempt to "optimize" by moving the AI client to a global variable or React Context.
- Always check the **Browser Console** (F12) for the `[Gemini Auth] Handshake` log if an "API Key Not Valid" error reappears to confirm the injection source.