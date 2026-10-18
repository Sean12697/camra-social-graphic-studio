// A small static server for dist/ that applies the same headers as production
// (it reads dist/_headers, the file Cloudflare uses), so CSP and caching are
// tested locally exactly as deployed.
//
//   node scripts/serve.mjs            serve dist/ on http://localhost:8080
//   node scripts/serve.mjs --watch    rebuild on changes to src/, public/, assets/ or seeds/
//   node scripts/serve.mjs --port 4173   (or PORT=4173)

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync, watch } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const argPort = process.argv.indexOf("--port");
const port = Number(argPort > -1 ? process.argv[argPort + 1] : process.env.PORT || 8080);
const host = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".zip": "application/zip",
  ".ics": "text/calendar; charset=utf-8",
};

// Parses Cloudflare's _headers format: a path pattern line, then indented
// "Name: value" lines. Supports * wildcards.
function loadHeaders() {
  const file = join(dist, "_headers");
  if (!existsSync(file)) return [];
  const rules = [];
  let cur = null;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      const re = new RegExp("^" + line.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
      cur = { re, headers: [] };
      rules.push(cur);
    } else if (cur) {
      const i = line.indexOf(":");
      cur.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
    }
  }
  return rules;
}

export function startServer(opts = {}) {
  const p = opts.port ?? port;
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(dist, path));
    if (!file.startsWith(dist) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
      return;
    }
    const headers = { "content-type": TYPES[extname(file)] || "application/octet-stream" };
    for (const rule of loadHeaders()) if (rule.re.test(url.pathname)) for (const [k, v] of rule.headers) headers[k.toLowerCase()] = v;
    res.writeHead(200, headers);
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(p, opts.host ?? host, () => resolve(server)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { buildSite } = await import("./build.mjs");
  const isWatch = process.argv.includes("--watch");
  if (isWatch || !existsSync(join(dist, "index.html"))) await buildSite();
  await startServer();
  console.log(`Serving dist/ on http://${host}:${port}` + (isWatch ? " (rebuilding on change)" : ""));
  if (isWatch) {
    let timer = null;
    const rebuild = () => {
      clearTimeout(timer);
      timer = setTimeout(() => buildSite().catch((e) => console.error(e.message)), 120);
    };
    for (const dir of ["src", "public", "assets", "seeds"]) if (existsSync(join(root, dir))) watch(join(root, dir), { recursive: true }, rebuild);
  }
}
