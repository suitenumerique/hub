import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pdfPackage = require.resolve("pdfjs-dist/package.json", {
  paths: [dirname(require.resolve("react-pdf"))],
});
mkdirSync("public", { recursive: true });
copyFileSync(
  join(dirname(pdfPackage), "build/pdf.worker.min.mjs"),
  "public/pdf.worker.min.mjs",
);
for (const asset of ["cmaps", "standard_fonts", "wasm"]) {
  const source = join(dirname(pdfPackage), asset);
  const target = join("public", asset);
  mkdirSync(target, { recursive: true });
  for (const file of readdirSync(source)) {
    copyFileSync(join(source, file), join(target, file));
  }
}
