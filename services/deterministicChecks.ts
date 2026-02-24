import type { NormalizedSlide, QAMode, DeterministicResult } from '../components/AIQARunner/types';

const MIN_SLIDE_COUNT: Record<QAMode, number> = {
  'full-lesson': 5,
  'chunk-qa': 2,
  'stem-qa': 3,
  'post-design-qa': 3,
};

const MAX_MISSING_NOTES_PCT: Record<QAMode, number> = {
  'full-lesson': 0.4,
  'chunk-qa': 0.5,
  'stem-qa': 0.4,
  'post-design-qa': 0.6,
};

export function runDeterministicChecks(
  slides: NormalizedSlide[],
  mode: QAMode,
  title: string
): DeterministicResult {
  const flags: string[] = [];
  let criticalFail = false;

  // 1. Slide count check
  const minSlides = MIN_SLIDE_COUNT[mode];
  if (slides.length < minSlides) {
    flags.push(`Slide count (${slides.length}) is below the minimum required for ${mode} (${minSlides}).`);
    criticalFail = true;
  }

  // 2. Empty slides
  const emptySlides = slides.filter(s => !s.slideText || s.slideText.trim().length < 5);
  if (emptySlides.length > 0) {
    const nums = emptySlides.map(s => s.slideNumber).join(', ');
    flags.push(`${emptySlides.length} slide(s) have empty or near-empty content: slides ${nums}.`);
  }

  // 3. Missing speaker notes %
  const slidesWithNotes = slides.filter(s => s.speakerNotes && s.speakerNotes.trim().length > 0);
  const missingNotesPct = 1 - slidesWithNotes.length / Math.max(slides.length, 1);
  const maxMissing = MAX_MISSING_NOTES_PCT[mode];
  if (missingNotesPct > maxMissing) {
    const pct = Math.round(missingNotesPct * 100);
    flags.push(`${pct}% of slides are missing speaker notes (threshold: ${Math.round(maxMissing * 100)}%).`);
    if (missingNotesPct > 0.8) criticalFail = true;
  }

  // 4. Missing title
  if (!title || title.trim().length < 2) {
    flags.push('Lesson title is missing or too short.');
    criticalFail = true;
  }

  // 5. Entirely empty content
  const totalText = slides.map(s => s.slideText).join('').trim();
  if (totalText.length < 50) {
    flags.push('Total extracted slide text is too short — PDF may not have extracted correctly.');
    criticalFail = true;
  }

  // 6. Mode-specific: STEM QA needs at least some numeric/formula content
  if (mode === 'stem-qa') {
    const hasNumbers = slides.some(s => /\d/.test(s.slideText));
    if (!hasNumbers) {
      flags.push('STEM QA mode selected but no numeric content detected in slides.');
    }
  }

  return {
    deterministicPass: flags.length === 0,
    flags,
    criticalFail,
  };
}
