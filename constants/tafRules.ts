
export interface TAFSlot {
  id: string;
  category: string;
  guidelines: string;
}

export interface TAFRuleset {
  version: string;
  whitelist: string[];
  blacklist: string[];
  slots: TAFSlot[];
  generalRules: string[];
}

export const DEFAULT_TAF_RULESET: TAFRuleset = {
  version: "1.1",
  whitelist: [
    "learned", "practised", "used", "talked about", "answered questions about",
    "asked questions about", "shared ideas about", "described", "explored",
    "took part in", "played (a game)", "followed (prompts / instructions)",
    "created", "discussed"
  ],
  blacklist: [
    "mastered", "improved", "successfully", "correctly", "fluently",
    "independently", "confidently", "enjoyed", "loved", "stayed focused",
    "tried hard", "completed all activities", "finished the task", "achieved the goal"
  ],
  slots: [
    { id: "TAF_1", category: "Vocabulary & Language", guidelines: "Topic-relevant vocabulary with representative examples." },
    { id: "TAF_2", category: "Vocabulary & Language", guidelines: "Topic-relevant vocabulary with representative examples." },
    { id: "TAF_3", category: "Grammar / Sentence Building", guidelines: "Functional language use and sentence patterns." },
    { id: "TAF_4", category: "Grammar / Sentence Building", guidelines: "Functional language use and sentence patterns." },
    { id: "TAF_5", category: "Grammar / Sentence Building", guidelines: "Functional language use and sentence patterns." },
    { id: "TAF_6", category: "Speaking & Interaction", guidelines: "Answering/asking questions or sharing opinions. MANDATORY." },
    { id: "TAF_7", category: "Speaking & Interaction", guidelines: "Answering/asking questions or sharing opinions. MANDATORY." },
    { id: "TAF_8", category: "Speaking & Interaction", guidelines: "Answering/asking questions or sharing opinions. MANDATORY." },
    { id: "TAF_9", category: "Tasks & Personalisation", guidelines: "Games, role-play, creative or AI-assisted tasks. Describe participation." },
    { id: "TAF_10", category: "Tasks & Personalisation", guidelines: "Games, role-play, creative or AI-assisted tasks. Describe participation." }
  ],
  generalRules: [
    "Begin each cell with a past-tense verb from the whitelist.",
    "Must grammatically follow 'Today you...'",
    "Be standalone and tickable.",
    "No line breaks.",
    "No banned verbs or claims of mastery/success.",
    "Base statements only on lesson content provided."
  ]
};
