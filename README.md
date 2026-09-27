# Markdown Studio

Paste or drop Markdown, read it rendered, export it as a clean PDF.
No account, no database, nothing stored — state lives in the browser tab and the
document is discarded as soon as the PDF is streamed back.

## Features

- Split-panel editor and live preview (300ms debounce), draggable divider.
- Full GFM: tables, task lists, strikethrough, nested lists, footnotes.
- Syntax highlighting via Shiki — 30 languages, follows the light/dark theme.
- Upload or drag-and-drop `.md` / `.markdown` / `.txt` (5MB cap).
- PDF export through headless Chromium: A4 or Letter, configurable margins.
- Falls back to the browser's own print-to-PDF if the server is unreachable.
- Responsive: the split view becomes tabs on narrow screens.
- Shortcuts: `Ctrl/⌘+Shift+E` export, `Ctrl/⌘+O` upload.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4 · shadcn/ui ·
remark/rehype · Shiki · Puppeteer.

## Running it

Requires Node.js 20+.

```bash
npm install
npm run dev          # http://localhost:3000
```

`npm install` lets Puppeteer download its own Chromium. In Docker the system
Chromium is used instead (see `Dockerfile`).

```bash
npm run check        # lint + typecheck + markdown/XSS tests
npm run build && npm start
```

### Before pushing

```bash
npm run ci:local                  # everything CI runs, on your machine
npm run ci:local -- --no-docker   # skip the container stage (faster)
```

`ci:local` mirrors `.github/workflows/ci.yml` step for step — lint, typecheck,
the markdown/XSS suite, a production build, then it builds the Docker image,
runs it, and exports a real PDF through the container. Green here means green in
CI. Keep the two in lockstep: a step added to one belongs in the other.

## Docker

Puppeteer needs a Chromium binary, which is why this is built to self-host rather
than deploy serverless.

```bash
docker build -t markdown-studio .
docker run -p 3000:3000 markdown-studio
```

The image installs the distro's Chromium, runs as the unprivileged `node` user,
and disables Chromium's own sandbox (`PUPPETEER_NO_SANDBOX=true`) because the
container is already the isolation boundary.

## How it fits together

```
app/page.tsx                 → components/markdown-studio.tsx   all editor state
components/                  editor · preview · split-panel · toolbar
lib/markdown.ts              the ONLY markdown renderer — preview and PDF both call it
lib/highlighter.ts           one shared Shiki instance
lib/pdf.ts                   Puppeteer; reads styles/pdf.css at request time
app/api/export-pdf/route.ts  POST → PDF bytes
proxy.ts                     rate limit, 10 req/min per IP (Next 16 replaces middleware.ts)
styles/preview.css           on-screen typography + the window.print() fallback
styles/pdf.css               print stylesheet, the source of truth for PDF styling
```

Preview and PDF share `lib/markdown.ts` on purpose, so the two renders cannot
drift apart. If you change how Markdown is parsed, both follow.

## Security

Raw HTML in the source is never turned into elements, and the tree is then run
through `rehype-sanitize`. `scripts/check-markdown.mts` asserts that `<script>`,
`<iframe>`, `onerror`, and `javascript:` URLs do not survive — run it after
touching the pipeline.

The app holds no secrets: no database, no auth, no API keys. Uploaded content is
never written to disk or logged; it lives in the browser tab and, during an
export, in memory for as long as the render takes.

## Known limitations

- **Rate limiting is in-memory** (`proxy.ts`, 10 req/min per IP). Correct for a
  single container; behind multiple replicas each would enforce its own quota.
  Needs a shared store (Redis) to scale out.
- **One Chromium instance is kept alive** across requests to avoid a ~300ms cold
  start per export. Fast, but it is a long-lived process — watch memory under
  sustained load. It relaunches automatically if it disconnects.
- The editor pane is a plain `<textarea>`; there is no syntax highlighting on the
  input side (only in the preview).
