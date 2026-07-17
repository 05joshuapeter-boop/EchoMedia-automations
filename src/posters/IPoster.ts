/**
 * Poster adapter contract (build brief v1 §4.3, extended per RC-6/v2).
 *
 * v2/M5 scope cut: only UploadPostPoster + MockPoster ship in v1. Postiz
 * and Ayrshare stay documented-only options (see docs/), not built.
 *
 * DELIBERATE EXTENSION beyond v1's literal signature: v1 specified only
 * schedulePost(). This adds getPostStatus(), because RC-6 is a BINDING
 * requirement ("never trust the HTTP 200 as posted — poll the status
 * endpoint by publish_id"). schedulePost() alone cannot satisfy RC-6; a
 * caller has no way to confirm the post actually went live. This is
 * fulfilling a stress-test finding, not re-opening a locked decision —
 * flagging it explicitly per the "ask only what you can't derive" rule.
 */

export type Platform = 'tiktok' | 'youtube' | 'instagram';

export interface SchedulePostRequest {
  clientId: string;
  platforms: Platform[];
  videoUrl: string;
  caption: string;
  hashtags: string[];
  /** ISO 8601. Omit to post as soon as the platform allows. */
  scheduleAt?: string;
}

export type PublishStatus = 'scheduled' | 'processing' | 'published' | 'failed';

export interface SchedulePostResult {
  postId: string;
  status: PublishStatus;
}

export interface IPoster {
  schedulePost(req: SchedulePostRequest): Promise<SchedulePostResult>;

  /**
   * RC-6: publishing is asynchronous on every platform behind Upload-Post.
   * A 200 from schedulePost() means "accepted for processing," not "live."
   * Callers MUST poll this until it resolves to 'published' or 'failed'
   * before marking anything Posted in Trello.
   */
  getPostStatus(postId: string): Promise<PublishStatus>;
}
