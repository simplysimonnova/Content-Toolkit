import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface ToolConfig {
  tool_id: string;
  prompt_template: string;
  temperature: number;
  max_tokens: number;
  feature_flags: Record<string, boolean>;
  isLocked: boolean;
  updated_at: string | null;
  updated_by: string | null;
}

const DEFAULTS: Omit<ToolConfig, 'tool_id'> = {
  prompt_template: '',
  temperature: 0.7,
  max_tokens: 4096,
  feature_flags: {},
  isLocked: false,
  updated_at: null,
  updated_by: null,
};

/**
 * Read-only fetch of tool configuration from Firestore `configurations` collection.
 * Returns merged defaults if the document does not exist.
 * Must NOT alter execution or bypass lock logic.
 */
export async function getToolConfig(toolId: string): Promise<ToolConfig> {
  try {
    const snap = await getDoc(doc(db, 'configurations', toolId));
    if (snap.exists()) {
      const data = snap.data();
      return {
        tool_id: toolId,
        prompt_template: data.instruction ?? DEFAULTS.prompt_template,
        temperature: data.temperature ?? DEFAULTS.temperature,
        max_tokens: data.max_tokens ?? DEFAULTS.max_tokens,
        feature_flags: data.feature_flags ?? DEFAULTS.feature_flags,
        isLocked: data.isLocked ?? DEFAULTS.isLocked,
        updated_at: data.updatedAt ?? DEFAULTS.updated_at,
        updated_by: data.updatedBy ?? DEFAULTS.updated_by,
      };
    }
  } catch {
    // Network/permission error — return defaults silently
  }
  return { tool_id: toolId, ...DEFAULTS };
}
