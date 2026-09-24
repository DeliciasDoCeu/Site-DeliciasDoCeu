import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeCBOR } from '@levischuck/tiny-cbor';
import { hash, base64 } from '../worker/auth.js';
import worker from '../worker/index.js';
import { localEnvironment } from '../scripts/local-env.mjs';
const origin = 'https://painel.example.com';
const text = (value) => new TextEncoder().encode(value);
const digest = async (value) => new Uint8Array(await crypto.subtle.digest('SHA-256', value));
const join = (...parts) => new Uint8Array(Buffer.concat(parts.map((p) => Buffer.from(p))));
function setup(t) {
  const env = { ...localEnvironment(), ADMIN_EMAIL: 'owner@example.com', ASSETS: { fetch: async () => new Response('Login') } };
  t.after(env.close);
  const call = (path, data = {}, cookie = '', extra = {}) => worker.fetch(new Request(origin + path, { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(data) }), env);
  return { env, call };
}
const sessionCookie = (response) => response.headers.get('Set-Cookie')?.split(';')[0] || '';
async function authenticator() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const id = crypto.getRandomValues(new Uint8Array(32));
  const credential = { id: base64(id), rawId: base64(id), type: 'public-key', clientExtensionResults: {}, authenticatorAttachment: 'platform' };
  const rpHash = await digest(text(new URL(origin).hostname));
  return {
    async register(challenge, overrides = {}) {
      const clientDataJSON = base64(text(JSON.stringify({ type: 'webauthn.create', challenge, origin, ...overrides })));
      const publicKey = encodeCBOR(new Map([[1, 2], [3, -7], [-1, 1], [-2, new Uint8Array(Buffer.from(jwk.x, 'base64url'))], [-3, new Uint8Array(Buffer.from(jwk.y, 'base64url'))]]));
      const authData = join(rpHash, [0x45], [0, 0, 0, 0], new Uint8Array(16), [0, id.length], id, publicKey);
      const attestationObject = base64(encodeCBOR(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]])));
      return { ...credential, response: { clientDataJSON, attestationObject, transports: ['internal'] } };
    },
    async login(challenge, counter = 1, flags = 5) {
      const clientBytes = text(JSON.stringify({ type: 'webauthn.get', challenge, origin }));
      const authData = join(rpHash, [flags], [0, 0, 0, counter]);
      const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, join(authData, await digest(clientBytes))));
      const integer = (bytes) => { let n = Buffer.from(bytes); while (n.length > 1 && n[0] === 0) n = n.subarray(1); if (n[0] & 128) n = Buffer.concat([Buffer.from([0]), n]); return join([2, n.length], n); };
      const der = join(integer(raw.slice(0, 32)), integer(raw.slice(32)));
      return { ...credential, response: { clientDataJSON: base64(clientBytes), authenticatorData: base64(authData), signature: base64(join([48, der.length], der)) } };
    }
  };
}
async function invite(env) {
  const value = base64(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('INSERT INTO auth_invites (token_hash, expires_at) VALUES (?, ?)').bind(await hash(value), Math.floor(Date.now() / 1000) + 600).run();
  return value;
}
test('chave real: convite único, assinatura, sessão, acesso privado e logout', async (t) => {
  const { env, call } = setup(t), key = await authenticator(), token = await invite(env);
  assert.equal((await call('/api/auth/register/options')).status, 401);
  const start = await call('/api/auth/register/options', { invite: token });
  assert.equal(start.status, 200);
  const options = (await start.json()).options;
  assert.equal(options.authenticatorSelection.userVerification, 'required');
  const credential = await key.register(options.challenge);
  const registered = await call('/api/auth/register/verify', { response: credential }, sessionCookie(start));
  assert.equal(registered.status, 200, await registered.clone().text());
  assert.match(registered.headers.get('Set-Cookie'), /Secure; HttpOnly; SameSite=Strict/);
  const ownerCookie = sessionCookie(registered);
  assert.equal((await worker.fetch(new Request(origin + '/api/admin/catalog', { headers: { Cookie: ownerCookie } }), env)).status, 200);
  assert.equal((await call('/api/auth/register/options', { invite: token })).status, 401);
  assert.equal((await call('/api/auth/register/verify', { response: credential }, sessionCookie(start))).status, 401);
  assert.equal((await call('/api/auth/logout', {}, ownerCookie)).status, 200);
  assert.equal((await worker.fetch(new Request(origin + '/api/admin/catalog', { headers: { Cookie: ownerCookie } }), env)).status, 401);
  const login = await call('/api/auth/login/options');
  const assertion = await key.login((await login.json()).options.challenge);
  const result = await call('/api/auth/login/verify', { response: assertion }, sessionCookie(login));
  assert.equal(result.status, 200, await result.clone().text());
  assert.equal((await call('/api/auth/login/verify', { response: assertion }, sessionCookie(login))).status, 401);
});
test('recusa origem, convite expirado, assinatura adulterada e ausência de biometria/PIN', async (t) => {
  const { env, call } = setup(t), key = await authenticator(), token = await invite(env);
  assert.equal((await call('/api/auth/register/options', { invite: token }, '', { Origin: 'https://evil.example' })).status, 403);
  const start = await call('/api/auth/register/options', { invite: token });
  const credential = await key.register((await start.json()).options.challenge);
  assert.equal((await call('/api/auth/register/verify', { response: credential }, sessionCookie(start))).status, 200);
  for (const kind of ['signature', 'verification', 'challenge']) {
    const response = await call('/api/auth/login/options');
    const challenge = (await response.json()).options.challenge;
    const assertion = await key.login(kind === 'challenge' ? 'wrong-challenge' : challenge, 2, kind === 'verification' ? 1 : 5);
    if (kind === 'signature') assertion.response.signature = base64(new Uint8Array(72));
    assert.equal((await call('/api/auth/login/verify', { response: assertion }, sessionCookie(response))).status, 401);
  }
  await env.DB.prepare('DELETE FROM passkeys').run();
  const expired = await invite(env);
  await env.DB.prepare('UPDATE auth_invites SET expires_at = 0').run();
  assert.equal((await call('/api/auth/register/options', { invite: expired })).status, 401);
});
test('limite de tentativas, sessão expirada e cookies falsos não liberam administração', async (t) => {
  const { env, call } = setup(t);
  for (let i = 0; i < 20; i++) assert.equal((await call('/api/auth/login/options')).status, 200);
  assert.equal((await call('/api/auth/login/options')).status, 429);
  const token = base64(crypto.getRandomValues(new Uint8Array(32)));
  await env.DB.prepare('INSERT INTO auth_sessions VALUES (?, 0, 1)').bind(await hash(token)).run();
  const check = (cookie) => worker.fetch(new Request(origin + '/api/admin/catalog', { headers: { Cookie: cookie } }), env);
  assert.equal((await check('__Host-dc-session=' + token)).status, 401);
  assert.equal((await check('__Host-dc-session=' + 'a'.repeat(43))).status, 401);
});
