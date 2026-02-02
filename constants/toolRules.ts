
export interface ImageStyleRules {
  styleName: string;
  visuals: string[];
  atmosphere: string;
  technical: string[];
  background: string;
}

export const IMAGE_STYLE_RULES: ImageStyleRules = {
  styleName: "Friendly Educational Cartoon",
  visuals: [
    "Vivid saturated colors",
    "Simple clean design",
    "Clear dark outlines",
    "Professional 2D illustration"
  ],
  atmosphere: "Warm, engaging aesthetic perfect for children's learning materials (ages 10+).",
  technical: [
    "High contrast",
    "Full body or upper body view as appropriate",
    "Entire subject visible with space around it",
    "Fair/natural skin tones",
    "Specific clothing details"
  ],
  background: "Completely transparent background."
};

export const SOUND_RULES = {
  objective: "Generate raw PCM audio for educational sound effects.",
  voiceProfile: "Puck (Cheerful/Friendly)",
  categories: [
    "Success chimes",
    "Ambient textures",
    "Short action effects",
    "Nature sounds"
  ]
};

export const TOPIC_RULES = {
  assignmentLogic: "Map words to existing topics based on semantic relevance. Only create a new topic if the word represents a distinct category not present in the reference list.",
  outputFormat: "JSON array with word, topicId, topic, canDo, and status."
};
