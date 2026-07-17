import { MockClipProvider } from '../clippers/MockClipProvider.js';
import type { ClipJobRequest } from '../clippers/IClipProvider.js';
import { MockPoster } from '../posters/MockPoster.js';
import type { SchedulePostRequest } from '../posters/IPoster.js';

/**
 * Phase 0 self-check: proves the mock adapters actually implement the
 * async lifecycle (queued/processing/done, scheduled/processing/published)
 * that Phase 1's real polling logic will depend on. Zero network calls.
 *
 * Run: npm run smoke
 */

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`SMOKE TEST FAILED: ${message}`);
  }
}

async function main() {
  console.log('--- IClipProvider (MockClipProvider) ---');
  const clipper = new MockClipProvider();
  const req: ClipJobRequest = {
    sourceVideoUrl: 'https://example.com/fixture-vod.mp4',
    clientId: 'client_smoke_test',
    language: 'auto',
    maxDurationSec: 60,
    aspectRatio: '9:16',
    subtitles: { enabled: true, style: 'dynamic' },
    faceTracking: true,
    targetClipCount: 3,
  };

  const { jobId } = await clipper.submitJob(req);
  console.log(`submitJob -> jobId=${jobId}`);

  const statuses: string[] = [];
  let status = await clipper.getJobStatus(jobId);
  statuses.push(status);
  while (status !== 'done' && status !== 'failed') {
    status = await clipper.getJobStatus(jobId);
    statuses.push(status);
  }
  console.log(`Status sequence across polls: ${statuses.join(' -> ')}`);
  assert(statuses.length >= 2, 'expected multiple polls before done (real async behavior)');
  assert(status === 'done', 'expected terminal status to be done');

  const clips = await clipper.getClips(jobId);
  console.log(`getClips -> ${clips.length} fixture clip(s)`);
  assert(clips.length === 3, 'expected 3 fixture clips for targetClipCount=3');
  assert(clips.every((c) => c.clientId === req.clientId), 'clientId must propagate to every clip');

  console.log('\n--- IPoster (MockPoster) ---');
  const poster = new MockPoster();
  const postReq: SchedulePostRequest = {
    clientId: 'client_smoke_test',
    platforms: ['tiktok', 'youtube'],
    videoUrl: clips[0]!.videoUrl,
    caption: clips[0]!.suggestedCaption,
    hashtags: clips[0]!.suggestedHashtags,
  };

  const scheduled = await poster.schedulePost(postReq);
  console.log(`schedulePost -> postId=${scheduled.postId}, status=${scheduled.status}`);
  assert(scheduled.status === 'scheduled', 'schedulePost must return scheduled, not published');
  assert(scheduled.status !== 'published', 'RC-6: must NEVER trust the initial response as published');

  const postStatuses: string[] = [scheduled.status];
  let postStatus = await poster.getPostStatus(scheduled.postId);
  postStatuses.push(postStatus);
  while (postStatus !== 'published' && postStatus !== 'failed') {
    postStatus = await poster.getPostStatus(scheduled.postId);
    postStatuses.push(postStatus);
  }
  console.log(`Post status sequence across polls: ${postStatuses.join(' -> ')}`);
  assert(postStatus === 'published', 'expected terminal status to be published');

  console.log('\nALL SMOKE CHECKS PASSED — mocks implement the async contracts Phase 1 will poll against.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
