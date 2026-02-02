
import React, { useState } from 'react';
import { Search, ClipboardList, Copy, Check, Trash2, AlertCircle, Play, FileText, List, AlertTriangle } from 'lucide-react';

interface ContentOutput {
  vocabulary: string[];
  sentences: string[];
  distractors: string[];
}

export const LLMContentChecker: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [output, setOutput] = useState<ContentOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCheck = () => {
    setError(null);
    setOutput(null);

    if (!inputText.trim()) return;

    try {
      const data = JSON.parse(inputText);
      const vocab: string[] = [];
      const sentences: string[] = [];
      const distractorsSet = new Set<string>();

      // 1. Process Vocabulary
      const rawVocab = data.vocabulary || [];
      rawVocab.forEach((item: any) => {
        if (item.type === "Word" && item.word) {
          vocab.push(item.word);
        }
      });

      // 2. Process Sentences
      const rawSentences = data.sentences || [];
      rawSentences.forEach((item: any) => {
        if (item.type === "Sentence" && item.sentence) {
          sentences.push(item.sentence);
        }
      });

      // 3. Process Distractors (Unique Error Sentences)
      const rawDistractors = data.distractors || [];
      rawDistractors.forEach((item: any) => {
        if (item.type === "Distractor" && item.sentence_with_error) {
          distractorsSet.add(item.sentence_with_error);
        }
      });

      setOutput({
        vocabulary: vocab,
        sentences: sentences,
        distractors: Array.from(distractorsSet)
      });
    } catch (e) {
      setError("Invalid JSON Format. Please check your source text.");
    }
  };

  const handleCopy = (section: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleClear = () => {
    setInputText('');
    setOutput(null);
    setError(null);
  };

  const OutputSection = ({ title, items, sectionId }: { title: string, items: string[], sectionId: string }) => {
    if (items.length === 0) return null;
    const contentString = items.join('\n');
    const isCopied = copiedSection === sectionId;

    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <List className="w-4 h-4" />
            {title} ({items.length})
          </h3>
          <button
            onClick={() => handleCopy(sectionId, contentString)}
            className={`p-2 rounded-lg transition-all ${
              isCopied 
                ? 'bg-green-500 text-white shadow-md' 
                : 'text-slate-400 hover:text-orange-500 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
            title="Copy to clipboard"
          >
            {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
          <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
            {contentString}
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in space-y-6">
      {/* Input Module */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <Search className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">LLM Content Checker</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Interpret and preview structured lesson JSON files.</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3">
              Paste Lesson JSON
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder='{ "vocabulary": [...], "sentences": [...] }'
              className="w-full h-64 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-inner focus:border-indigo-500 focus:ring-indigo-500 p-4 text-sm font-mono resize-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex justify-between items-center pt-2">
            <button 
              onClick={handleClear} 
              className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Input
            </button>
            <button
              onClick={handleCheck}
              disabled={!inputText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              Check Content
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 animate-shake">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm font-bold text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Results Module */}
      {output && (
        <div className="space-y-6 animate-fade-in-up">
          <OutputSection title="Vocabulary" items={output.vocabulary} sectionId="vocab" />
          <OutputSection title="Sentences" items={output.sentences} sectionId="sentences" />
          <OutputSection title="Distractors" items={output.distractors} sectionId="distractors" />

          {output.vocabulary.length === 0 && output.sentences.length === 0 && output.distractors.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-6 rounded-2xl text-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="text-amber-800 dark:text-amber-400 font-bold">No matching content found.</p>
              <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">Ensure your JSON keys match: "vocabulary", "sentences", or "distractors".</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
