// The chat draws every emoji, and fills the emoji picker and the `:shortcode`
// suggestions, from files the Hub serves itself rather than from a CDN: a
// network that blocks the CDN would leave the picker empty, and each request
// would tell a third party who is chatting. Copy them out of the pinned
// `emojibase-data` and `@lobehub/fluent-emoji-flat` into `public/emoji`
// (git-ignored) before every dev server and build.
//
// - `fluent/<codepoints>.svg`: one Fluent drawing per emoji, named as
//   `emojiToCodepoints` in `src/features/chat/fluentEmoji.ts` names it.
// - `emojibase/<locale>/…`: the Emojibase files Frimousse and the shortcode
//   suggestions read, keeping only the emojis that have a Fluent drawing so
//   none is drawn in another style.
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const packageDir = (name) => dirname(require.resolve(`${name}/package.json`));

const emojibaseDir = packageDir("emojibase-data");
const fluentDir = join(packageDir("@lobehub/fluent-emoji-flat"), "assets");
const targetDir = join(import.meta.dirname, "..", "public", "emoji");

// The locales of `EMOJIBASE_LOCALES` in `src/features/chat/emojibase.ts`.
const LOCALES = ["en", "fr", "de", "nl"];
// Element's Slack-style shortcodes in English, CLDR's in the other languages.
const SHORTCODES = [
  "en/shortcodes/iamcal.json",
  ...LOCALES.filter((locale) => locale !== "en").map(
    (locale) => `${locale}/shortcodes/cldr.json`,
  ),
];

// As `emojiToCodepoints`: lowercase hex code points, without U+FE0F.
const toFileName = (codepoints) =>
  codepoints
    .map((codepoint) => codepoint.toLowerCase().padStart(4, "0"))
    .filter((codepoint) => codepoint !== "fe0f")
    .join("-");

const emojiFileName = (emoji) =>
  toFileName([...emoji].map((char) => char.codePointAt(0).toString(16)));

// Start clean so files of a previous version never linger.
rmSync(targetDir, { recursive: true, force: true });

const fluentTarget = join(targetDir, "fluent");
mkdirSync(fluentTarget, { recursive: true });
const drawn = new Set();
for (const file of readdirSync(fluentDir)) {
  if (!file.endsWith(".svg")) {
    continue;
  }
  const codepoints = file.slice(0, -".svg".length).split(/[-_]/);
  // `1f3f4-e0067_e0062_e0065_e006e_e0067.svg` is 🏴󠁧󠁢󠁥󠁮󠁧󠁿, its closing tag
  // U+E007F left out.
  if (codepoints.at(-1).startsWith("e00")) {
    codepoints.push("e007f");
  }
  const name = toFileName(codepoints);
  if (drawn.has(name)) {
    continue;
  }
  drawn.add(name);
  // Plain file copies: `cpSync` leaves write-only files on Docker for Mac.
  copyFileSync(join(fluentDir, file), join(fluentTarget, `${name}.svg`));
}

const readJson = (path) => JSON.parse(readFileSync(join(emojibaseDir, path)));
const writeJson = (path, value) => {
  const target = join(targetDir, "emojibase", path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(value));
};

const isDrawn = ({ emoji }) => drawn.has(emojiFileName(emoji));
for (const locale of LOCALES) {
  const emojis = readJson(`${locale}/data.json`)
    .filter(isDrawn)
    .map((emoji) =>
      emoji.skins ? { ...emoji, skins: emoji.skins.filter(isDrawn) } : emoji,
    );
  writeJson(`${locale}/data.json`, emojis);
  writeJson(`${locale}/messages.json`, readJson(`${locale}/messages.json`));
}
for (const path of SHORTCODES) {
  writeJson(path, readJson(path));
}
