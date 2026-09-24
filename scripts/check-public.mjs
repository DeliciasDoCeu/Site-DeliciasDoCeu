import assert from 'node:assert/strict';
const origin = process.argv[2];
if (!origin?.startsWith('https://')) throw new Error('Informe a origem HTTPS do painel.');
const request = (path, options = {}) => fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(20000), ...options });
const post = (path, input, source = origin) => request(path, { method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
const catalog = await request('/api/catalog', { headers: { Origin: 'https://delicias-do-ceu.pages.dev' } });
assert.equal(catalog.status, 200);
assert.equal(catalog.headers.get('access-control-allow-origin'), 'https://delicias-do-ceu.pages.dev');
const data = await catalog.json();
assert.ok(Array.isArray(data.items));
console.log(`Catálogo público: ${data.items.length} item(ns), revisão ${data.revision}.`);
assert.equal((await request('/api/admin/catalog')).status, 401);
assert.equal((await post('/api/admin/catalog', { items: [], revision: data.revision })).status, 401);
const admin = await request('/admin/');
assert.equal(admin.status, 302);
assert.equal(admin.headers.get('location'), origin + '/auth/login');
assert.equal((await request('/auth/login')).status, 200);
for (const file of ['login.js', 'admin.css', 'passkeys.js']) assert.equal((await request('/auth/' + file)).status, 200);
assert.equal((await post('/api/auth/register/options', {})).status, 401);
assert.equal((await post('/api/auth/login/options', {}, 'https://example.com')).status, 403);
console.log('Login disponível; cadastro sem convite, escrita sem sessão e origem externa bloqueados.');
const sample = data.items.find((item) => item.kind === 'product' && !item.variants.length && item.stock !== 0);
if (sample) {
  const quote = await post('/api/quote', { lines: [{ productId: sample.id, quantity: 1 }], totalCents: 1 }, 'https://delicias-do-ceu.pages.dev');
  assert.equal(quote.status, 200);
  assert.equal((await quote.json()).totalCents, sample.salePriceCents ?? sample.priceCents);
  assert.equal((await post('/api/quote', { lines: [{ productId: sample.id, quantity: 10000 }] })).status, 400);
  console.log('Preço calculado no servidor e quantidade inválida bloqueada. Estoque preservado.');
}
