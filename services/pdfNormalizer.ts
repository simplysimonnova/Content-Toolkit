import type { NormalizedSlide, NormalizationResult, PDFSourceType, NotesPattern } from '../components/AIQARunner/types';

const WORKER_SRC = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';

async function getPdfLib() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = await import('pdfjs-dist');
  // Vite may wrap the module in a .default — handle both shapes
  const lib = raw.default ?? raw;
  lib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
  return lib;
}

export interface RawPage {
  pageNumber: number;
  text: string;
  itemCount: number;
  avgFontSize: number;
}

async function extractRawPages(file: File): Promise<RawPage[]> {
  const lib = await getPdfLib();
  const pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: RawPage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as any[];
    const text = items.map((it: any) => it.str).join(' ').replace(/\s+/g, ' ').trim();
    const fontSizes = items.filter((it: any) => it.height > 0).map((it: any) => it.height as number);
    const avgFontSize = fontSizes.length > 0 ? fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length : 0;
    pages.push({ pageNumber: i, text, itemCount: items.length, avgFontSize });
  }

  return pages;
}

// GSlides: notes are embedded inline after a "---" or newline separator in the same text block,
// or appear as a lower block with smaller font on the same page.
export function normalizePagesGSlides(rawPages: RawPage[]): NormalizationResult {
  const slides: NormalizedSlide[] = [];
  let notesDetected = 0;

  for (const page of rawPages) {
    const text = page.text;

    // Heuristic: look for a notes separator pattern
    // GSlides exports often have the notes block after a line with just whitespace
    // We split on common note delimiters
    const separators = [
      /\s{3,}(?=[A-Z])/,   // large whitespace gap before a capital (new sentence)
      /\[Notes?\][:：]?\s*/i,
      /Speaker Notes?[:：]?\s*/i,
    ];

    let slideText = text;
    let speakerNotes: string | null = null;

    for (const sep of separators) {
      const match = text.split(sep);
      if (match.length >= 2 && match[0].length > 20 && match[1].length > 10) {
        slideText = match[0].trim();
        speakerNotes = match.slice(1).join(' ').trim() || null;
        break;
      }
    }

    // Secondary: if avg font size drops significantly in later items, treat tail as notes
    if (!speakerNotes && page.avgFontSize > 0) {
      const words = text.split(' ');
      if (words.length > 30) {
        const boundary = Math.floor(words.length * 0.65);
        const head = words.slice(0, boundary).join(' ');
        const tail = words.slice(boundary).join(' ');
        if (tail.length > 20 && tail.split(' ').length > 5) {
          slideText = head.trim();
          speakerNotes = tail.trim();
        }
      }
    }

    if (speakerNotes) notesDetected++;

    slides.push({
      slideNumber: page.pageNumber,
      slideText: slideText.trim(),
      speakerNotes: speakerNotes || null,
    });
  }

  const pattern: NotesPattern = notesDetected === 0 ? 'none' : notesDetected > slides.length * 0.4 ? 'inline' : 'inline';
  const confidence = notesDetected / Math.max(slides.length, 1);

  return { slides, detectedNotesPattern: pattern, normalizationConfidence: confidence };
}

// Slides.com: notes are separate pages — high text density, white bg, no large images
// Detect note pages by: high item count relative to avg, small avg font size
export function normalizePagesSlidescom(rawPages: RawPage[]): NormalizationResult {
  if (rawPages.length === 0) return { slides: [], detectedNotesPattern: 'none', normalizationConfidence: 0 };

  const avgItemCount = rawPages.reduce((a, b) => a + b.itemCount, 0) / rawPages.length;
  const avgFont = rawPages.reduce((a, b) => a + b.avgFontSize, 0) / rawPages.length;

  const isNotesPage = (page: RawPage): boolean => {
    // Notes pages: more text items than average AND smaller font than average
    const highDensity = page.itemCount > avgItemCount * 1.3;
    const smallFont = page.avgFontSize < avgFont * 0.85;
    const hasSubstantialText = page.text.length > 80;
    return (highDensity || smallFont) && hasSubstantialText;
  };

  const slides: NormalizedSlide[] = [];
  let slideCounter = 0;
  let notesDetected = 0;
  let i = 0;

  while (i < rawPages.length) {
    const page = rawPages[i];

    if (isNotesPage(page)) {
      // Pair with previous slide if exists
      if (slides.length > 0) {
        const prev = slides[slides.length - 1];
        if (!prev.speakerNotes) {
          prev.speakerNotes = page.text.trim();
          notesDetected++;
        }
      }
      i++;
      continue;
    }

    slideCounter++;
    let speakerNotes: string | null = null;

    // Look ahead: next page notes page?
    if (i + 1 < rawPages.length && isNotesPage(rawPages[i + 1])) {
      speakerNotes = rawPages[i + 1].text.trim();
      notesDetected++;
      i += 2;
    } else {
      i++;
    }

    slides.push({
      slideNumber: slideCounter,
      slideText: page.text.trim(),
      speakerNotes,
    });
  }

  const pattern: NotesPattern = notesDetected === 0 ? 'none' : 'separate';
  const confidence = slides.length > 0 ? notesDetected / slides.length : 0;

  return { slides, detectedNotesPattern: pattern, normalizationConfidence: confidence };
}

export async function normalizePDF(
  file: File,
  sourceType: PDFSourceType
): Promise<NormalizationResult> {
  const rawPages = await extractRawPages(file);

  if (rawPages.length === 0) {
    return { slides: [], detectedNotesPattern: 'none', normalizationConfidence: 0 };
  }

  if (sourceType === 'gslides') {
    return normalizePagesGSlides(rawPages);
  } else {
    return normalizePagesSlidescom(rawPages);
  }
}
