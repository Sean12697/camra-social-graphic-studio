// Builds the static site into dist/: bundles and minifies the TypeScript and
// CSS with content-hashed names, writes index.html, the service worker with
// its precache list, the PWA icons and the manifest, and copies the static
// files. The output is plain static files: deploy dist/ anywhere.
//
//   node scripts/build.mjs           production build
//   node scripts/build.mjs --dev     unminified, for local development

import { build } from "esbuild";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { iconFiles } from "./icon.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const dev = process.argv.includes("--dev");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function write(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export async function buildSite() {
  const started = Date.now();
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  const common = {
    bundle: true,
    minify: !dev,
    sourcemap: true,
    target: ["es2020", "safari15"],
    legalComments: "none",
    logLevel: "warning",
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __HAS_FONTS__: JSON.stringify(existsSync(join(root, "assets/fonts/arboria.woff2")) || existsSync(join(root, "assets/fonts/arboria-bold.woff2"))),
    },
  };

  // The app: an IIFE (not an ES module), so dist/index.html also works when
  // opened straight from disk.
  const app = await build({
    ...common,
    entryPoints: { main: join(root, "src/main.ts"), theme: join(root, "src/theme-boot.ts") },
    outdir: join(dist, "app"),
    entryNames: "[name]-[hash]",
    format: "iife",
    metafile: true,
    loader: { ".json": "json" },
  });
  const outputs = Object.keys(app.metafile.outputs).map((p) => relative(dist, join(root, p)).split("\\").join("/"));
  const pick = (re) => {
    const f = outputs.find((o) => re.test(o));
    if (!f) throw new Error("Build output missing: " + re);
    return f;
  };
  const mainJs = pick(/^app\/main-[A-Z0-9]+\.js$/i);
  const mainCss = pick(/^app\/main-[A-Z0-9]+\.css$/i);
  const themeJs = pick(/^app\/theme-[A-Z0-9]+\.js$/i);

  // index.html
  let html = readFileSync(join(root, "src/index.html"), "utf8");
  html = html
    .replace("<!-- HEAD -->", `<script src="${themeJs}"></script>\n<link rel="stylesheet" href="${mainCss}">`)
    .replace("<!-- BODY -->", `<script src="${mainJs}" defer></script>`)
    .replaceAll("%VERSION%", pkg.version);
  write(join(dist, "index.html"), html);

  // Static files: public/ (text) and assets/ (logos, optional fonts).
  cpSync(join(root, "public"), dist, { recursive: true });
  if (existsSync(join(root, "assets"))) cpSync(join(root, "assets"), join(dist, "assets"), { recursive: true });
  cpSync(join(root, "CHANGELOG.md"), join(dist, "CHANGELOG.md"));
  for (const [path, data] of Object.entries(iconFiles())) write(join(dist, path), data);

  // Service worker, with the app shell to precache and a cache name unique
  // to this build's contents.
  const shell = walk(dist)
    .map((p) => relative(dist, p).split("\\").join("/"))
    .filter((p) => !p.endsWith(".map") && p !== "_headers" && p !== "robots.txt" && !p.startsWith("assets/fonts/"))
    .sort();
  const hash = createHash("sha256");
  shell.forEach((p) => hash.update(p).update(readFileSync(join(dist, p))));
  const cache = "camra-graphics-" + pkg.version + "-" + hash.digest("hex").slice(0, 10);
  await build({
    ...common,
    entryPoints: [join(root, "src/sw.ts")],
    outfile: join(dist, "sw.js"),
    format: "iife",
    define: { ...common.define, __PRECACHE__: JSON.stringify([".", ...shell]), __CACHE__: JSON.stringify(cache) },
  });

  const size = (p) => statSync(join(dist, p)).size;
  console.log(`Built v${pkg.version} in ${Date.now() - started}ms: ${mainJs} ${(size(mainJs) / 1024).toFixed(0)} KB, ${mainCss} ${(size(mainCss) / 1024).toFixed(0)} KB, ${shell.length} files precached.`);
  return { mainJs, mainCss, cache };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildSite().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
