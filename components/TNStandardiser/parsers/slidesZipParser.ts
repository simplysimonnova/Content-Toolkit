import JSZip from 'jszip';

/**
 * Extracts teacher notes from a Slides.com ZIP export.
 *
 * Slides.com ZIP structure (confirmed from SlidesZipUpload.tsx):
 * - index.html contains the full Reveal.js presentation
 * - Speaker notes are stored as a JSON object embedded in index.html:
 *     "notes":{"<slideId>":"<note text>", ...}
 * - Slide order comes from <section data-id="..."> elements in the DOM
 * - Notes are keyed by data-id, not by index — mapped to logical slide number here
 *
 * Does NOT substitute slide body text when notes are absent.
 * Returns a string in ### SLIDE N ### block format ready for the AI processor.
 */
export async function extractNotesFromSlidesZip(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(file);

  const indexFile = zip.file('index.html');
  if (!indexFile) {
    throw new Error('Invalid Slides.com export — index.html not found in ZIP.');
  }

  const html = await indexFile.async('string');

  // Extract notes JSON block: "notes":{"slideId":"note text",...}
  let notesBySlideId: Record<string, string> = {};
  try {
    const notesMatch = html.match(/"notes":\{[\s\S]*?\}/);
    if (notesMatch) {
      const jsonString = notesMatch[0].replace(/^"notes":/, '');
      notesBySlideId = JSON.parse(jsonString);
    }
  } catch {
    // Notes JSON malformed — proceed with empty notes map
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Get slides in DOM order — prefer data-id sections, fall back to all sections
  const sectionEls = Array.from(
    doc.querySelectorAll('section.present, section[data-id], .slides section')
  );
  const sections = sectionEls.length > 0
    ? sectionEls
    : Array.from(doc.querySelectorAll('section'));

  if (sections.length === 0) {
    throw new Error(
      'No slide sections found in index.html. This may not be a valid Slides.com export.'
    );
  }

  let fullText = '';
  let logicalSlideNum = 1;
  let notesFound = 0;

  for (const section of sections) {
    const slideId = section.getAttribute('data-id') || '';
    const notesText = (notesBySlideId[slideId] || '').trim();

    if (notesText) {
      fullText += `### SLIDE ${logicalSlideNum} ###\n${notesText}\n\n`;
      notesFound++;
    } else {
      fullText += `### SLIDE ${logicalSlideNum} ###\n[No Teacher Notes found for this slide]\n\n`;
    }
    logicalSlideNum++;
  }

  if (logicalSlideNum === 1) {
    throw new Error('No slides found in the Slides.com ZIP export.');
  }

  if (notesFound === 0) {
    throw new Error(
      'No speaker notes were found in this Slides.com export. ' +
      'Ensure the presentation was exported with speaker notes included.'
    );
  }

  return fullText.trim();
}
