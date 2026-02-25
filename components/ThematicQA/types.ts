export interface ThematicMatch {
  slide: string;
  matched_term: string;
  context: string;
}

export interface VisualMatch {
  slide: string;
  matched_element: string;
  confidence: string;
}

export interface ThematicQAResult {
  theme: string;
  generated_keywords: {
    direct_terms: string[];
    characters: string[];
    objects: string[];
    symbols: string[];
    phrases: string[];
    visual_indicators: string[];
  };
  text_matches: ThematicMatch[];
  visual_matches: VisualMatch[];
  risk_level: 'none' | 'low' | 'moderate' | 'high';
  summary: string;
}

export interface ScanReport {
  id?: string;
  created_at: any;
  theme: string;
  file_name: string;
  file_source: 'upload' | 'gslides';
  file_id: string | null;
  risk_level: 'none' | 'low' | 'moderate' | 'high';
  text_match_count: number;
  visual_match_count: number;
  generated_keywords: ThematicQAResult['generated_keywords'];
  text_matches: ThematicMatch[];
  visual_matches: VisualMatch[];
  summary: string;
  processing_time_ms: number;
  status: 'success' | 'failed';
  error_message: string | null;
  batch_session_id: string | null;
}

export interface BatchItem {
  id: string;
  fileName: string;
  source: 'upload' | 'gslides';
  file?: File;
  url?: string;
  status: 'pending' | 'extracting' | 'scanning' | 'saving' | 'done' | 'failed';
  error?: string;
  report?: ScanReport;
}

export interface QASettings {
  strictMode: boolean;
  maxKeywords: number;
  visualSensitivity: 'conservative' | 'balanced' | 'aggressive';
  saveReportsAutomatically: boolean;
  firebaseLoggingEnabled: boolean;
  defaultTheme: string;
}

export const DEFAULT_SETTINGS: QASettings = {
  strictMode: false,
  maxKeywords: 60,
  visualSensitivity: 'balanced',
  saveReportsAutomatically: true,
  firebaseLoggingEnabled: true,
  defaultTheme: '',
};
