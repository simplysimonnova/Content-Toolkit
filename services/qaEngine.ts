import { GoogleGenAI, Type } from '@google/genai';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import type { NormalizedSlide, QAMode, QAResult, QARun, QAVersion, PDFSourceType } from '../components/AIQARunner/types';
import { validateQAResult } from './resultValidator';

const MODEL = 'gemini-3-flash-preview';

const DEFAULT_PROMPTS: Record<QAMode, string> = {
  'full-lesson': `You are a senior instructional quality reviewer for Novakid, an online English school for children aged 4–12.

You will receive a structured lesson PDF export with slide text and speaker notes.
Your task is to perform a comprehensive QA review and return a strict JSON report.

EVALUATE:
1. Instructional clarity — are teacher instructions clear, step-by-step, and actionable?
2. Language appropriateness — is vocabulary and complexity suitable for the target age group?
3. Speaker notes completeness — do all key slides have adequate notes?
4. Slide structure — logical flow, proper labeling (Title slide, Warm-up, Extension, etc.)
5. Engagement — are activities varied and interactive?
6. Timing — are timings present where required?

SCORING (0–100):
- Instructional Clarity: 0–25
- Language Appropriateness: 0–25
- Notes Completeness: 0–20
- Structure & Flow: 0–15
- Engagement: 0–15

VERDICT RULES:
- pass: total ≥ 80, no critical issues
- pass-with-warnings: total ≥ 65, no critical issues
- revision-required: total < 65 OR any critical issue
- fail: total < 40 OR multiple critical issues`,

  'chunk-qa': `You are a QA reviewer for chunked lesson segments at Novakid.
Evaluate this lesson chunk (a subset of slides) for:
1. Internal coherence — does the chunk stand alone logically?
2. Speaker notes — adequate for the chunk's activities?
3. Difficulty progression — appropriate within chunk?
4. Transitions — clear entry/exit points?

SCORING (0–100):
- Coherence: 0–30
- Notes Quality: 0–25
- Difficulty: 0–25
- Transitions: 0–20

VERDICT RULES:
- pass: total ≥ 75
- pass-with-warnings: total ≥ 60
- revision-required: total < 60
- fail: total < 40`,

  'stem-qa': `You are a STEM content quality reviewer for Novakid.
Evaluate this STEM lesson for:
1. Scientific/mathematical accuracy — are facts, formulas, and concepts correct?
2. Age-appropriate complexity — suitable for the target level?
3. Hands-on activity quality — clear, safe, and achievable?
4. Visual support — diagrams and images described adequately?
5. Vocabulary — STEM terms introduced and explained?

SCORING (0–100):
- Accuracy: 0–30
- Complexity: 0–25
- Activity Quality: 0–20
- Visual Support: 0–15
- Vocabulary: 0–10

VERDICT RULES:
- pass: total ≥ 75
- pass-with-warnings: total ≥ 60
- revision-required: total < 60 OR any factual error
- fail: total < 40`,

  'post-design-qa': `You are a post-design QA reviewer for Novakid lesson slides.
Evaluate the final designed lesson for:
1. Text legibility — font sizes, contrast, readability
2. Content consistency — does slide text match speaker notes?
3. Completeness — no missing elements, placeholders, or TODOs
4. Branding compliance — appropriate tone and style
5. Final slide notes — are all final speaker notes production-ready?

SCORING (0–100):
- Legibility signals: 0–25
- Content consistency: 0–30
- Completeness: 0–25
- Notes readiness: 0–20

VERDICT RULES:
- pass: total ≥ 80
- pass-with-warnings: total ≥ 65
- revision-required: total < 65
- fail: total < 40`,
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    total_score: { type: Type.NUMBER },
    verdict: { type: Type.STRING, enum: ['pass', 'pass-with-warnings', 'revision-required', 'fail'] },
    short_summary: { type: Type.STRING },
    revision_required: { type: Type.BOOLEAN },
    revision_triggers: { type: Type.ARRAY, items: { type: Type.STRING } },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          slideNumber: { type: Type.NUMBER },
          severity: { type: Type.STRING, enum: ['critical', 'major', 'minor'] },
          description: { type: Type.STRING },
          suggestion: { type: Type.STRING },
        },
        required: ['severity', 'description', 'suggestion'],
      },
    },
    risks: { type: Type.ARRAY, items: { type: Type.STRING } },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
    scores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          score: { type: Type.NUMBER },
          maxScore: { type: Type.NUMBER },
          notes: { type: Type.STRING },
        },
        required: ['category', 'score', 'maxScore', 'notes'],
      },
    },
  },
  required: ['total_score', 'verdict', 'short_summary', 'revision_required', 'revision_triggers', 'strengths', 'issues', 'risks', 'suggestions', 'scores'],
};

async function fetchActivePrompt(mode: QAMode): Promise<{ prompt: string; versionTag: string }> {
  // 1. Check configurations collection first (edited via AIQASettingsModal in the tool)
  try {
    const configDoc = await getDoc(doc(db, 'configurations', `ai-qa-runner-${mode}`));
    if (configDoc.exists()) {
      const data = configDoc.data();
      if (data.instruction && !data.isLocked) {
        return { prompt: data.instruction, versionTag: `config-${mode}` };
      }
      if (data.instruction && data.isLocked) {
        return { prompt: data.instruction, versionTag: `config-${mode}-locked` };
      }
    }
  } catch (e) {
    console.warn('Could not fetch prompt from configurations, trying qa_versions:', e);
  }

  // 2. Fall back to qa_versions (legacy/admin-seeded prompts)
  try {
    const q = query(
      collection(db, 'qa_versions'),
      where('mode', '==', mode),
      where('active', '==', true)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data() as QAVersion;
      return { prompt: data.prompt_template, versionTag: data.version_tag };
    }
  } catch (e) {
    console.warn('Could not fetch QA prompt from qa_versions, using built-in default:', e);
  }

  // 3. Built-in hardcoded fallback
  return { prompt: DEFAULT_PROMPTS[mode], versionTag: 'default-v1' };
}

function buildUserPrompt(slides: NormalizedSlide[]): string {
  const slideBlocks = slides.map(s => {
    const notes = s.speakerNotes ? `\nSPEAKER NOTES: ${s.speakerNotes}` : '\nSPEAKER NOTES: [none]';
    return `--- SLIDE ${s.slideNumber} ---\n${s.slideText}${notes}`;
  }).join('\n\n');

  return `LESSON CONTENT (${slides.length} slides):\n\n${slideBlocks}\n\nPerform the QA review and return the JSON report.`;
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<{ raw: string; parsed: QAResult }> {
  const apiKey = process.env.API_KEY
    || (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GEMINI_API_KEY)
    || (typeof import.meta !== 'undefined' && (import.meta as any).env?.GEMINI_API_KEY);
  const ai = new GoogleGenAI({ apiKey: apiKey as string });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const raw = response.text || '';
  if (!raw.trim()) throw new Error('AI returned an empty response.');

  const parsed = JSON.parse(raw);
  const validation = validateQAResult(parsed);

  if (!validation.valid) {
    const errSummary = validation.errors.map(e => `${e.field}: ${e.message}`).join('; ');
    throw new Error(`AI response failed schema validation: ${errSummary}`);
  }

  return { raw, parsed: validation.result! };
}

export async function runQAEngine(
  slides: NormalizedSlide[],
  mode: QAMode,
  title: string,
  sourceType: PDFSourceType,
  deterministicFlags: string[],
  notesDetectedCount: number
): Promise<{ runId: string; run: QARun }> {
  const startTime = Date.now();
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated.');

  const { prompt: systemPrompt, versionTag } = await fetchActivePrompt(mode);
  const userPrompt = buildUserPrompt(slides);

  let raw = '';
  let parsed: QAResult;

  try {
    const result = await callAI(systemPrompt, userPrompt);
    raw = result.raw;
    parsed = result.parsed;
  } catch (firstErr) {
    console.warn('First AI attempt failed, retrying once:', firstErr);
    try {
      const result = await callAI(systemPrompt, userPrompt);
      raw = result.raw;
      parsed = result.parsed;
    } catch (retryErr: any) {
      throw new Error(`AI QA failed after retry: ${retryErr.message}`);
    }
  }

  const executionTimeMs = Date.now() - startTime;

  const run: QARun = {
    mode,
    title: title.trim() || 'Untitled Lesson',
    source_type: sourceType,
    normalized_slide_count: slides.length,
    notes_detected_count: notesDetectedCount,
    deterministic_flags: deterministicFlags,
    structured_scores: parsed.scores,
    revision_required: parsed.revision_required,
    revision_triggers: parsed.revision_triggers,
    total_score: parsed.total_score,
    verdict: parsed.verdict,
    short_summary: parsed.short_summary,
    full_report: parsed,
    raw_ai_response: raw,
    parsed_ai_json: parsed,
    prompt_version: versionTag,
    ai_model: MODEL,
    execution_time_ms: executionTimeMs,
    triggered_by_user_id: user.uid,
    triggered_by_user_email: user.email || '',
    created_at: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'qa_runs'), run);
  return { runId: docRef.id, run };
}
