export type CapabilityTier = 'default';

const TIER_MODEL_MAP: Record<CapabilityTier, string> = {
  default: 'gemini-3-flash-preview',
};

export function resolveModel(tier: CapabilityTier = 'default'): string {
  return TIER_MODEL_MAP[tier];
}
