import { randomUUID } from 'node:crypto';
import type {
  IPoster,
  PublishStatus,
  SchedulePostRequest,
  SchedulePostResult,
} from './IPoster.js';

interface MockPost {
  pollCount: number;
  liveAtPollCount: number;
}

/**
 * Deterministic fixture poster — zero network calls, zero cost.
 *
 * Simulates the real async publish lifecycle (RC-6: scheduled -> processing
 * -> published) so a test can prove it polls getPostStatus() instead of
 * trusting schedulePost()'s immediate return value.
 */
export class MockPoster implements IPoster {
  private posts = new Map<string, MockPost>();

  async schedulePost(_req: SchedulePostRequest): Promise<SchedulePostResult> {
    const postId = `mock_post_${randomUUID()}`;
    this.posts.set(postId, { pollCount: 0, liveAtPollCount: 2 });
    return { postId, status: 'scheduled' };
  }

  async getPostStatus(postId: string): Promise<PublishStatus> {
    const post = this.posts.get(postId);
    if (!post) return 'failed';
    post.pollCount += 1;
    if (post.pollCount < post.liveAtPollCount) return 'processing';
    return 'published';
  }
}
