
/** @stability LOCKED - DO NOT MODIFY CODE WITHOUT EXPLICIT USER INSTRUCTION */

import React, { useState, useEffect } from 'react';
import { LessonForm } from '../LessonForm';
import { ResultDisplay } from '../ResultDisplay';
import { LessonInfo } from '../../types';
import { generateLessonContent } from './ai';
import { Sparkles, PenTool, Settings, Shield } from 'lucide-react';
import { ToolSettingsModal } from '../ToolSettingsModal';
import { SYSTEM_INSTRUCTION } from '../../constants';
import { useAuth } from '../../context/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';

export const LessonTools: React.FC = () => {
  const { isAdmin } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const [results, setResults] = useState<{ content: string | null, description: string | null }>({
    content: null,
    description: null
  });

  const [errors, setErrors] = useState<{ content: string | null, description: string | null }>({
    content: null,
    description: null
  });

  const [lessonInfo, setLessonInfo] = useState<LessonInfo>({
    age: '10+',
    lessonDetails: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configurations', 'lesson-descriptions'), (snap) => {
      if (snap.exists()) {
        setIsLocked(!!snap.data().isLocked);
      }
    });
    return unsub;
  }, []);

  const handleSubmit = async () => {
    if (!lessonInfo.lessonDetails.trim()) {
      alert("Please provide the lesson details.");
      return;
    }

    setIsGenerating(true);
    setHasGenerated(true);
    setErrors({ content: null, description: null });
    setResults({ content: null, description: null });

    try {
      const [contentPromise, descPromise] = await Promise.allSettled([
        generateLessonContent(lessonInfo, 'content'),
        generateLessonContent(lessonInfo, 'description')
      ]);

      setResults({
        content: contentPromise.status === 'fulfilled' ? contentPromise.value : null,
        description: descPromise.status === 'fulfilled' ? descPromise.value : null
      });

      setErrors({
        content: contentPromise.status === 'rejected' ? contentPromise.reason.message : null,
        description: descPromise.status === 'rejected' ? descPromise.reason.message : null
      });

    } catch (err: any) {
      setErrors({ content: "Global error", description: "Global error" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-4 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-500/20">
              <PenTool className="w-8 h-8 text-white" />
            </div>
            {isLocked && <Shield className="w-3.5 h-3.5 text-teal-500 absolute -top-1 -right-1 fill-white dark:fill-slate-900" />}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              Lesson Descriptions
              {isLocked && <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 dark:bg-teal-900/20 px-2 py-0.5 rounded border border-teal-100 dark:border-teal-800">Stable</span>}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Generate engaging front-facing blurbs and technical LLM descriptions.</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowSettings(true)} className="p-2.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-all">
            <Settings className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
        <div className="flex flex-col h-full">
          <LessonForm
            info={lessonInfo}
            onChange={setLessonInfo}
            onSubmit={handleSubmit}
            isGenerating={isGenerating}
          />
        </div>

        <div className="flex flex-col h-full min-h-[500px]">
          {!hasGenerated ? (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 transition-colors">
              <div className="p-4 rounded-full bg-slate-50 dark:bg-slate-800 mb-4">
                <Sparkles className="w-12 h-12 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Ready to Generate</p>
              <p className="text-sm max-w-xs mt-2">Fill in the lesson details and click generate to create both the Content Field and Description Field.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 h-full">
              <div className="flex-1">
                <ResultDisplay
                  mode="content"
                  result={results.content}
                  error={errors.content}
                  isLoading={isGenerating}
                />
              </div>
              <div className="flex-1">
                <ResultDisplay
                  mode="description"
                  result={results.description}
                  error={errors.description}
                  isLoading={isGenerating}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <ToolSettingsModal
        toolId="lesson-descriptions"
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        defaultPrompt={SYSTEM_INSTRUCTION}
      />
    </div>
  );
};
