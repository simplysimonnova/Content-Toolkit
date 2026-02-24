import type { QARun } from '../components/AIQARunner/types';

export interface ConnectorResult {
  success: boolean;
  message: string;
  externalId?: string;
}

export type ConnectorTarget = 'project-tool';

// Stub connector — extend this to integrate with external project tools.
// Do NOT couple to Jira or any specific platform here.
export async function pushToConnector(
  target: ConnectorTarget,
  run: QARun,
  runId: string
): Promise<ConnectorResult> {
  console.log(`[ConnectorInterface] Push requested to "${target}" for run ${runId}`, run);

  // Stub: simulate async push
  await new Promise(resolve => setTimeout(resolve, 500));

  return {
    success: true,
    message: `Results queued for "${target}". Integration stub — configure endpoint in connectorInterface.ts.`,
    externalId: `stub-${runId}`,
  };
}
