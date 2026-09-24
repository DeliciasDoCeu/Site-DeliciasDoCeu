import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
const SESSION = '__Host-dc-session', CHALLENGE = '__Host-dc-challenge', SESSION_SECONDS = 43200;
const encoder = new TextEncoder();
const fail = (message = 'Entre com sua chave de acesso para administrar a loja.', status = 401) => Object.assign(new Error(message), { status });
const json = (data, headers = {}) => Response.json(data, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
export const base64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unbase64 = (value) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
export const hash = async (value) => base64(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
const random = () => base64(crypto.getRandomValues(new Uint8Array(32)));
const now = () => Math.floor(Date.now() / 1000);
const cookie = (name, value, seconds) => `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${seconds}`;
function cookieValue(request, name) {
  const value = request.headers.get('Cookie')?.split(';').map((v) => v.trim()).find((v) => v.startsWith(name + '='))?.slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value || '') ? value : null;
}
async function session(request, env) {
  const token = cookieValue(request, SESSION);
  if (!token) return null;
  return env.DB.prepare('SELECT created_at FROM auth_sessions WHERE token_hash = ? AND expires_at > ?').bind(await hash(token), now()).first();
}
export async function authorize(request, env) {
  if (env.LOCAL_DEVELOPMENT === 'true' && ['localhost', '127.0.0.1'].includes(new URL(request.url).hostname)) return { email: 'previa@localhost' };
  if (!env.ADMIN_EMAIL || !env.DB) throw fail('O acesso ao painel ainda não foi configurado.', 503);
  if (!await session(request, env)) throw fail();
  return { email: env.ADMIN_EMAIL };
}
async function rateLimit(request, env) {
  const window = Math.floor(now() / 60);
  const key = await hash(`${request.headers.get('CF-Connecting-IP') || 'local'}:${window}`);
  await env.DB.prepare('DELETE FROM auth_limits WHERE expires_at <= ?').bind(now()).run();
  const result = await env.DB.prepare('INSERT INTO auth_limits (id, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET attempts = attempts + 1 WHERE attempts < 20').bind(key, (window + 2) * 60).run();
  if (!result.meta.changes) throw fail('Muitas tentativas. Aguarde um minuto e tente novamente.', 429);
}
async function issueSession(env) {
  const token = random();
  await env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at <= ?').bind(now()).run();
  await env.DB.prepare('INSERT INTO auth_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)').bind(await hash(token), now(), now() + SESSION_SECONDS).run();
  return cookie(SESSION, token, SESSION_SECONDS);
}
async function rememberChallenge(env, options, kind, inviteHash = '') {
  const token = random();
  await env.DB.prepare('DELETE FROM auth_challenges WHERE expires_at <= ?').bind(now()).run();
  await env.DB.prepare('INSERT INTO auth_challenges (token_hash, challenge, kind, invite_hash, expires_at) VALUES (?, ?, ?, ?, ?)').bind(await hash(token), options.challenge, kind, inviteHash, now() + 300).run();
  return json({ options }, { 'Set-Cookie': cookie(CHALLENGE, token, 300) });
}
async function consumeChallenge(request, env, kind) {
  const token = cookieValue(request, CHALLENGE);
  if (!token) throw fail('A tentativa expirou. Comece novamente.');
  // Consome a tentativa atomicamente, inclusive quando a assinatura falha.
  const saved = await env.DB.prepare('DELETE FROM auth_challenges WHERE token_hash = ? RETURNING challenge, kind, invite_hash, expires_at').bind(await hash(token)).first();
  if (!saved || saved.kind !== kind || saved.expires_at <= now()) throw fail('A tentativa expirou. Comece novamente.');
  return saved;
}
async function registrationPermission(request, env, token) {
  if (typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const inviteHash = await hash(token);
    const invite = await env.DB.prepare('SELECT token_hash FROM auth_invites WHERE token_hash = ? AND expires_at > ? AND NOT EXISTS (SELECT 1 FROM passkeys)').bind(inviteHash, now()).first();
    if (invite) return inviteHash;
  }
  const current = await session(request, env);
  if (current && current.created_at > now() - 300) return '';
  throw fail('Use o convite privado de ativação ou entre novamente para cadastrar outra chave.');
}
export async function handleAuth(request, env, readJson) {
  const url = new URL(request.url);
  if (request.method !== 'POST') throw fail('Método não permitido.', 405);
  if (url.protocol !== 'https:' || request.headers.get('Origin') !== url.origin) throw fail('Origem não autorizada.', 403);
  if (!env.ADMIN_EMAIL || !env.DB) throw fail('O acesso ao painel ainda não foi configurado.', 503);
  const input = await readJson(request);
  if (!input || typeof input !== 'object') throw fail('Dados inválidos.', 400);
  const path = url.pathname;
  if (path === '/api/auth/logout') {
    const token = cookieValue(request, SESSION);
    if (token) await env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await hash(token)).run();
    return json({ ok: true }, { 'Set-Cookie': cookie(SESSION, '', 0) });
  }
  await rateLimit(request, env);
  if (path === '/api/auth/register/options') {
    const inviteHash = await registrationPermission(request, env, input.invite);
    const { results } = await env.DB.prepare('SELECT id, transports FROM passkeys').all();
    if (results.length >= 5) throw fail('Já existem cinco chaves cadastradas.', 400);
    const options = await generateRegistrationOptions({ rpName: 'Delícias do Céu', rpID: url.hostname, userName: env.ADMIN_EMAIL, userID: encoder.encode(await hash(env.ADMIN_EMAIL.toLowerCase())), attestationType: 'none', supportedAlgorithmIDs: [-7, -257], authenticatorSelection: { residentKey: 'required', userVerification: 'required' }, excludeCredentials: results.map((row) => ({ id: row.id, transports: JSON.parse(row.transports) })) });
    return rememberChallenge(env, options, 'register', inviteHash);
  }
  if (path === '/api/auth/register/verify') {
    const challenge = await consumeChallenge(request, env, 'register');
    if (!challenge.invite_hash) await registrationPermission(request, env, null);
    let result;
    try { result = await verifyRegistrationResponse({ response: input.response, expectedChallenge: challenge.challenge, expectedOrigin: url.origin, expectedRPID: url.hostname, requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] }); }
    catch { throw fail('Não foi possível confirmar a chave. Tente novamente.'); }
    if (!result.verified) throw fail();
    const { credential } = result.registrationInfo;
    const params = [credential.id, base64(credential.publicKey), credential.counter, JSON.stringify(credential.transports || []), now()];
    const condition = challenge.invite_hash ? 'NOT EXISTS (SELECT 1 FROM passkeys) AND EXISTS (SELECT 1 FROM auth_invites WHERE token_hash = ? AND expires_at > ?)' : '(SELECT COUNT(*) FROM passkeys) < 5';
    if (challenge.invite_hash) params.push(challenge.invite_hash, now());
    const saved = await env.DB.prepare('INSERT INTO passkeys (id, public_key, counter, transports, created_at) SELECT ?, ?, ?, ?, ? WHERE ' + condition).bind(...params).run();
    if (!saved.meta.changes) throw fail('Este convite já foi utilizado ou expirou.');
    if (challenge.invite_hash) await env.DB.prepare('DELETE FROM auth_invites WHERE token_hash = ?').bind(challenge.invite_hash).run();
    return json({ ok: true }, { 'Set-Cookie': await issueSession(env) });
  }
  if (path === '/api/auth/login/options') {
    const options = await generateAuthenticationOptions({ rpID: url.hostname, userVerification: 'required', allowCredentials: [] });
    return rememberChallenge(env, options, 'login');
  }
  if (path === '/api/auth/login/verify') {
    const challenge = await consumeChallenge(request, env, 'login');
    const id = input.response?.id;
    if (typeof id !== 'string' || id.length > 2048) throw fail();
    const saved = await env.DB.prepare('SELECT id, public_key, counter, transports FROM passkeys WHERE id = ?').bind(id).first();
    if (!saved) throw fail();
    let result;
    try { result = await verifyAuthenticationResponse({ response: input.response, expectedChallenge: challenge.challenge, expectedOrigin: url.origin, expectedRPID: url.hostname, requireUserVerification: true, credential: { id: saved.id, publicKey: unbase64(saved.public_key), counter: saved.counter, transports: JSON.parse(saved.transports) } }); }
    catch { throw fail('Não foi possível confirmar sua chave de acesso. Tente novamente.'); }
    if (!result.verified) throw fail();
    const changed = await env.DB.prepare('UPDATE passkeys SET counter = ? WHERE id = ? AND counter = ?').bind(result.authenticationInfo.newCounter, id, saved.counter).run();
    if (!changed.meta.changes) throw fail('Esta tentativa já foi utilizada. Entre novamente.');
    return json({ ok: true }, { 'Set-Cookie': await issueSession(env) });
  }
  throw fail('Ação não encontrada.', 404);
}
