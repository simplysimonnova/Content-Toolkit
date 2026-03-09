const WORKER_SRC = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';

async function getPdfLib() {
  const raw: any = await import('pdfjs-dist');
  const lib = raw.default ?? raw;
  lib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
  return lib;
}

/**
 * Extracts teacher notes from a Novakid PDF export.
 *
 * Novakid PDF exports interleave slide pages and notes pages:
 * - Odd pages (1, 3, 5...) = slide content
 * - Even pages (2, 4, 6...) = teacher notes for the preceding slide
 *
 * Returns a string in ### SLIDE N ### block format ready for the AI processor.
 */
export async function extractNotesFromPdf(file: File): Promise<string> {
  const lib = await getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  let logicalSlideNum = 1;

  for (let i = 2; i <= pdf.numPages; i += 2) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as any[])
      .map((item: any) => item.str)
      .join(' ');

    const cleanedText = pageText
      .replace(/\{\{[\s\S]*?\}\}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanedText) {
      fullText += `### SLIDE ${logicalSlideNum} ###\n${cleanedText}\n\n`;
    } else {
      fullText += `### SLIDE ${logicalSlideNum} ###\n[No Teacher Notes found for this slide]\n\n`;
    }
    logicalSlideNum++;
  }

  if (!fullText.trim()) {
    throw new Error('No teacher notes could be extracted from this PDF. Ensure it is a valid Novakid lesson export.');
  }

  return fullText.trim();
}
