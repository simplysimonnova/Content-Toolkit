export type CapabilityTier = 'default' | 'reasoning' | 'vision';

const TIER_MODEL_MAP: Record<CapabilityTier, string> = {
  default: 'gemini-3-flash-preview',
  reasoning: 'gemini-3-pro',
  vision: 'gemini-3-flash-preview',
};

export function resolveModel(tier: CapabilityTier = 'default'): string {
  return TIER_MODEL_MAP[tier] ?? TIER_MODEL_MAP.default;
}
