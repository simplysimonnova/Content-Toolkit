import React from 'react';
import { Info, BookOpen, FileText, Tag, Link2, StickyNote, Presentation, ClipboardCheck, ShieldCheck, TableProperties, ListFilter, ShieldBan, Volume2, Wand2, PenLine, Hash, Ticket, Map, Braces, Search, Palette, BarChart2 } from 'lucide-react';
import { PageHeader } from './ui/PageHeader';
import { IconBadge } from './ui/IconBadge';

interface ToolEntry {
  id: string;
  icon: React.ReactElement;
  tool: string;
  what: string;
  input: string;
  output: string;
  notes?: string;
}

const TOOLS: ToolEntry[] = [
  {
    id: 'tn-standardiser',
    icon: <BookOpen className="w-5 h-5 text-indigo-500" />,
    tool: 'TN Standardiser',
    what: 'Cleans up and standardises teacher notes before review or export. Removes messy formatting and improves consistency.',
    input: 'Raw teacher notes — pasted text, PDF, PPTX, or Slides.com ZIP.',
    output: 'Standardised teacher notes formatted to Novakid ABC conventions.',
    notes: 'Review the cleaned output before using it. Does not modify the source file.',
  },
  {
    id: 'lesson-descriptions',
    icon: <FileText className="w-5 h-5 text-indigo-500" />,
    tool: 'Lesson Descriptions',
    what: 'Generates structured lesson descriptions from raw lesson content.',
    input: 'Lesson details and age group.',
    output: 'Formatted lesson description text.',
  },
  {
    id: 'taf-generator',
    icon: <TableProperties className="w-5 h-5 text-indigo-500" />,
    tool: 'TAF Generator',
    what: 'Generates Teacher Action Frames from lesson content.',
    input: 'Lesson content or slide notes.',
    output: 'Structured TAF entries.',
  },
  {
    id: 'word-cleaner',
    icon: <ListFilter className="w-5 h-5 text-indigo-500" />,
    tool: 'Word Cleaner',
    what: 'Cleans and normalises word lists — removes duplicates, fixes casing, and strips unwanted characters.',
    input: 'Raw word list (CSV or pasted text).',
    output: 'Cleaned, deduplicated word list.',
  },
  {
    id: 'topic-assigner',
    icon: <Tag className="w-5 h-5 text-indigo-500" />,
    tool: 'Topic Assigner',
    what: 'Assigns topic tags to lesson content using AI.',
    input: 'Lesson text or description.',
    output: 'Topic tags for each item.',
  },
  {
    id: 'list-merger',
    icon: <ListFilter className="w-5 h-5 text-indigo-500" />,
    tool: 'List Merger',
    what: 'Merges two lists and resolves duplicates.',
    input: 'Two CSV or text lists.',
    output: 'Single merged, deduplicated list.',
  },
  {
    id: 'deduplicator',
    icon: <ShieldBan className="w-5 h-5 text-indigo-500" />,
    tool: 'Deduplicator',
    what: 'Removes duplicate rows from spreadsheet data with semantic matching.',
    input: 'CSV or spreadsheet file.',
    output: 'Deduplicated CSV file.',
    notes: 'Uses strict semantic matching — ignores casing and punctuation.',
  },
  {
    id: 'thematic-qa',
    icon: <ShieldCheck className="w-5 h-5 text-indigo-500" />,
    tool: 'Thematic QA',
    what: 'Runs an AI-powered quality review of lesson content against thematic standards.',
    input: 'Lesson PDF.',
    output: 'Scored QA report with flags and recommendations.',
  },
  {
    id: 'ai-qa-runner',
    icon: <ShieldCheck className="w-5 h-5 text-indigo-500" />,
    tool: 'Lesson QA',
    what: 'Runs a full AI-powered QA review on a lesson PDF.',
    input: 'Lesson PDF. Select QA mode (Full Lesson, Slide Structure, Speaker Notes, or Grammar).',
    output: 'Detailed QA report saved to Firestore.',
    notes: 'Pre-checks run before AI review. Results are stored in qa_runs.',
  },
  {
    id: 'proofing-bot',
    icon: <ClipboardCheck className="w-5 h-5 text-indigo-500" />,
    tool: 'General Proofing Bot',
    what: 'Proofs text content for grammar, clarity, and style issues.',
    input: 'Pasted text or uploaded document (PDF/Word).',
    output: 'Proofed text with corrections highlighted.',
  },
  {
    id: 'llm-content-checker',
    icon: <Search className="w-5 h-5 text-indigo-500" />,
    tool: 'LLM Content Checker',
    what: 'Checks content for LLM-specific quality issues.',
    input: 'Pasted text or content block.',
    output: 'Quality check report.',
  },
  {
    id: 'comp-import-creator',
    icon: <TableProperties className="w-5 h-5 text-indigo-500" />,
    tool: 'Competency Builder',
    what: 'Step 1 of the competency pipeline. Builds competency import files from raw data.',
    input: 'Raw competency data.',
    output: 'Competency import CSV.',
  },
  {
    id: 'competency-csv-normaliser',
    icon: <TableProperties className="w-5 h-5 text-indigo-500" />,
    tool: 'Competency CSV Normaliser',
    what: 'Step 2. Normalises competency CSV structure and field values.',
    input: 'Raw competency CSV.',
    output: 'Normalised CSV.',
  },
  {
    id: 'row-expander',
    icon: <ListFilter className="w-5 h-5 text-indigo-500" />,
    tool: 'Row Expander',
    what: 'Step 4. Expands condensed rows into individual entries.',
    input: 'CSV with multi-value cells.',
    output: 'Expanded CSV with one value per row.',
  },
  {
    id: 'id-resolver',
    icon: <Link2 className="w-5 h-5 text-indigo-500" />,
    tool: 'ID Resolver',
    what: 'Step 5. Matches competency rows to canonical IDs from a reference file.',
    input: 'Competency CSV + reference ID file.',
    output: 'CSV with resolved IDs and mismatch flags.',
  },
  {
    id: 'directus-json-builder',
    icon: <Braces className="w-5 h-5 text-indigo-500" />,
    tool: 'Directus JSON Builder',
    what: 'Step 6. Builds Directus-compatible JSON import from resolved competency CSV.',
    input: 'Resolved competency CSV.',
    output: 'Directus JSON import file.',
  },
  {
    id: 'image-extractor',
    icon: <Link2 className="w-5 h-5 text-indigo-500" />,
    tool: 'Image Extractor',
    what: 'Extracts image URLs from content or HTML.',
    input: 'HTML or content block.',
    output: 'List of image URLs.',
  },
  {
    id: 'image-renamer',
    icon: <Search className="w-5 h-5 text-indigo-500" />,
    tool: 'Image Renamer',
    what: 'Renames image files according to a naming convention.',
    input: 'Image files or file list.',
    output: 'Renamed file list or download.',
  },
  {
    id: 'sound-generator',
    icon: <Volume2 className="w-5 h-5 text-indigo-500" />,
    tool: 'Sound Generator',
    what: 'Generates audio assets from text.',
    input: 'Text input.',
    output: 'Audio file.',
  },
  {
    id: 'prompt-writer',
    icon: <PenLine className="w-5 h-5 text-indigo-500" />,
    tool: 'Prompt Writer',
    what: 'Writes AI image prompts from lesson content.',
    input: 'Lesson context or description.',
    output: 'Image generation prompt.',
  },
  {
    id: 'prompt-rewriter',
    icon: <Wand2 className="w-5 h-5 text-indigo-500" />,
    tool: 'Prompt Redesigner',
    what: 'Rewrites and improves existing AI image prompts.',
    input: 'Existing prompt text.',
    output: 'Improved prompt.',
  },
  {
    id: 'class-id-finder',
    icon: <Hash className="w-5 h-5 text-indigo-500" />,
    tool: 'Class ID Finder',
    what: 'Finds class IDs from student or lesson data.',
    input: 'Student or lesson data file.',
    output: 'Matched class IDs.',
  },
  {
    id: 'jira-ticketer',
    icon: <Ticket className="w-5 h-5 text-indigo-500" />,
    tool: 'Jira Ticketer',
    what: 'Creates Jira tickets from structured content.',
    input: 'Ticket details or content list.',
    output: 'Jira ticket draft or submission.',
  },
  {
    id: 'vr-validator',
    icon: <Map className="w-5 h-5 text-indigo-500" />,
    tool: 'VR Validator',
    what: 'Validates VR lesson content against format requirements.',
    input: 'VR lesson data or file.',
    output: 'Validation report.',
  },
  {
    id: 'csv-cleanroom',
    icon: <ListFilter className="w-5 h-5 text-indigo-500" />,
    tool: 'CSV Cleanroom',
    what: 'Cleans and sanitises CSV files before processing.',
    input: 'Raw CSV file.',
    output: 'Cleaned CSV.',
  },
  {
    id: 'internal-notes',
    icon: <StickyNote className="w-5 h-5 text-indigo-500" />,
    tool: 'Internal Notes',
    what: 'Shared notes space for the team — create, tag, and share internal reference notes.',
    input: 'Note title, content, and tags.',
    output: 'Saved note visible to the team.',
  },
  {
    id: 'useful-links',
    icon: <Link2 className="w-5 h-5 text-indigo-500" />,
    tool: 'Useful Links',
    what: 'Curated list of frequently used internal and external links.',
    input: 'None — browse only.',
    output: 'Clickable links list.',
  },
  {
    id: 'directus-guides',
    icon: <Presentation className="w-5 h-5 text-indigo-500" />,
    tool: 'Directus Guides',
    what: 'Reference guides for working with Directus CMS.',
    input: 'None — browse only.',
    output: 'Guide articles and links.',
  },
];

export const ToolkitInfo: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <PageHeader
        icon={<Info />}
        iconColor="indigo"
        title="Toolkit Info"
        description="A central place to view what each tool does, what to input, and what to expect as output."
      />

      {/* Intro panel */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
        <p><span className="font-bold text-slate-700 dark:text-slate-300">What this is:</span> A quick reference for every tool in the Content Workspace.</p>
        <p><span className="font-bold text-slate-700 dark:text-slate-300">Who it's for:</span> Anyone using the toolkit who wants to know what a tool does before opening it.</p>
        <p><span className="font-bold text-slate-700 dark:text-slate-300">How to use it:</span> Scan the cards below. Each one summarises a tool's purpose, expected input, and output.</p>
      </div>

      {/* Tool cards */}
      <div className="space-y-3">
        {TOOLS.map(entry => (
          <div
            key={entry.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <IconBadge icon={entry.icon} variant="tinted" color="indigo" />
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{entry.tool}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">What it does</p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{entry.what}</p>
              </div>
              <div>
                <p className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Input</p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{entry.input}</p>
              </div>
              <div>
                <p className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Output</p>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{entry.output}</p>
                {entry.notes && (
                  <p className="mt-1.5 text-slate-400 dark:text-slate-500 italic">{entry.notes}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
