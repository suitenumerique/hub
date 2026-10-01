// The design-system file preview loads the pdf.js worker from
// `/pdf.worker.mjs`, and pdf.js fetches its CJK cmaps, standard fonts and
// JPEG 2000 / JBIG2 decoders from the site root. pdf.js does not fail when
// those are missing: scanned or CJK PDFs silently render blank. Copy them out
// of the pdfjs-dist that react-pdf resolves, so they match the bundled
// version, into `public/` (git-ignored) before every dev server and build.
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const resolveFrom = (from, request) =>
  require.resolve(request, { paths: [from] });

const uiComponents = dirname(
  resolveFrom(import.meta.dirname, "@gouvfr-lasuite/ui-components"),
);
const reactPdf = dirname(resolveFrom(uiComponents, "react-pdf/package.json"));
const pdfjs = dirname(resolveFrom(reactPdf, "pdfjs-dist/package.json"));
const publicDir = join(import.meta.dirname, "..", "public");

// Plain file copies: `cpSync` leaves write-only files on Docker for Mac mounts.
const copyDirectory = (from, to) => {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(source, target);
    } else {
      copyFileSync(source, target);
    }
  }
};

copyFileSync(
  join(pdfjs, "build", "pdf.worker.min.mjs"),
  join(publicDir, "pdf.worker.mjs"),
);
for (const folder of ["cmaps", "standard_fonts", "wasm"]) {
  // Start clean so files of a previous pdf.js version never linger.
  rmSync(join(publicDir, folder), { recursive: true, force: true });
  copyDirectory(join(pdfjs, folder), join(publicDir, folder));
}
