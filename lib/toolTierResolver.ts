import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { resolveModel, type CapabilityTier } from './modelRegistry';

export async function getResolvedModelForTool(
  toolId: string,
  allowedTiers: CapabilityTier[]
): Promise<{ tier: CapabilityTier; model: string }> {
  let tier: CapabilityTier = 'default';

  try {
    const snap = await getDoc(doc(db, 'tool_settings', toolId));
    const data = snap.data();
    if (data?.capabilityTier && allowedTiers.includes(data.capabilityTier)) {
      tier = data.capabilityTier;
    }
  } catch {
    // fail silently — fallback to default
  }

  return {
    tier,
    model: resolveModel(tier),
  };
}
