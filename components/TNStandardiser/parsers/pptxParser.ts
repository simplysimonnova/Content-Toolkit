import JSZip from 'jszip';

/**
 * Extracts teacher notes from a .pptx file.
 *
 * Strategy:
 * 1. Read ppt/presentation.xml to get the correct logical slide order via r:id mapping.
 * 2. Resolve ppt/_rels/presentation.xml.rels to map rIds → slide file paths.
 * 3. Per slide: read its _rels file to find the notesSlide relationship.
 * 4. Parse the notes XML — prefer p:ph type="body" shapes; fall back to all a:t nodes.
 * 5. Strip {{ navigation codes }}.
 *
 * Returns a string in ### SLIDE N ### block format ready for the AI processor.
 */
export async function extractNotesFromPptx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slideFiles = Object.keys(zip.files).filter(
    name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
  );
  if (slideFiles.length === 0) {
    throw new Error('No slides found in the PowerPoint file. Ensure it is a valid .pptx export.');
  }

  const parser = new DOMParser();

  // Step 1: get logical slide order from presentation.xml
  const presentationContent = await zip.file('ppt/presentation.xml')!.async('string');
  const presentationXml = parser.parseFromString(presentationContent, 'text/xml');
  const sldIdList = presentationXml.getElementsByTagName('p:sldId');

  const slideOrder: { rId: string }[] = [];
  for (let i = 0; i < sldIdList.length; i++) {
    slideOrder.push({ rId: sldIdList[i].getAttribute('r:id') || '' });
  }

  // Step 2: map rId → slide file path
  const relsContent = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
  const relsXml = parser.parseFromString(relsContent, 'text/xml');
  const relationships = relsXml.getElementsByTagName('Relationship');

  const rIdToPath: Record<string, string> = {};
  for (let i = 0; i < relationships.length; i++) {
    const rId = relationships[i].getAttribute('Id') || '';
    const target = relationships[i].getAttribute('Target') || '';
    rIdToPath[rId] = target.startsWith('slides/')
      ? `ppt/${target}`
      : `ppt/slides/${target}`;
  }

  const orderedSlidePaths = slideOrder
    .map(s => rIdToPath[s.rId])
    .filter(Boolean);

  let fullText = '';
  let logicalSlideNum = 1;

  for (const slidePath of orderedSlidePaths) {
    const slideFileName = slidePath.split('/').pop() || '';
    let extractedNotes = '';

    // Step 3: find notesSlide relationship for this slide
    const slideRelsPath = `ppt/slides/_rels/${slideFileName}.rels`;
    if (zip.file(slideRelsPath)) {
      const slideRelsContent = await zip.file(slideRelsPath)!.async('string');
      const slideRelsXml = parser.parseFromString(slideRelsContent, 'text/xml');
      const slideRels = slideRelsXml.getElementsByTagName('Relationship');

      for (let j = 0; j < slideRels.length; j++) {
        const type = slideRels[j].getAttribute('Type') || '';
        if (type.includes('notesSlide')) {
          const target = slideRels[j].getAttribute('Target') || '';
          const notesPath = target.startsWith('../')
            ? `ppt/${target.substring(3)}`
            : `ppt/notesSlides/${target}`;

          if (zip.file(notesPath)) {
            const notesContent = await zip.file(notesPath)!.async('string');
            const notesXml = parser.parseFromString(notesContent, 'text/xml');

            // Step 4: prefer body placeholder shapes
            const shapes = notesXml.getElementsByTagName('p:sp');
            let notesFoundInBody = false;
            let slideNotes = '';

            for (let k = 0; k < shapes.length; k++) {
              const ph = shapes[k].getElementsByTagName('p:ph')[0];
              if (ph && ph.getAttribute('type') === 'body') {
                const textNodes = shapes[k].getElementsByTagName('a:t');
                for (let l = 0; l < textNodes.length; l++) {
                  slideNotes += textNodes[l].textContent + ' ';
                }
                notesFoundInBody = true;
              }
            }

            // Fallback: all a:t nodes, filtering bare slide numbers
            if (!notesFoundInBody) {
              const textNodes = notesXml.getElementsByTagName('a:t');
              for (let k = 0; k < textNodes.length; k++) {
                const txt = textNodes[k].textContent || '';
                if (!/^\d+$/.test(txt.trim())) {
                  slideNotes += txt + ' ';
                }
              }
            }

            // Step 5: strip navigation codes
            extractedNotes = slideNotes
              .replace(/\{\{[\s\S]*?\}\}/g, '')
              .replace(/\s+/g, ' ')
              .trim();
          }
          break;
        }
      }
    }

    if (extractedNotes) {
      fullText += `### SLIDE ${logicalSlideNum} ###\n${extractedNotes}\n\n`;
    } else {
      fullText += `### SLIDE ${logicalSlideNum} ###\n[No Teacher Notes found for this slide]\n\n`;
    }
    logicalSlideNum++;
  }

  if (!fullText.trim()) {
    throw new Error('No teacher notes could be extracted from this PowerPoint file.');
  }

  return fullText.trim();
}
