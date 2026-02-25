import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { ToolReport, ReportData } from '../types/report';

const SCHEMA_VERSION = '1.0';

/**
 * Saves a completed tool run as a structured report to the `tool_reports`
 * Firestore collection.
 *
 * Returns the saved document ID, or null on failure (non-throwing).
 * Does NOT modify tool execution logic.
 * Does NOT alter governance or lock state.
 */
export async function saveReport(params: {
  toolId: string;
  userId: string;
  status: 'success' | 'error';
  summary: string;
  reportData: ReportData;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const doc: Omit<ToolReport, 'id'> = {
    tool_id: params.toolId,
    user_id: params.userId,
    created_at: new Date().toISOString(),
    status: params.status,
    summary: params.summary,
    report_data: params.reportData,
    schema_version: SCHEMA_VERSION,
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };

  try {
    const ref = await addDoc(collection(db, 'tool_reports'), doc);
    return ref.id;
  } catch (e) {
    console.error('[reportService] Failed to save report:', e);
    return null;
  }
}
