import type { ReportData, ToolReport } from '../../types/report';
import { TOOL_ID, TOOL_LABEL } from './constants';

export type TNRunStatus = 'success' | 'partial_success' | 'error';

export interface TNReportContext {
  userId: string;
  inputType: 'pdf' | 'pptx' | 'slides-zip' | 'text';
  fileName: string | null;
  totalSlides: number;
  slidesProcessed: number;
  slidesFailed: number;
  finalOutput: string;
  model: string | null;
  promptVersion: string;
}

function resolveStatus(ctx: TNReportContext): TNRunStatus {
  if (ctx.slidesProcessed === 0) return 'error';
  if (ctx.slidesFailed > 0) return 'partial_success';
  return 'success';
}

function buildSummaryText(status: TNRunStatus, ctx: TNReportContext): string {
  if (status === 'error') {
    return `TN Standardiser run failed — no slides were successfully processed.`;
  }
  if (status === 'partial_success') {
    return `${ctx.slidesProcessed} of ${ctx.totalSlides} slides standardised successfully; ${ctx.slidesFailed} fell back to original content.`;
  }
  if (ctx.totalSlides <= 1) {
    return `Teacher notes standardised successfully.`;
  }
  return `All ${ctx.totalSlides} slides standardised successfully.`;
}

export function buildTNReport(ctx: TNReportContext): {
  status: TNRunStatus;
  summary: string;
  reportData: ReportData;
  metadata: Record<string, unknown>;
  localReport: ToolReport;
} {
  const status = resolveStatus(ctx);
  const summary = buildSummaryText(status, ctx);

  const parserLabel: Record<TNReportContext['inputType'], string> = {
    pdf: 'PDF (pdfjs-dist, even pages)',
    pptx: 'PPTX (JSZip + XML)',
    'slides-zip': 'Slides.com ZIP (index.html JSON)',
    text: 'Plain text input',
  };

  const reportData: ReportData = {
    sections: [
      {
        type: 'summary',
        title: TOOL_LABEL,
        status,
        text: summary,
      },
      {
        type: 'scorecard',
        title: 'Run Stats',
        items: [
          {
            label: 'Input Type',
            value: ctx.inputType.toUpperCase(),
            variant: 'neutral',
          },
          {
            label: 'Total Slides',
            value: ctx.totalSlides,
            variant: 'neutral',
          },
          {
            label: 'Processed',
            value: ctx.slidesProcessed,
            variant: ctx.slidesProcessed === ctx.totalSlides ? 'success' : 'warning',
          },
          {
            label: 'Failed / Fallback',
            value: ctx.slidesFailed,
            variant: ctx.slidesFailed === 0 ? 'success' : 'error',
          },
          {
            label: 'Parser',
            value: parserLabel[ctx.inputType],
            variant: 'neutral',
          },
        ],
      },
      {
        type: 'text',
        title: 'Standardised Output',
        content: ctx.finalOutput,
      },
      {
        type: 'raw',
        title: 'Run Details',
        data: {
          file_name: ctx.fileName ?? '(text input)',
          model: ctx.model ?? 'unknown',
          prompt_version: ctx.promptVersion,
          input_type: ctx.inputType,
          slides_total: ctx.totalSlides,
          slides_processed: ctx.slidesProcessed,
          slides_failed: ctx.slidesFailed,
        },
      },
    ],
  };

  const metadata: Record<string, unknown> = {
    input_type: ctx.inputType,
    file_name: ctx.fileName ?? null,
    slide_count: ctx.totalSlides,
    slides_processed: ctx.slidesProcessed,
    slides_failed: ctx.slidesFailed,
    parser: ctx.inputType,
    model: ctx.model ?? null,
    prompt_version: ctx.promptVersion,
  };

  const localReport: ToolReport = {
    tool_id: TOOL_ID,
    user_id: ctx.userId,
    created_at: new Date().toISOString(),
    status,
    summary,
    report_data: reportData,
    schema_version: '1.0',
    metadata,
  };

  return { status, summary, reportData, metadata, localReport };
}
