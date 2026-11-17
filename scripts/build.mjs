import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(SCRIPT_DIR);
const OUTPUT = join(ROOT, "dist", "server");
const [html, css, js] = await Promise.all([
  readFile(join(ROOT, "index.html"), "utf8"),
  readFile(join(ROOT, "styles.css"), "utf8"),
  readFile(join(ROOT, "app.js"), "utf8")
]);

const assets = JSON.stringify({
  "/": { body: html, type: "text/html; charset=utf-8" },
  "/index.html": { body: html, type: "text/html; charset=utf-8" },
  "/styles.css": { body: css, type: "text/css; charset=utf-8" },
  "/app.js": { body: js, type: "text/javascript; charset=utf-8" }
});

const worker = `const ASSETS = ${assets};
const NAVER_ETF_URL = "https://finance.naver.com/api/sise/etfItemList.nhn";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/api/etf") {
      try {
        const upstream = await fetch(NAVER_ETF_URL, {
          headers: {
            "Accept": "application/json,text/plain,*/*",
            "Referer": "https://finance.naver.com/sise/etf.naver",
            "User-Agent": "Mozilla/5.0 ETF-Signal-Board/1.0"
          },
          cf: { cacheTtl: 0, cacheEverything: false }
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": "application/octet-stream",
            "Cache-Control": "no-store, max-age=0",
            "X-Content-Type-Options": "nosniff"
          }
        });
      } catch {
        return Response.json({ error: "ETF 데이터를 불러오지 못했습니다." }, { status: 502 });
      }
    }

    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    const asset = ASSETS[url.pathname];
    if (!asset) return new Response("Not found", { status: 404 });
    return new Response(asset.body, {
      headers: {
        "Content-Type": asset.type,
        "Cache-Control": url.pathname === "/" ? "no-cache" : "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin"
      }
    });
  }
};
`;

await mkdir(OUTPUT, { recursive: true });
await writeFile(join(OUTPUT, "index.js"), worker, "utf8");
console.log("Built dist/server/index.js");
