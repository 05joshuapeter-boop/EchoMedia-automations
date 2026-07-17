import { randomUUID } from 'node:crypto';
import type {
  ClipJobRequest,
  ClipJobStatus,
  IClipProvider,
  RenderedClip,
} from './IClipProvider.js';

interface MockJob {
  request: ClipJobRequest;
  pollCount: number;
  readyAtPollCount: number;
}

/**
 * Deterministic fixture provider — zero network calls, zero cost.
 *
 * Simulates the real async job lifecycle (queued -> processing -> done)
 * across multiple getJobStatus() calls, so the pipeline's polling logic
 * gets genuinely exercised in tests instead of always seeing an instant
 * "done". This is what makes G-VERIFY ("every phase demonstrable at zero
 * API spend") possible.
 */
export class MockClipProvider implements IClipProvider {
  private jobs = new Map<string, MockJob>();

  async submitJob(req: ClipJobRequest): Promise<{ jobId: string }> {
    const jobId = `mock_${randomUUID()}`;
    this.jobs.set(jobId, { request: req, pollCount: 0, readyAtPollCount: 3 });
    return { jobId };
  }

  async getJobStatus(jobId: string): Promise<ClipJobStatus> {
    const job = this.jobs.get(jobId);
    if (!job) return 'failed';
    job.pollCount += 1;
    if (job.pollCount === 1) return 'queued';
    if (job.pollCount < job.readyAtPollCount) return 'processing';
    return 'done';
  }

  async getClips(jobId: string): Promise<RenderedClip[]> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`MockClipProvider: unknown jobId "${jobId}"`);
    }
    const count = Math.min(job.request.targetClipCount, 3);
    return Array.from({ length: count }, (_, i) => this.buildFixtureClip(jobId, job, i));
  }

  private buildFixtureClip(jobId: string, job: MockJob, index: number): RenderedClip {
    const start = index * 45;
    return {
      externalId: `mock_clip_${jobId}_${index}`,
      clientId: job.request.clientId,
      videoUrl: `https://mock.local/clips/${jobId}/${index}.mp4`,
      thumbnailUrl: `https://mock.local/clips/${jobId}/${index}.jpg`,
      transcriptDraft: `[fixture transcript ${index + 1}] Placeholder transcript text for testing the review pipeline end-to-end.`,
      suggestedCaption: `Fixture clip ${index + 1} — replace with a real caption before shipping`,
      suggestedHashtags: ['#mock', '#fixture', '#donotpost'],
      scoreOrRank: 0.5,
      startSec: start,
      endSec: start + job.request.maxDurationSec,
    };
  }
}
