
export interface LessonInfo {
  age: string;
  lessonDetails: string;
}

export type OutputMode = 'content' | 'description';

export interface GenerationResponse {
  text: string;
  error?: string;
}

export type AppPage = 
  | 'dashboard'
  | 'lesson-descriptions' 
  | 'taf-generator' 
  | 'word-cleaner' 
  | 'topic-assigner' 
  | 'list-merger'
  | 'llm-content-checker'
  | 'image-extractor' 
  | 'nano-banana'
  | 'prompt-writer'
  | 'prompt-rewriter'
  | 'proofing-bot'
  | 'lesson-proofing-bot'
  | 'sound-generator' 
  | 'tts-generator'
  | 'deduplicator' 
  | 'useful-links'
  | 'internal-notes'
  | 'directus-guides'
  | 'subscription-tracker'
  | 'ss-compactor'
  | 'gap-spotter'
  | 'plan-generator'
  | 'slide-creator'
  | 'improvement-suggestor'
  | 'curriculum-planner'
  | 'lesson-creator-tool'
  | 'editorial-tool'
  | 'image-renamer'
  | 'vr-validator'
  | 'class-id-finder';

export interface ResourceLink {
  id?: string;
  name: string;
  category: string;
  description: string;
  url: string;
  createdAt?: any;
}

export interface InternalNote {
  id?: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  userName: string;
  isShared: boolean;
}

export interface DirectusGuide {
  id?: string;
  title: string;
  category: string;
  summary: string;
  url: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Subscription {
  id?: string;
  name: string;
  planName: string;
  price: number;
  frequency: 'Monthly' | 'Yearly';
  nextBillDate: any; // Timestamp
  category: 'Keep Active' | 'For Testing';
  notes?: string;
  status: 'Active' | 'Paused';
  isEssential: boolean;
}
