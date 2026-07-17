import express from 'express';

/**
 * Phase 0 scope: health endpoint only. This service becomes the
 * yt-dlp/twitch-dlp download helper in Phase 2 (RC-1). Nothing below
 * touches Twitch, downloads, or storage yet — do not assume it does.
 */

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8088;

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'echomedia-helper',
    phase: 0,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[helper] listening on :${PORT}`);
});
