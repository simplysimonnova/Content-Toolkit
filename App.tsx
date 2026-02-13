
import React, { useState, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import { AppPage } from './types';
import { FeedbackButton } from './components/FeedbackButton';
import { FeedbackModal } from './components/FeedbackModal';
import { LoginForm } from './components/LoginForm';
import { useAuth } from './context/AuthContext';
import { ExternalLink, Palette, Sparkles, Construction, ShieldCheck } from 'lucide-react';

// Lazy Load Components
const Dashboard = React.lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const LessonTools = React.lazy(() => import('./components/LessonTools').then(m => ({ default: m.LessonTools })));
const TAFGenerator = React.lazy(() => import('./components/TAFGenerator').then(m => ({ default: m.TAFGenerator })));
const WordListProcessor = React.lazy(() => import('./components/WordListProcessor').then(m => ({ default: m.WordListProcessor })));
const TopicAssigner = React.lazy(() => import('./components/TopicAssigner').then(m => ({ default: m.TopicAssigner })));
const ListMerger = React.lazy(() => import('./components/ListMerger').then(m => ({ default: m.ListMerger })));
const LLMContentChecker = React.lazy(() => import('./components/LLMContentChecker').then(m => ({ default: m.LLMContentChecker })));
const SpreadsheetDeduplicator = React.lazy(() => import('./components/SpreadsheetDeduplicator').then(m => ({ default: m.SpreadsheetDeduplicator })));
const ImageUrlExtractor = React.lazy(() => import('./components/ImageUrlExtractor').then(m => ({ default: m.ImageUrlExtractor })));
const PromptRewriter = React.lazy(() => import('./components/PromptRewriter').then(m => ({ default: m.PromptRewriter })));
const PromptWriter = React.lazy(() => import('./components/PromptWriter').then(m => ({ default: m.PromptWriter })));
const SoundGenerator = React.lazy(() => import('./components/SoundGenerator').then(m => ({ default: m.SoundGenerator })));
const UsefulLinks = React.lazy(() => import('./components/UsefulLinks').then(m => ({ default: m.UsefulLinks })));
const InternalNotes = React.lazy(() => import('./components/InternalNotes').then(m => ({ default: m.InternalNotes })));
const DirectusGuides = React.lazy(() => import('./components/DirectusGuides').then(m => ({ default: m.DirectusGuides })));
const SubscriptionTracker = React.lazy(() => import('./components/SubscriptionTracker').then(m => ({ default: m.SubscriptionTracker })));
const GeneralProofingBot = React.lazy(() => import('./components/GeneralProofingBot').then(m => ({ default: m.GeneralProofingBot })));
const ImageRenamer = React.lazy(() => import('./components/ImageRenamer').then(m => ({ default: m.ImageRenamer })));
const VRValidator = React.lazy(() => import('./components/VRValidator').then(m => ({ default: m.VRValidator })));
const ClassIdFinder = React.lazy(() => import('./components/ClassIdFinder').then(m => ({ default: m.ClassIdFinder })));
const CompImportCreator = React.lazy(() => import('./components/CompImportCreator/CompImportCreator').then(m => ({ default: m.CompImportCreator })));
const CompetencyCsvNormaliser = React.lazy(() => import('./components/CompetencyCsvNormaliser/CompetencyCsvNormaliser').then(m => ({ default: m.CompetencyCsvNormaliser })));
const PlaceholderPage = React.lazy(() => import('./components/PlaceholderPage').then(m => ({ default: m.PlaceholderPage })));

const App: React.FC = () => {
  const { user, isAdmin, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<AppPage>('dashboard');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'lesson-descriptions':
        return <LessonTools />;
      case 'taf-generator':
        return <TAFGenerator />;
      case 'word-cleaner':
        return <WordListProcessor />;
      case 'topic-assigner':
        return <TopicAssigner />;
      case 'list-merger':
        return <ListMerger />;
      case 'llm-content-checker':
        return <LLMContentChecker />;
      case 'deduplicator':
        return <SpreadsheetDeduplicator />;
      case 'image-extractor':
        return <ImageUrlExtractor />;
      case 'prompt-writer':
        return <PromptWriter />;
      case 'prompt-rewriter':
        return <PromptRewriter />;
      case 'sound-generator':
        return <SoundGenerator />;
      case 'image-renamer':
        return <ImageRenamer />;
      case 'useful-links':
        return <UsefulLinks />;
      case 'internal-notes':
        return <InternalNotes />;
      case 'directus-guides':
        return <DirectusGuides />;
      case 'subscription-tracker':
        return isAdmin ? <SubscriptionTracker /> : <Dashboard onNavigate={setCurrentPage} />;
      case 'vr-validator':
        return <VRValidator />;
      case 'class-id-finder':
        return <ClassIdFinder />;
      case 'comp-import-creator':
        return <CompImportCreator />;
      case 'competency-csv-normaliser':
        return <CompetencyCsvNormaliser />;

      // Curriculum & Planning
      case 'ss-compactor':
        return <PlaceholderPage title="S&S Compactor" />;
      case 'gap-spotter':
        return <PlaceholderPage title="Curriculum Gap Spotter" />;

      // Lesson Creation
      case 'plan-generator':
        return <PlaceholderPage title="Lesson Plan Generator" />;
      case 'slide-creator':
        return <PlaceholderPage title="Slide-creator Studio" />;

      // Editorial
      case 'improvement-suggestor':
        return <PlaceholderPage title="Improvement Suggestor" />;

      // Media
      case 'nano-banana':
        return (
          <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-orange-200 dark:border-slate-700 transition-colors animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400"></div>

            <div className="relative mb-8">
              <div className="absolute -inset-4 bg-yellow-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
              <div className="relative p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-full text-yellow-600 dark:text-yellow-500">
                <Palette className="w-16 h-16" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-orange-400 animate-bounce" />
            </div>

            <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              Nano Banana Studio
            </h2>

            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-8 font-bold px-4 py-2 bg-orange-50 dark:bg-orange-900/30 rounded-full border border-orange-100 dark:border-orange-800">
              <Construction className="w-5 h-5" />
              <span className="text-sm uppercase tracking-widest">Under Construction</span>
            </div>

            <div className="max-w-xl text-center space-y-6">
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Our tech team is currently building the integrated version of Nano Banana Studio into the toolkit.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                In the meantime, you can use the standalone version to generate consistent lesson characters and assets.
              </p>

              <div className="pt-6">
                <a
                  href="https://nano-banana-pro-studio-v2-1078831814874.us-west1.run.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-[#0a0f1d] font-black rounded-2xl shadow-xl shadow-yellow-500/20 transition-all transform hover:-translate-y-1 active:scale-95 group"
                >
                  <ExternalLink className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                  OPEN PROTOTYPE STUDIO
                </a>
              </div>
            </div>
          </div>
        );
      case 'tts-generator':
        return <PlaceholderPage title="TTS Generator" />;

      // Proofing
      case 'proofing-bot':
        return <GeneralProofingBot />;

      case 'lesson-proofing-bot':
        return (
          <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-indigo-200 dark:border-slate-700 transition-colors animate-fade-in relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-400 via-purple-500 to-indigo-400"></div>

            <div className="relative mb-8">
              <div className="absolute -inset-4 bg-indigo-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
              <div className="relative p-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-full text-indigo-600 dark:text-indigo-500">
                <ShieldCheck className="w-16 h-16" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-indigo-400 animate-bounce" />
            </div>

            <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tight flex items-center gap-3">
              Lesson Proofing Bot
            </h2>

            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-8 font-bold px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full border border-indigo-100 dark:border-indigo-800">
              <Construction className="w-5 h-5" />
              <span className="text-sm uppercase tracking-widest">In Development</span>
            </div>

            <div className="max-w-xl text-center space-y-6">
              <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                Our tech team is currently building the advanced Lesson Proofing agent into the toolkit.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                In the meantime, please click the button for a direct link to the working prototype on Vercel.
              </p>

              <div className="pt-6">
                <a
                  href="https://proofing-agent-v5.vercel.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/20 transition-all transform hover:-translate-y-1 active:scale-95 group"
                >
                  <ExternalLink className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                  OPEN PROOFING PROTOTYPE
                </a>
              </div>
            </div>
          </div>
        );

      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 flex">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      <main
        className={`flex-1 transition-all duration-300 py-8 px-4 sm:px-6 lg:px-8 ${isSidebarCollapsed ? 'ml-20' : 'ml-64'
          }`}
      >
        <div className="max-w-7xl mx-auto">
          {!isAdmin && currentPage === 'subscription-tracker' && (
            <div className="mb-8 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-6 rounded-2xl text-center">
              <h2 className="text-xl font-bold text-amber-800 dark:text-amber-400 mb-2">Access Restricted</h2>
              <p className="text-slate-600 dark:text-slate-400">This feature is only available for administrators.</p>
            </div>
          )}
          <div className="animate-fade-in">
            <Suspense fallback={
              <div className="min-h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-orange-500 rounded-full animate-spin"></div>
                  <p className="text-slate-400 text-sm font-medium animate-pulse">Loading tool...</p>
                </div>
              </div>
            }>
              {renderContent()}
            </Suspense>
          </div>
        </div>
      </main>

      <FeedbackButton onClick={() => setShowFeedback(true)} />
      <FeedbackModal isOpen={showFeedback} onClose={() => setShowFeedback(false)} />
    </div>
  );
};

export default App;
