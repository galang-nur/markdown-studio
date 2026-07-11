import rehypeShikiFromHighlighter, {
  type RehypeShikiCoreOptions,
} from "@shikijs/rehype/core";
import { defaultSchema } from "hast-util-sanitize";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { Element, Root } from "hast";
import type { Plugin } from "unified";
import type { HighlighterCore } from "shiki/core";

import { DARK_THEME, getHighlighter, LIGHT_THEME } from "./highlighter";

export type RenderTarget = "preview" | "pdf";

/**
 * The plugin is typed against `HighlighterGeneric<any, any>`, whose `any` params
 * do not unify with the `never`s in `HighlighterCore` (the fine-grained bundle we
 * build in lib/highlighter.ts). Restate the signature; the runtime contract is
 * identical, only the generics disagree.
 */
const rehypeShiki = rehypeShikiFromHighlighter as unknown as Plugin<
  [HighlighterCore, RehypeShikiCoreOptions],
  Root
>;

/**
 * Sanitizer allowlist, derived from the GitHub schema.
 *
 * Raw HTML in the source is never turned into elements in the first place
 * (remark-rehype runs without `allowDangerousHtml`), so this schema is a second
 * line of defence: its real job is protocol filtering on `href`/`src`, which is
 * what blocks `javascript:` links.
 *
 * One addition on top of the defaults: `data:` on `src`, so base64 images render
 * (§5.1). Browsers do not execute scripts inside an SVG loaded through `<img>`,
 * so this is not an XSS vector. GFM column alignment needs no special handling —
 * it arrives as an `align` attribute, which the default schema already permits.
 */
const schema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), "data"],
  },
};

/**
 * Open links in a new tab (§5.1). Runs after sanitization, so the attributes it
 * adds are ours and cannot be spoofed by the document.
 */
function rehypeExternalLinks() {
  return (tree: Root) => {
    visitElements(tree, (node) => {
      if (node.tagName !== "a") return;
      const href = node.properties?.href;
      if (typeof href !== "string" || href.startsWith("#")) return;
      node.properties.target = "_blank";
      // hast models space-separated attributes as arrays.
      node.properties.rel = ["noopener", "noreferrer"];
    });
  };
}

function visitElements(node: Root | Element, fn: (el: Element) => void): void {
  for (const child of node.children) {
    if (child.type !== "element") continue;
    fn(child);
    visitElements(child, fn);
  }
}

/**
 * Markdown -> sanitized, syntax-highlighted HTML fragment.
 *
 * The single entry point for both the live preview and the PDF, so the two
 * cannot drift apart (§11, "Inkonsistensi render antara preview dan PDF").
 * `preview` emits dual-theme CSS variables that follow the app's light/dark
 * mode; `pdf` bakes in the light theme, since printed output is always on white.
 */
export async function renderMarkdown(
  markdown: string,
  target: RenderTarget = "preview",
): Promise<string> {
  const highlighter = await getHighlighter();

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    .use(rehypeShiki, highlighter, {
      ...(target === "pdf"
        ? { theme: LIGHT_THEME }
        : {
            themes: { light: LIGHT_THEME, dark: DARK_THEME },
            defaultColor: false,
          }),
      fallbackLanguage: "text",
    })
    .use(rehypeExternalLinks)
    .use(rehypeStringify)
    .process(markdown);

  return String(file);
}
