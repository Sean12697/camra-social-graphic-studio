// Generates the docs that must match the code: docs/QUERY_PARAMETERS.md from
// the parameter schema, docs/LOGOS.md from the logo catalogue and
// docs/assets/logo.svg from the icon definition.
//   node scripts/docs.mjs           write them
//   node scripts/docs.mjs --check   fail if the committed copies are stale (CI)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { docsMarkdown, logosMarkdown } from "../src/core/params.ts";
import { iconSvg } from "./icon.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = {
  "docs/QUERY_PARAMETERS.md": docsMarkdown(),
  "docs/LOGOS.md": logosMarkdown(),
  "docs/assets/logo.svg": iconSvg(),
};
const check = process.argv.includes("--check");
let stale = 0;
for (const [rel, content] of Object.entries(files)) {
  const p = join(root, rel);
  const current = existsSync(p) ? readFileSync(p, "utf8") : null;
  if (current === content) continue;
  if (check) {
    console.error(rel + " is out of date. Run npm run docs and commit the result.");
    stale++;
  } else {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
    console.log("Wrote " + rel);
  }
}
if (stale) process.exit(1);
