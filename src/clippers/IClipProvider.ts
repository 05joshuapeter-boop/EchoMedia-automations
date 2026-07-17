/**
 * Clipper adapter contract (build brief v1 §4.2).
 *
 * v2/M5 scope cut: only VizardClipProvider + MockClipProvider ship in v1.
 * The interface stays provider-agnostic regardless — that's what let us cut
 * Ssemble/Reap without touching the pipeline.
 *
 * RC-7 note: ingest-budget enforcement (per-client monthly minutes cap) is
 * the CALLER's responsibility, not the adapter's. A workflow must check the
 * client's remaining ingestBudgetMinutes and skip/short-circuit BEFORE ever
 * calling submitJob. The adapter has no concept of billing tiers.
 */

export interface ClipJobRequest {
  sourceVideoUrl: string;
  clientId: string;
  language: 'auto' | string;
  maxDurationSec: number;
  aspectRatio: '9:16';
  subtitles: { enabled: true; style: 'dynamic' };
  faceTracking: true;
  targetClipCount: number;
}

export interface RenderedClip {
  externalId: string;
  clientId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  transcriptDraft: string;
  suggestedCaption: string;
  suggestedHashtags: string[];
  scoreOrRank?: number;
  startSec?: number;
  endSec?: number;
}

export type ClipJobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface IClipProvider {
  submitJob(req: ClipJobRequest): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<ClipJobStatus>;
  getClips(jobId: string): Promise<RenderedClip[]>;
}
