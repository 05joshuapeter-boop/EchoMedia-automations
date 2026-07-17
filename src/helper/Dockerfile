# =============================================================================
# ⚠️ M3 HARDENING STATUS: PARTIAL. Non-root + array-arg exec are Phase 0
# concerns and ARE done. VERSION PINNING is NOT done here — Phase 0 doesn't
# invoke yt-dlp/twitch-dlp/streamlink from any code path (server.ts only
# serves /health), so installing "latest" today is a deliberate, scoped
# exception, not an oversight. THIS MUST BE FIXED BEFORE PHASE 2: replace
# the unpinned installs below with exact `==`/`@` version pins (verify each
# against PyPI/npm at that time) before any real download logic is wired.
# Do not carry this comment forward as "done" — it is an open Phase 2 gate.
# =============================================================================
FROM node:22.9.0-alpine3.20

RUN apk add --no-cache \
      python3 \
      py3-pip \
      ffmpeg \
      curl

# --break-system-packages is required on Alpine's PEP 668-managed Python.
# TODO(Phase 2): pin exact versions, e.g. "yt-dlp==<verified-version>".
RUN pip install --no-cache-dir --break-system-packages \
      yt-dlp \
      streamlink

# twitch-dlp is a Node/TS CLI (confirmed via its repo — requires Node 22+,
# ffmpeg, and streamlink for non-"--live-from-start" channel downloads).
# TODO(Phase 2): pin exact version, e.g. "twitch-dlp@<verified-version>".
RUN npm install -g twitch-dlp \
  && npm cache clean --force

# M3: run as non-root.
RUN addgroup -S echomedia && adduser -S echomedia -G echomedia

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/helper ./dist/helper

USER echomedia
ENV PORT=8088
EXPOSE 8088
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/helper/server.js"]
