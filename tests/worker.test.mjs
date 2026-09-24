import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { localEnvironment } from '../scripts/local-env.mjs';
import { fixture } from './fixtures.mjs';
const origin = 'http://127.0.0.1:8766';
function setup(t) {
  const env = { ...localEnvironment(), LOCAL_DEVELOPMENT: 'true', STORE_ORIGIN: 'https://store.example.com', ASSETS: { fetch: async () => new Response('admin') } };
  t.after(env.close);
  const call = (path, method = 'GET', data, headers = {}) => worker.fetch(new Request(origin + path, { method, headers: { Origin: origin, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers }, body: data === undefined ? undefined : JSON.stringify(data) }), env);
  return { env, call };
}
test('persiste catálogo, impede sobrescrita concorrente e confirma pedido sem baixar estoque', async (t) => {
  const { call } = setup(t);
  const start = await (await call('/api/admin/catalog')).json();
  assert.equal(start.items.length, 2);
  const save = await call('/api/admin/catalog', 'PUT', { revision: start.revision, items: fixture() });
  assert.equal(save.status, 200);
  assert.equal((await call('/api/admin/catalog', 'PUT', { revision: start.revision, items: [] })).status, 409);
  const quote = await call('/api/quote', 'POST', { lines: [{ productId: 'kit', quantity: 2 }], totalCents: 1 });
  assert.equal((await quote.json()).totalCents, 4000);
  const current = await (await call('/api/admin/catalog')).json();
  assert.equal(current.items[1].variants[0].stock, 3);
  assert.equal(current.items[2].stock, 4);
  assert.equal((await call('/api/quote', 'POST', { lines: [{ productId: 'kit', quantity: 4 }] })).status, 400);
});
test('visitantes, origem externa e configuração incompleta não alteram catálogo', async (t) => {
  const { env, call } = setup(t);
  assert.equal((await call('/api/admin/catalog', 'PUT', { items: [], revision: 1 }, { Origin: 'https://evil.example' })).status, 403);
  // Nem a opção de desenvolvimento pode liberar uma URL pública.
  assert.equal((await worker.fetch(new Request('https://app.example/admin/'), env)).status, 503);
  env.LOCAL_DEVELOPMENT = 'false';
  Object.assign(env, { ADMIN_EMAIL: 'owner@example.com' });
  for (const path of ['/api/admin/catalog', '/admin/', '/admin/admin.js']) {
    assert.equal((await call(path, 'GET', undefined, { 'Cf-Access-Authenticated-User-Email': 'owner@example.com' })).status, path.startsWith('/admin/') ? 302 : 401);
  }
  assert.equal((await call('/api/catalog')).status, 200);
  assert.equal((await call('/api/catalog', 'GET', undefined, { Origin: env.STORE_ORIGIN })).headers.get('Access-Control-Allow-Origin'), env.STORE_ORIGIN);
  assert.equal((await call('/api/catalog', 'GET', undefined, { Origin: 'https://evil.example' })).headers.get('Access-Control-Allow-Origin'), null);
});
test('upload, limite, referências e limpeza preservam fotos de produtos inativos e envios recentes', async (t) => {
  const { env, call } = setup(t);
  const upload = async () => {
    const response = await worker.fetch(new Request(origin + '/api/admin/images', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'image/jpeg' }, body: new Uint8Array([255, 216, 255, 0]) }), env);
    assert.equal(response.status, 201);
    return (await response.json()).image;
  };
  const used = await upload(), unused = await upload(), recent = await upload();
  const initial = await (await call('/api/admin/catalog')).json();
  const items = fixture(); items[0].image = used; items[0].active = false;
  assert.equal((await call('/api/admin/catalog', 'PUT', { revision: initial.revision, items })).status, 200);
  await env.DB.prepare("UPDATE images SET created_at = datetime('now', '-2 days') WHERE id != ?").bind(recent.split('/').pop()).run();
  const cleanup = await call('/api/admin/images/cleanup', 'POST', { confirm: true });
  assert.equal((await cleanup.json()).removed, 1);
  assert.equal((await call(used)).status, 200);
  assert.equal((await call(recent)).status, 200);
  assert.equal((await call(unused)).status, 404);
  const current = await (await call('/api/admin/catalog')).json();
  items[0].image = unused;
  assert.equal((await call('/api/admin/catalog', 'PUT', { revision: current.revision, items })).status, 409);
  await env.DB.prepare('UPDATE images SET bytes = 100000000 WHERE id = ?').bind(recent.split('/').pop()).run();
  const full = await worker.fetch(new Request(origin + '/api/admin/images', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'image/jpeg' }, body: new Uint8Array([255, 216, 255, 0]) }), env);
  assert.equal(full.status, 413);
});
