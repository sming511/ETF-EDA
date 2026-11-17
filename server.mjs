import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const NAVER_ETF_URL = "https://finance.naver.com/api/sise/etfItemList.nhn";
const ASSETS = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
  ["/app.js", "app.js"]
]);
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname === "/api/etf") {
      const upstream = await fetch(NAVER_ETF_URL, {
        headers: {
          Accept: "application/json,text/plain,*/*",
          Referer: "https://finance.naver.com/sise/etf.naver",
          "User-Agent": "Mozilla/5.0 ETF-Signal-Board/1.0"
        },
        cache: "no-store"
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store, max-age=0",
        "Content-Length": body.length
      });
      response.end(body);
      return;
    }

    if (url.pathname === "/health") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    const asset = ASSETS.get(url.pathname);
    if (!asset) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    const body = await readFile(join(ROOT, asset));
    response.writeHead(200, { "Content-Type": MIME[extname(asset)], "Cache-Control": "no-cache" });
    response.end(body);
  } catch (error) {
    console.error(error);
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ error: "ETF 데이터를 불러오지 못했습니다." }));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`ETF Signal Board: http://127.0.0.1:${PORT}`);
});
