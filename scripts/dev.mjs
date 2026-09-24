import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import worker from "../worker/index.js";
import { localEnvironment } from "./local-env.mjs";

const root = path.resolve(import.meta.dirname, "..");
const port = Number(process.env.PORT || 8766);
const origin = `http://127.0.0.1:${port}`;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".webp": "image/webp" };
async function asset(request, base) {
  let pathname = decodeURIComponent(new URL(request.url).pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  const target = path.resolve(base, "." + pathname);
  if (!target.startsWith(base + path.sep)) return new Response(null, { status: 403 });
  try {
    const bytes = await fs.readFile(target);
    return new Response(bytes, { headers: { "Content-Type": types[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" } });
  } catch { return new Response("Página não encontrada", { status: 404 }); }
}
const env = { ...localEnvironment(path.join(root, ".local", "preview")), LOCAL_DEVELOPMENT: "true", STORE_ORIGIN: origin, ASSETS: { fetch: (request) => asset(request, path.join(root, "dist-admin")) } };
const server = http.createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, origin);
    const request = new Request(url, { method: incoming.method, headers: incoming.headers, ...(["GET", "HEAD"].includes(incoming.method) ? {} : { body: incoming, duplex: "half" }) });
    const isApi = url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/") || url.pathname.startsWith("/admin/") || url.pathname.startsWith('/auth/');
    const response = isApi ? await worker.fetch(request, env) : await asset(request, path.join(root, "dist"));
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (cause) { console.error(cause); outgoing.writeHead(500); outgoing.end("Falha na prévia"); }
});
server.listen(port, "127.0.0.1", () => console.log(`Prévia local: ${origin}\nPainel local: ${origin}/admin/\nDados da prévia separados da loja publicada.`));
process.on("SIGINT", () => { server.close(); env.close(); process.exit(0); });
