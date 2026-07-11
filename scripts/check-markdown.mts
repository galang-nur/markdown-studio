/**
 * Smoke-checks the markdown pipeline: GFM coverage, syntax highlighting, and
 * the XSS/sanitizer assumptions in lib/markdown.ts.
 *   node --experimental-strip-types scripts/check-markdown.mts
 */
import { renderMarkdown } from "../lib/markdown.ts";

const sample = `
# Heading 1
## Heading 2 with **bold**

Text with **bold**, _italic_, ~~strikethrough~~, and \`inline code\`.

- unordered
  - nested
1. ordered
2. second

- [x] done task
- [ ] open task

> A blockquote

| Left | Center | Right |
| :--- | :----: | ----: |
| a    | b      | c     |

\`\`\`go
fmt.Println("hi")
\`\`\`

\`\`\`unknownlang
some text
\`\`\`

---

[link](https://example.com) and ![img](data:image/png;base64,iVBORw0KGgo=)
`;

// Each construct sits in its own block: a raw-HTML block swallows every
// following line until a blank one, which would otherwise hide what is
// actually being asserted.
const xss = `
[click me](javascript:alert(1))

<img src=x onerror="alert(1)">

<script>alert("pwned")</script>

<iframe src="https://evil.com"></iframe>

[ok](https://safe.example.com)
`;

const html = await renderMarkdown(sample, "preview");
const pdfHtml = await renderMarkdown(sample, "pdf");
const xssHtml = await renderMarkdown(xss, "preview");

const checks: Array<[string, boolean]> = [
  ["h1 renders", html.includes("<h1>Heading 1</h1>")],
  ["strikethrough (gfm)", html.includes("<del>")],
  ["task list checkbox", html.includes('type="checkbox"')],
  ["table renders", html.includes("<table>")],
  ["table alignment survives sanitize", html.includes('align="center"')],
  ["no style attr on cells", !/<t[dh][^>]*style=/.test(html)],
  ["shiki highlighted go", html.includes("shiki") && html.includes("Println")],
  ["unknown lang falls back", html.includes("some text")],
  ["dual-theme vars in preview", html.includes("--shiki-dark")],
  ["pdf uses baked colors, not vars", !pdfHtml.includes("--shiki-dark")],
  ["links open in new tab", html.includes('target="_blank"')],
  ["base64 image survives", html.includes("data:image/png;base64")],
  ["hr renders", html.includes("<hr>")],
  // security
  ["javascript: href stripped", !xssHtml.includes("javascript:")],
  ["onerror stripped", !xssHtml.includes("onerror")],
  ["script tag stripped", !/<script/i.test(xssHtml)],
  ["iframe stripped", !/<iframe/i.test(xssHtml)],
  ["safe link preserved", xssHtml.includes("https://safe.example.com")],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  console.error("\n--- preview html ---\n" + html);
  console.error("\n--- xss html ---\n" + xssHtml);
  process.exit(1);
}
console.log(`\nAll ${checks.length} checks passed.`);
