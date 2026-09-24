import { authorize, handleAuth } from "./auth.js";
import { validateCatalog, publicCatalog, quoteCart } from "../js/catalog-core.js";
import { seedCatalog } from "../js/catalog-seed.js";

const IMAGE_LIMIT = 750000;
const STORAGE_LIMIT = 100000000; // Limite conservador deste painel, independente da conta.
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const error = (message, status = 400) => Object.assign(new Error(message), { status });
const imageId = (path) => /^\/media\/([a-f0-9-]{36})$/.exec(path)?.[1];
const usedImages = (items) => new Set(items.map((item) => imageId(item.image)).filter(Boolean));
async function body(request, limit = 200000) {
  if (Number(request.headers.get("content-length")) > limit) throw error("O arquivo enviado é muito grande.", 413);
  const chunks = [];
  let size = 0;
  const reader = request.body?.getReader();
  if (!reader) throw error("Envie os dados do formulário.");
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw error("O arquivo enviado é muito grande.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
async function readJson(request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) throw error("Formato de dados inválido.", 415);
  try { return JSON.parse(new TextDecoder().decode(await body(request))); }
  catch (cause) { if (cause.status) throw cause; throw error("Dados inválidos."); }
}
async function catalog(env) {
  if (!env.DB || !env.PHOTOS) throw error("O catálogo está sendo configurado. Tente novamente em instantes.", 503);
  let row = await env.DB.prepare("SELECT items, revision FROM catalog WHERE id = 1").first();
  if (!row) {
    await env.DB.prepare("INSERT OR IGNORE INTO catalog (id, items) VALUES (1, ?)").bind(JSON.stringify(seedCatalog)).run();
    row = await env.DB.prepare("SELECT items, revision FROM catalog WHERE id = 1").first();
  }
  return { items: JSON.parse(row.items), revision: row.revision };
}
async function storage(env, items) {
  const { results } = await env.DB.prepare("SELECT id, bytes, created_at, deleting FROM images").all();
  const used = usedImages(items);
  const bytes = results.reduce((sum, image) => sum + image.bytes, 0);
  // Arquivos enviados recentemente podem estar em um formulário ainda não salvo.
  const unused = results.filter((image) => !used.has(image.id) && new Date(image.created_at + "Z").getTime() < Date.now() - 86400000);
  return { bytes, limit: STORAGE_LIMIT, percent: Math.round(bytes / STORAGE_LIMIT * 100), imageCount: results.length, unusedCount: unused.length, unusedBytes: unused.reduce((sum, image) => sum + image.bytes, 0), unused };
}
function verifyOrigin(request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) throw error("Origem da alteração não autorizada.", 403);
}
function sniff(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) return "image/png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (path.startsWith('/api/auth/')) return handleAuth(request, env, readJson);
  const loginAssets = { '/auth/login': '/login.html', '/auth/login.js': '/login.js', '/auth/admin.css': '/admin.css', '/auth/passkeys.js': '/passkeys.js' };
  if (loginAssets[path] && request.method === 'GET') return serveAsset(request, env, loginAssets[path]);
  if (request.method === "OPTIONS" && path === "/api/quote") return new Response(null, { status: 204 });
  if (path === "/api/catalog" && request.method === "GET") {
    const current = await catalog(env);
    return json({ items: publicCatalog(current.items), revision: current.revision });
  }
  if (path === "/api/quote" && request.method === "POST") {
    const current = await catalog(env);
    const input = await readJson(request);
    try { return json({ ...quoteCart(current.items, input.lines), revision: current.revision }); }
    catch (cause) { throw error(cause.message); }
  }
  const media = imageId(path);
  if (media && ["GET", "HEAD"].includes(request.method)) {
    const image = await env.PHOTOS.getWithMetadata(media, { type: "arrayBuffer" });
    if (!image.value) return new Response("Foto indisponível", { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(request.method === "HEAD" ? null : image.value, { headers: {
      "Content-Type": image.metadata.mime, "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff", "Content-Length": String(image.value.byteLength)
    } });
  }
  if (path === "/") return Response.redirect(url.origin + "/admin/", 302);
  if (!path.startsWith("/admin/") && !path.startsWith("/api/admin/")) return json({ error: "Página não encontrada." }, 404);
  let identity;
  try { identity = await authorize(request, env); }
  catch (cause) {
    if (path.startsWith('/admin/') && cause.status === 401) return Response.redirect(url.origin + '/auth/login', 302);
    throw cause;
  }
  if (path.startsWith("/api/admin/")) {
    if (!["GET", "PUT", "POST"].includes(request.method)) return json({ error: "Método não permitido." }, 405);
    if (request.method !== "GET") verifyOrigin(request);
    const current = await catalog(env);
    if (path === "/api/admin/catalog" && request.method === "GET") {
      const { unused, ...usage } = await storage(env, current.items);
      return json({ ...current, storage: usage, email: identity.email, local: env.LOCAL_DEVELOPMENT === "true" && url.hostname === "127.0.0.1" });
    }
    if (path === "/api/admin/catalog" && request.method === "PUT") {
      const input = await readJson(request);
      let items;
      try { items = validateCatalog(input.items); } catch (cause) { throw error(cause.message); }
      if (!Number.isInteger(input.revision) || input.revision !== current.revision) throw error("O catálogo mudou em outra aba. Recarregue antes de salvar para preservar as alterações.", 409);
      const refs = [...usedImages(items)];
      const conditions = [];
      const bindings = [JSON.stringify(items), input.revision];
      for (const id of refs) {
        conditions.push("EXISTS (SELECT 1 FROM images WHERE id = ? AND deleting = 0)");
        bindings.push(id);
      }
      const statement = "UPDATE catalog SET items = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1 AND revision = ?" + (conditions.length ? " AND " + conditions.join(" AND ") : "");
      const saved = await env.DB.prepare(statement).bind(...bindings).run();
      if (!saved.meta.changes) throw error("O catálogo mudou ou uma foto deixou de estar disponível. Recarregue e tente novamente.", 409);
      return json({ items, revision: current.revision + 1 });
    }
    if (path === "/api/admin/images" && request.method === "POST") {
      const bytes = await body(request, IMAGE_LIMIT);
      const mime = sniff(bytes);
      if (!mime || mime !== request.headers.get("Content-Type")) throw error("Envie uma foto JPEG, PNG ou WebP válida.");
      const id = crypto.randomUUID();
      const reserved = await env.DB.prepare("INSERT INTO images (id, mime, bytes) SELECT ?, ?, ? WHERE (SELECT COALESCE(SUM(bytes), 0) FROM images) + ? <= ?").bind(id, mime, bytes.byteLength, bytes.byteLength, STORAGE_LIMIT).run();
      if (!reserved.meta.changes) throw error("O espaço reservado às fotos está cheio. Limpe arquivos sem uso antes de enviar outra foto.", 413);
      try { await env.PHOTOS.put(id, bytes, { metadata: { mime } }); }
      catch (cause) { await env.DB.prepare("DELETE FROM images WHERE id = ?").bind(id).run(); throw cause; }
      return json({ image: `/media/${id}`, bytes: bytes.byteLength }, 201);
    }
    if (path === "/api/admin/images/cleanup" && request.method === "POST") {
      const input = await readJson(request);
      if (input.confirm !== true) throw error("Confirme a limpeza das fotos sem uso.");
      const usage = await storage(env, current.items);
      let removed = 0;
      for (const image of usage.unused) {
        // Bloqueia novas referências durante a exclusão e revalida atomicamente o uso atual.
        const marked = await env.DB.prepare("UPDATE images SET deleting = 1 WHERE id = ? AND NOT EXISTS (SELECT 1 FROM catalog, json_each(catalog.items) p WHERE json_extract(p.value, '$.image') = ?)").bind(image.id, `/media/${image.id}`).run();
        if (!marked.meta.changes) continue;
        try {
          await env.PHOTOS.delete(image.id);
          await env.DB.prepare("DELETE FROM images WHERE id = ? AND deleting = 1").bind(image.id).run();
          removed++;
        } catch (cause) { await env.DB.prepare("UPDATE images SET deleting = 0 WHERE id = ?").bind(image.id).run(); throw cause; }
      }
      return json({ removed });
    }
    return json({ error: "Ação não encontrada." }, 404);
  }
  if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
  return serveAsset(request, env, path === '/admin/' ? '/index.html' : path.slice('/admin'.length));
}
async function serveAsset(request, env, path) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = path;
  const asset = await env.ASSETS.fetch(new Request(assetUrl, request));
  const headers = new Headers(asset.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://delicias-do-ceu.pages.dev; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return new Response(asset.body, { status: asset.status, headers });
}

export default {
  async fetch(request, env) {
    let response;
    try { response = await handle(request, env); }
    catch (cause) {
      const status = cause.status || (cause instanceof SyntaxError ? 400 : 500);
      response = json({ error: status < 500 || status === 503 ? cause.message : "Não foi possível concluir a operação. Tente novamente." }, status);
    }
    const path = new URL(request.url).pathname;
    if (["/api/catalog", "/api/quote"].includes(path) || path.startsWith("/media/")) {
      const headers = new Headers(response.headers);
      const origin = request.headers.get("Origin");
      const isStorePreview = /^https:\/\/[a-z0-9-]+\.delicias-do-ceu\.pages\.dev$/.test(origin || '');
      if (origin === env.STORE_ORIGIN || isStorePreview) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type");
      }
      headers.set("Vary", "Origin");
      response = new Response(response.body, { status: response.status, headers });
    }
    return response;
  }
};
