import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

/**
 * A single Shiki instance shared by the browser preview and the server-side PDF
 * renderer, so a code block is highlighted identically in both.
 *
 * Uses the fine-grained core bundle (a curated language list) rather than
 * `shiki`'s full bundle, which would pull every grammar into the client chunk.
 * The JS regex engine avoids shipping the Oniguruma wasm binary; `forgiving`
 * lets the few grammars it cannot fully compile degrade instead of throwing.
 */

export const LIGHT_THEME = "github-light";
export const DARK_THEME = "github-dark";

const themeLoaders = [
  import("@shikijs/themes/github-light"),
  import("@shikijs/themes/github-dark"),
];

const langLoaders = [
  import("@shikijs/langs/bash"),
  import("@shikijs/langs/c"),
  import("@shikijs/langs/cpp"),
  import("@shikijs/langs/csharp"),
  import("@shikijs/langs/css"),
  import("@shikijs/langs/diff"),
  import("@shikijs/langs/docker"),
  import("@shikijs/langs/go"),
  import("@shikijs/langs/graphql"),
  import("@shikijs/langs/html"),
  import("@shikijs/langs/ini"),
  import("@shikijs/langs/java"),
  import("@shikijs/langs/javascript"),
  import("@shikijs/langs/json"),
  import("@shikijs/langs/jsx"),
  import("@shikijs/langs/kotlin"),
  import("@shikijs/langs/lua"),
  import("@shikijs/langs/markdown"),
  import("@shikijs/langs/php"),
  import("@shikijs/langs/python"),
  import("@shikijs/langs/ruby"),
  import("@shikijs/langs/rust"),
  import("@shikijs/langs/scss"),
  import("@shikijs/langs/sql"),
  import("@shikijs/langs/swift"),
  import("@shikijs/langs/toml"),
  import("@shikijs/langs/tsx"),
  import("@shikijs/langs/typescript"),
  import("@shikijs/langs/xml"),
  import("@shikijs/langs/yaml"),
];

let highlighterPromise: Promise<HighlighterCore> | undefined;

export function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: themeLoaders,
    langs: langLoaders,
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return highlighterPromise;
}
