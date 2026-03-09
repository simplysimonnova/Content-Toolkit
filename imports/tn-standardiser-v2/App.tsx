
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './components/Button';
import { fixTeacherNotes, TNResult } from './services/geminiService';
import { DEFAULT_SYSTEM_INSTRUCTION } from './constants';
import { jsPDF } from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

const App: React.FC = () => {
  const [originalTNs, setOriginalTNs] = useState<string>('');
  const [result, setResult] = useState<TNResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [parsingFile, setParsingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_INSTRUCTION);
  const [isFullLesson, setIsFullLesson] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('novakid_tn_prompt');
    if (saved) setSystemPrompt(saved);
  }, []);

  const handleFix = async (currentPrompt?: string) => {
    const activePrompt = currentPrompt || systemPrompt;
    if (!originalTNs.trim()) {
      setError("Please paste some teacher notes or upload a file to fix.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);
    
    try {
      if (isFullLesson && (originalTNs.includes('### SLIDE') || originalTNs.includes('Slide '))) {
        // Split into slides - handle "### SLIDE X ###" or "Slide X:" or "Slide X"
        const slides = originalTNs.split(/(?=### SLIDE \d+ ###|Slide \d+:|Slide \d+)/gi).filter(s => s.trim());
        setProgress({ current: 0, total: slides.length });

        const slidePromises = slides.map(async (slideText, slideIdx) => {
          // Extract slide header and ID to ensure consistency
          const headerMatch = slideText.match(/^(### SLIDE \d+ ###|Slide \d+:|Slide \d+)/i);
          const originalHeader = headerMatch ? headerMatch[0] : `### SLIDE ${slideIdx + 1} ###`;
          const slideNum = originalHeader.replace(/###|SLIDE|Slide|:|#/gi, '').trim() || (slideIdx + 1).toString();
          const slideId = slideNum;

          try {
            const res = await fixTeacherNotes(slideText, activePrompt);
            
            // The AI is now instructed to output the header itself in the requested format.
            // But to be 100% sure and maintain control, we will format it here.
            let fixedNotes = res.fixedNotes.trim();
            
            // Strip any slide headers the AI might have included to avoid duplication
            fixedNotes = fixedNotes.replace(/^(### SLIDE \d+ ###|Slide \d+:|Slide \d+)\s*/i, '');
            fixedNotes = fixedNotes.replace(/^Teacher Notes:\s*/i, '');
            
            // Format according to user request:
            // Slide [original slide number]
            // Teacher Notes:
            // [final teacher notes]
            const finalNotes = `Slide ${slideNum}\nTeacher Notes:\n${fixedNotes}`;

            setProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
            return { index: slideIdx, slideId, res: { ...res, fixedNotes: finalNotes } };
          } catch (firstErr) {
            console.warn(`Retrying slide ${slideId} due to error:`, firstErr);
            try {
              const res = await fixTeacherNotes(slideText, activePrompt);
              let fixedNotes = res.fixedNotes.trim().replace(/^(### SLIDE \d+ ###|Slide \d+:|Slide \d+)\s*/i, '');
              fixedNotes = fixedNotes.replace(/^Teacher Notes:\s*/i, '');
              const finalNotes = `Slide ${slideNum}\nTeacher Notes:\n${fixedNotes}`;
              
              setProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
              return { index: slideIdx, slideId, res: { ...res, fixedNotes: finalNotes } };
            } catch (secondErr) {
              console.error(`Slide ${slideId} failed after retry:`, secondErr);
              setProgress(prev => prev ? { ...prev, current: prev.current + 1 } : null);
              // Fallback to original notes without error message as per user request
              const fallbackNotes = slideText.replace(/^(### SLIDE \d+ ###|Slide \d+:|Slide \d+)\s*/i, '').trim();
              return { 
                index: slideIdx, 
                slideId,
                res: { 
                  fixedNotes: `Slide ${slideNum}\nTeacher Notes:\n${fallbackNotes}`, 
                  fixLog: `Slide ${slideId} failed to process. Original notes preserved.` 
                } 
              };
            }
          }
        });

        const allResults = await Promise.all(slidePromises);
        // Sort results by index to maintain original order
        const finalSortedResults = allResults.sort((a, b) => a.index - b.index);

        // Combine results
        const combinedNotes = finalSortedResults.map(item => item.res.fixedNotes).join('\n\n');
        const combinedLog = finalSortedResults.map(item => `Slide ${item.slideId}: ${item.res.fixLog}`).join('\n');
        
        setResult({
          fixedNotes: combinedNotes,
          fixLog: combinedLog
        });
      } else {
        // Single slide or non-standard format
        const outcome = await fixTeacherNotes(originalTNs, activePrompt);
        setResult(outcome);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const extractTextFromPdf = async (file: File) => {
    setParsingFile(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      for (let i = 2; i <= pdf.numPages; i += 2) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        // Strip navigation codes {{ ... }}
        const cleanedText = pageText.replace(/\{\{[\s\S]*?\}\}/g, '').trim();
        
        if (cleanedText) {
          fullText += `### SLIDE ${i} ###\n${cleanedText}\n\n`;
        }
      }

      setOriginalTNs(fullText.trim());
      setIsFullLesson(true);
    } catch (err) {
      console.error("PDF Parsing Error:", err);
      setError("Failed to parse PDF. Please try again or paste text manually.");
    } finally {
      setParsingFile(false);
    }
  };

  const extractTextFromPptx = async (file: File) => {
    setParsingFile(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Get all slide files to determine the total number of slides
      const slideFiles = Object.keys(zip.files).filter(name => 
        name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
      );
      
      if (slideFiles.length === 0) {
        throw new Error("No slides found in the PowerPoint file.");
      }

      const parser = new DOMParser();

      // In PPTX, slide filenames don't always match their logical order.
      // We need to read ppt/presentation.xml to get the correct order of slides.
      const presentationContent = await zip.file('ppt/presentation.xml')!.async("string");
      const presentationXml = parser.parseFromString(presentationContent, "text/xml");
      const sldIdList = presentationXml.getElementsByTagName("p:sldId");
      
      const slideOrder: { id: string; rId: string }[] = [];
      for (let i = 0; i < sldIdList.length; i++) {
        slideOrder.push({
          id: sldIdList[i].getAttribute('id') || '',
          rId: sldIdList[i].getAttribute('r:id') || ''
        });
      }

      // Read ppt/_rels/presentation.xml.rels to map rId to filename
      const relsContent = await zip.file('ppt/_rels/presentation.xml.rels')!.async("string");
      const relsXml = parser.parseFromString(relsContent, "text/xml");
      const relationships = relsXml.getElementsByTagName("Relationship");
      
      const rIdToPath: Record<string, string> = {};
      for (let i = 0; i < relationships.length; i++) {
        const rId = relationships[i].getAttribute('Id') || '';
        const target = relationships[i].getAttribute('Target') || '';
        rIdToPath[rId] = target.startsWith('slides/') ? `ppt/${target}` : `ppt/slides/${target}`;
      }

      const orderedSlidePaths = slideOrder.map(s => rIdToPath[s.rId]).filter(Boolean);

      let fullText = "";
      let logicalSlideNum = 1;

      for (const slidePath of orderedSlidePaths) {
        const slideFileName = slidePath.split('/').pop() || '';
        const slideNumMatch = slideFileName.match(/slide(\d+)\.xml/);
        const internalSlideNum = slideNumMatch ? slideNumMatch[1] : logicalSlideNum.toString();
        
        let extractedNotes = "";

        // To find the notes for this slide, we need to check the slide's own relationships
        const slideRelsPath = `ppt/slides/_rels/${slideFileName}.rels`;
        if (zip.file(slideRelsPath)) {
          const slideRelsContent = await zip.file(slideRelsPath)!.async("string");
          const slideRelsXml = parser.parseFromString(slideRelsContent, "text/xml");
          const slideRels = slideRelsXml.getElementsByTagName("Relationship");
          
          for (let j = 0; j < slideRels.length; j++) {
            const type = slideRels[j].getAttribute('Type') || '';
            if (type.includes('notesSlide')) {
              const target = slideRels[j].getAttribute('Target') || '';
              const notesPath = target.startsWith('../') ? `ppt/${target.substring(3)}` : `ppt/notesSlides/${target}`;
              
              if (zip.file(notesPath)) {
                const notesContent = await zip.file(notesPath)!.async("string");
                const notesXml = parser.parseFromString(notesContent, "text/xml");
                
                // Target shapes with placeholder type="body" which contains the actual notes
                const shapes = notesXml.getElementsByTagName("p:sp");
                let notesFoundInBody = false;
                
                let slideNotes = "";
                for (let k = 0; k < shapes.length; k++) {
                  const ph = shapes[k].getElementsByTagName("p:ph")[0];
                  // If it's a body placeholder, it's definitely the notes
                  if (ph && ph.getAttribute('type') === 'body') {
                    const textNodes = shapes[k].getElementsByTagName("a:t");
                    for (let l = 0; l < textNodes.length; l++) {
                      slideNotes += textNodes[l].textContent + " ";
                    }
                    notesFoundInBody = true;
                  }
                }
                
                // Fallback: if no body placeholder, get all text but filter out slide numbers
                if (!notesFoundInBody) {
                  const textNodes = notesXml.getElementsByTagName("a:t");
                  for (let k = 0; k < textNodes.length; k++) {
                    const txt = textNodes[k].textContent || "";
                    // Ignore strings that are just numbers (likely slide numbers)
                    if (!/^\d+$/.test(txt.trim())) {
                      slideNotes += txt + " ";
                    }
                  }
                }

                // Strip navigation codes {{ ... }}
                extractedNotes = slideNotes.replace(/\{\{[\s\S]*?\}\}/g, '').trim();
              }
              break;
            }
          }
        }

        if (extractedNotes.trim()) {
          fullText += `### SLIDE ${logicalSlideNum} ###\n${extractedNotes.trim()}\n\n`;
        } else {
          fullText += `### SLIDE ${logicalSlideNum} ###\n[No Teacher Notes found for this slide]\n\n`;
        }
        logicalSlideNum++;
      }

      setOriginalTNs(fullText.trim());
      setIsFullLesson(true);
    } catch (err) {
      console.error("PPTX Parsing Error:", err);
      setError("Failed to parse PowerPoint. Please ensure it is a valid .pptx file with Teacher Notes.");
    } finally {
      setParsingFile(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.name.split('.').pop()?.toLowerCase();
    
    if (fileType === 'pdf') {
      extractTextFromPdf(file);
    } else if (fileType === 'pptx') {
      extractTextFromPptx(file);
    } else {
      setError("Unsupported file format. Please upload a .pdf or .pptx file.");
    }
  };

  const savePrompt = () => {
    localStorage.setItem('novakid_tn_prompt', systemPrompt);
    setShowPromptModal(false);
    if (originalTNs.trim()) {
      handleFix(systemPrompt);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.fixedNotes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Novakid Teacher Notes", 10, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 10, 28);
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    const splitNotes = doc.splitTextToSize(result.fixedNotes, 180);
    doc.text(splitNotes, 10, 40);

    const logY = 40 + (splitNotes.length * 7) + 10;
    if (logY < 270) {
      doc.setFontSize(14);
      doc.text("Fix Log", 10, logY);
      doc.setFontSize(10);
      doc.setTextColor(100);
      const splitLog = doc.splitTextToSize(result.fixLog, 180);
      doc.text(splitLog, 10, logY + 8);
    }

    doc.save("novakid-teacher-notes.pdf");
  };

  const renderFixedNotes = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmedLine = line.trim();
      const isSlideHeader = /^Slide \d+$/i.test(trimmedLine);
      const isTNHeader = /^Teacher Notes:$/i.test(trimmedLine);
      
      if (isSlideHeader) {
        return (
          <div key={i} className="mt-8 mb-2 first:mt-0">
            <h3 className="text-purple-700 font-black text-sm uppercase tracking-widest border-b-2 border-purple-100 pb-1 flex items-center gap-3">
              <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] tracking-normal">SLIDE</span>
              {trimmedLine.replace(/Slide/gi, '').trim()}
            </h3>
          </div>
        );
      }
      if (isTNHeader) {
        return <p key={i} className="text-xs font-bold text-slate-400 uppercase tracking-tighter mb-2">{line}</p>;
      }
      return <p key={i} className="mb-1">{line}</p>;
    });
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm no-print">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#6B46C1] rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-purple-100">
              N
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">TN Fixer Bot</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="py-1.5 px-4 text-xs h-9" onClick={() => setShowPromptModal(true)}>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              Prompt
            </Button>
            <Button variant="outline" className="py-1.5 px-4 text-xs h-9" onClick={() => { setOriginalTNs(''); setResult(null); setError(null); }}>Clear</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6 no-print">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 flex gap-4">
               <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-xs font-bold text-slate-400 group-hover:text-purple-600 transition-colors uppercase">fix TNs / extract TNs</span>
                <div 
                  onClick={() => setIsFullLesson(!isFullLesson)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${isFullLesson ? 'bg-purple-600' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${isFullLesson ? 'translate-x-5' : ''}`}></div>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-purple-600 rounded-full"></span>
                Input Content
              </h2>
            </div>
            
            <div className="space-y-4">
              {isFullLesson && (
                <div 
                  className="file-drop-zone border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer mb-4"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".pdf,.pptx"
                    onChange={handleFileChange}
                  />
                  {parsingFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm font-bold text-purple-600">Reading File...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-600">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                      </div>
                      <p className="text-sm font-bold text-slate-700">Upload PDF or PowerPoint</p>
                      <p className="text-xs text-slate-400 mt-1">Automatic slide-by-slide extraction</p>
                      <p className="text-[10px] text-slate-300 mt-2 italic">Note: PPTX reads ONLY Teacher Notes. PDF reads every 2nd page.</p>
                    </>
                  )}
                </div>
              )}

              <p className="text-sm text-slate-500 leading-relaxed">
                {isFullLesson ? "Review extracted notes or paste multiple slide notes below." : "Paste single slide notes or description below."}
              </p>
              
              <div className="relative">
                <textarea 
                  value={originalTNs}
                  onChange={(e) => setOriginalTNs(e.target.value)}
                  rows={isFullLesson ? 20 : 15}
                  placeholder={isFullLesson ? "Slide 1: ...\nSlide 2: ..." : "Paste raw teacher notes here..."}
                  className="w-full px-5 py-4 rounded-xl border border-slate-200 focus:ring-4 focus:ring-purple-100 focus:border-purple-600 outline-none transition-all font-sans text-sm leading-relaxed bg-white text-slate-900 shadow-inner"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-medium flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                  {error}
                </div>
              )}

              {progress && (
                <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
                  <div 
                    className="bg-purple-600 h-full transition-all duration-500 ease-out"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  ></div>
                </div>
              )}

              {!isFullLesson && (
                <Button 
                  onClick={() => handleFix()} 
                  className="w-full h-14 text-lg shadow-purple-200 shadow-xl bg-[#6B46C1] hover:bg-[#553c9a]" 
                  isLoading={loading}
                >
                  {progress ? `Processing ${progress.current} / ${progress.total}` : "Fix Teacher Notes"}
                </Button>
              )}
            </div>
          </section>

          <section className="bg-purple-50 p-5 rounded-2xl border border-purple-100">
            <h3 className="text-xs font-bold text-purple-800 mb-4 uppercase tracking-widest font-bold">Novakid TN Standards</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                "ABC: Accurate, Brief, Clear",
                "T. and S. Abbreviations Only",
                "No Scripts / Quotes",
                "Action-Oriented Phrasing",
                "Numbered Lists Only",
                "Extension Handling"
              ].map((rule, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-purple-900/70 font-semibold">
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-purple-600 shadow-sm">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path></svg>
                  </div>
                  {rule}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col h-full min-h-[600px] gap-6">
          <section className="bg-white rounded-2xl shadow-xl border border-slate-200 flex-grow flex flex-col overflow-hidden">
            <div className="bg-slate-50 border-b p-5 flex items-center justify-between no-print">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-purple-600 rounded-full"></span>
                Standardized Result
              </h2>
              {result && (
                <div className="flex gap-2">
                  <button 
                    onClick={downloadPDF}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-sm"
                    title="Download PDF"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </button>
                  <button 
                    onClick={handleCopy}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
                      copied ? 'bg-green-500 text-white' : 'bg-[#6B46C1] hover:bg-[#553c9a] text-white shadow-purple-100 shadow-md'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy TNs'}
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex-grow p-8 flex flex-col relative bg-white overflow-y-auto max-h-[70vh]">
              {result ? (
                <div className="prose max-w-none font-medium text-slate-800 leading-relaxed text-lg animate-in fade-in duration-500">
                  {renderFixedNotes(result.fixedNotes)}
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-slate-400 text-center px-8">
                  {loading ? (
                    <div className="space-y-6 flex flex-col items-center">
                      <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-4 border-purple-50 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                      <p className="font-bold text-slate-600 text-lg">Standardizing Notes...</p>
                      <p className="text-xs text-slate-400">Processing slide sequence & rules</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-purple-50 rounded-3xl flex items-center justify-center mb-6 text-purple-200">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                      </div>
                      <p className="max-w-[320px] font-medium leading-relaxed">Corrected Teacher Notes will be formatted to meet ABC standards and phrasing rules.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {result && (
            <section className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl animate-in slide-in-from-bottom-4 duration-500 no-print">
              <h3 className="text-purple-400 font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                Fix Log (What & Why)
              </h3>
              <div className="text-slate-300 text-sm leading-relaxed font-medium whitespace-pre-wrap opacity-90">
                {result.fixLog}
              </div>
            </section>
          )}
        </div>
      </main>

      {showPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
            <div className="p-6 border-b flex items-center justify-between bg-white">
              <h2 className="text-xl font-bold text-slate-800">System Prompt Configuration</h2>
              <button onClick={() => setShowPromptModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-grow overflow-y-auto p-6 bg-white">
              <p className="text-sm text-slate-500 mb-4 font-medium italic">Adjust the core rules the AI uses to process notes. This is saved locally.</p>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <textarea 
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  style={{ backgroundColor: 'white', color: '#1e293b' }}
                  className="w-full h-96 p-5 font-sans text-sm leading-relaxed outline-none resize-none border-none focus:ring-0"
                  spellCheck={false}
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3 bg-white">
              <Button variant="outline" className="h-10 text-xs px-4 border-slate-200 hover:border-purple-600" onClick={() => { setSystemPrompt(DEFAULT_SYSTEM_INSTRUCTION); }}>Reset to Default</Button>
              <Button onClick={savePrompt} className="bg-[#6B46C1] hover:bg-[#553c9a] text-white h-10 text-sm px-6">Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-12 py-8 border-t border-slate-200 no-print">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 text-xs font-semibold uppercase tracking-widest">
           <p>© 2024 Novakid Curriculum Tech</p>
           <div className="flex gap-6">
             <a href="#" className="hover:text-purple-600 transition-colors">Documentation</a>
             <a href="#" className="hover:text-purple-600 transition-colors">ABC Guidelines</a>
             <a href="#" className="hover:text-purple-600 transition-colors">Support</a>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
