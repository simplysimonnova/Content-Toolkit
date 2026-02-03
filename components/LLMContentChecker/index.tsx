
import React, { useState, useMemo } from 'react';
import {
  Search, Copy, Check, Trash2, AlertTriangle, List,
  BookOpen, Layers, Split, AlertCircle, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Settings, Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ToolSettingsModal } from '../ToolSettingsModal';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

// --- Interfaces ---

interface VocabularyItem {
  type: "Word";
  word: string;
  variant: "Primary" | "Extended";
  vocabulary_topic: string;
}

interface SentenceItem {
  type: "Sentence";
  sentence: string;
  variant: "Primary" | "Extended" | "Mix";
  vocabulary_topic: string;
  grammar_topic?: string;
}

interface DistractorItem {
  type: "Distractor";
  sentence_with_error: string;
  sentence_part_with_error: string;
  original_sentence: string;
  variant: "Primary" | "Extended" | "Mix";
  vocabulary_topic: string;
  grammar_topic?: string;
}

interface ContentOutput {
  vocabulary: VocabularyItem[];
  sentences: SentenceItem[];
  distractors: DistractorItem[];
  stats: {
    primaryWords: number;
    extendedWords: number;
    totalSentences: number;
    totalDistractors: number;
    uniqueTopics: Set<string>;
  };
}

// --- Helpers ---

const groupByTopic = <T extends { vocabulary_topic: string }>(items: T[]) => {
  const groups: Record<string, T[]> = {};
  items.forEach(item => {
    const topic = item.vocabulary_topic || 'Uncategorized';
    if (!groups[topic]) groups[topic] = [];
    groups[topic].push(item);
  });
  return groups;
};

// --- Components ---

const TopicGroup = ({ topic, items, renderItem }: { topic: string, items: any[], renderItem: (item: any) => React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{topic}</span>
          <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-400">
            {items.length}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="p-3 bg-white dark:bg-slate-900 grid gap-2">
          {items.map((item, idx) => (
            <div key={idx} className="animate-fade-in">
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const LLMContentChecker: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [output, setOutput] = useState<ContentOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'vocabulary' | 'sentences' | 'distractors'>('vocabulary');
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const { isAdmin } = useAuth();

  React.useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configurations', 'llm-content-checker'), (snap) => {
      if (snap.exists()) {
        setIsLocked(!!snap.data().isLocked);
      }
    });
    return unsub;
  }, []);

  const handleCheck = () => {
    setError(null);
    setOutput(null);

    if (!inputText.trim()) return;

    try {
      const data = JSON.parse(inputText);

      // Safety Checks and Filtering
      const vocab: VocabularyItem[] = (data.vocabulary || []).filter((i: any) => i.type === "Word");
      const sentences: SentenceItem[] = (data.sentences || []).filter((i: any) => i.type === "Sentence");
      const distractors: DistractorItem[] = (data.distractors || []).filter((i: any) => i.type === "Distractor");

      const stats = {
        primaryWords: vocab.filter(w => w.variant === 'Primary').length,
        extendedWords: vocab.filter(w => w.variant === 'Extended').length,
        totalSentences: sentences.length,
        totalDistractors: distractors.length,
        uniqueTopics: new Set([...vocab, ...sentences].map(i => i.vocabulary_topic).filter(Boolean))
      };

      setOutput({ vocabulary: vocab, sentences, distractors, stats });
    } catch (e) {
      setError("Invalid JSON Format. Please check your source text.");
    }
  };

  const handleClear = () => {
    setInputText('');
    setOutput(null);
    setError(null);
  };

  // --- Render Sections ---

  const renderTabs = () => (
    <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl mb-6 inline-flex">
      {[
        { id: 'vocabulary', label: 'Vocabulary', icon: BookOpen },
        { id: 'sentences', label: 'Sentences', icon: Layers },
        { id: 'distractors', label: 'Distractors', icon: Split },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as any)}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === tab.id
            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
        >
          <tab.icon className="w-4 h-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );

  const renderVocabulary = () => {
    if (!output || output.vocabulary.length === 0) return null;

    const primary = output.vocabulary.filter(v => v.variant === 'Primary');
    const extended = output.vocabulary.filter(v => v.variant === 'Extended');

    const primaryGroups = groupByTopic(primary);
    const extendedGroups = groupByTopic(extended);

    return (
      <div className="space-y-6">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-white">
          <BookOpen className="w-5 h-5 text-indigo-500" /> Vocabulary Analysis
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Primary Column */}
          <div className="bg-indigo-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-indigo-100 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-widest text-xs">Primary ({primary.length})</h4>
            </div>
            {Object.keys(primaryGroups).map(topic => (
              <TopicGroup
                key={topic}
                topic={topic}
                items={primaryGroups[topic]}
                renderItem={(item: VocabularyItem) => (
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                    {item.word}
                  </div>
                )}
              />
            ))}
          </div>

          {/* Extended Column */}
          <div className="bg-orange-50/50 dark:bg-slate-800/50 p-4 rounded-xl border border-orange-100 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-orange-900 dark:text-orange-200 uppercase tracking-widest text-xs">Extended ({extended.length})</h4>
            </div>
            {Object.keys(extendedGroups).map(topic => (
              <TopicGroup
                key={topic}
                topic={topic}
                items={extendedGroups[topic]}
                renderItem={(item: VocabularyItem) => (
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-3 py-2 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                    {item.word}
                  </div>
                )}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSentences = () => {
    if (!output || output.sentences.length === 0) return null;

    // Group by Variant for Sentences
    const primary = output.sentences.filter(s => s.variant === 'Primary');
    const others = output.sentences.filter(s => s.variant !== 'Primary');

    const renderList = (items: SentenceItem[]) => (
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
            <p className="text-slate-800 dark:text-slate-200 font-medium mb-2">{item.sentence}</p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-md font-bold uppercase tracking-wider">
                {item.vocabulary_topic}
              </span>
              {item.grammar_topic && (
                <span className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-md">
                  {item.grammar_topic}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );

    return (
      <div className="space-y-6 mt-8">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-white">
          <Layers className="w-5 h-5 text-indigo-500" /> Sentence Analysis
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-bold text-slate-500 uppercase tracking-widest text-xs mb-3 pl-1">Core Sentences ({primary.length})</h4>
            {renderList(primary)}
          </div>
          <div>
            <h4 className="font-bold text-slate-500 uppercase tracking-widest text-xs mb-3 pl-1">Mix / Extended ({others.length})</h4>
            {renderList(others)}
          </div>
        </div>
      </div>
    );
  };

  const renderDistractors = () => {
    if (!output || output.distractors.length === 0) return null;

    return (
      <div className="space-y-6 mt-8">
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-white">
          <Split className="w-5 h-5 text-red-500" /> Distractors & Errors
        </h3>

        <div className="grid grid-cols-1 gap-4">
          {output.distractors.map((item, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4">

              {/* Context Column */}
              <div className="md:w-1/4 space-y-2 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 pb-4 md:pb-0 md:pr-4">
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600">
                    {item.vocabulary_topic}
                  </span>
                  {item.variant && (
                    <span className={`text-xs font-bold px-2 py-1 rounded ${item.variant === 'Primary' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                      {item.variant}
                    </span>
                  )}
                </div>
                {item.grammar_topic && (
                  <p className="text-xs text-slate-400 font-mono">{item.grammar_topic}</p>
                )}
              </div>

              {/* Diff Column */}
              <div className="flex-1 space-y-3">
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-red-600 block mb-1 uppercase tracking-wider">Incorrect</span>
                    <p className="text-slate-700 dark:text-slate-300">
                      {item.sentence_with_error.split(item.sentence_part_with_error).map((part, i, arr) => (
                        <React.Fragment key={i}>
                          {part}
                          {i < arr.length - 1 && (
                            <span className="bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 font-bold px-1 rounded mx-0.5 underline decoration-red-400">
                              {item.sentence_part_with_error}
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-green-600 block mb-1 uppercase tracking-wider">Correct</span>
                    <p className="text-slate-700 dark:text-slate-300">{item.original_sentence}</p>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-8 pb-20">

      {/* Input Module */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 transition-colors">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Search className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              {isLocked && <Shield className="w-3.5 h-3.5 text-teal-500 absolute -top-1 -right-1 fill-white dark:fill-slate-800" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                LLM JSON Viewer
                {isLocked && <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded border border-teal-100 dark:border-teal-800">Stable</span>}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Visualize structured lesson data (Primary/Extended/Mix).</p>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-lg transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder='Paste JSON here...'
            className="w-full h-48 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white shadow-inner focus:border-indigo-500 focus:ring-indigo-500 p-4 text-xs font-mono resize-none transition-all placeholder:text-slate-400"
          />
          <div className="flex justify-end gap-3">
            <button onClick={handleClear} className="text-slate-400 hover:text-slate-600 text-sm font-medium px-4">Clear</button>
            <button
              onClick={handleCheck}
              disabled={!inputText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 active:scale-95"
            >
              Analyze JSON
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex items-center gap-3 animate-shake">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm font-bold text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Results Dashboard */}
      {output && (
        <div className="animate-fade-in-up space-y-8">

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{output.stats.primaryWords}</span>
              <span className="text-xs uppercase tracking-widest text-slate-500">Primary Words</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-orange-500">{output.stats.extendedWords}</span>
              <span className="text-xs uppercase tracking-widest text-slate-500">Extended Words</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-slate-700 dark:text-slate-200">{output.stats.uniqueTopics.size}</span>
              <span className="text-xs uppercase tracking-widest text-slate-500">Topics</span>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-red-500">{output.stats.totalDistractors}</span>
              <span className="text-xs uppercase tracking-widest text-slate-500">Distractors</span>
            </div>
          </div>

          {renderTabs()}

          {activeTab === 'vocabulary' && renderVocabulary()}
          {activeTab === 'sentences' && renderSentences()}
          {activeTab === 'distractors' && renderDistractors()}

        </div>
      )}
      <ToolSettingsModal
        toolId="llm-content-checker"
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        defaultPrompt={`// Core Parsing Logic Rules
// This tool does not generate content, but validates JSON structure.

Required Keys:
- vocabulary: Array of { type: "Word", word: string, variant: "Primary"|"Extended", vocabulary_topic: string }
- sentences: Array of { type: "Sentence", sentence: string, variant: "Primary"|"Extended"|"Mix", ... }
- distractors: Array of { type: "Distractor", sentence_with_error: string, ... }

Display Rules:
1. Vocabulary is split into Primary vs Extended columns.
2. Sentences are grouped by Variant (Core vs Mix).
3. Distractors show a "Diff View" highlighting errors.`}
      />
    </div>
  );
};
