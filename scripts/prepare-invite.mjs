import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, createHash } from 'node:crypto';

// Prepara arquivos privados; a importação remota do SQL é um passo explícito separado.
const target = new URL(process.argv[2]);
if (target.protocol !== 'https:' || target.pathname !== '/' || target.search || target.hash) throw new Error('Informe apenas a origem HTTPS do painel.');
const root = path.resolve(import.meta.dirname, '..');
const directory = path.join(root, '.local');
await fs.mkdir(directory, { recursive: true });
const token = randomBytes(32).toString('base64url');
const tokenHash = createHash('sha256').update(token).digest('base64url');
const expires = Math.floor(Date.now() / 1000) + 86400;
const sql = `INSERT INTO auth_invites (token_hash, expires_at) SELECT '${tokenHash}', ${expires} WHERE NOT EXISTS (SELECT 1 FROM passkeys);\nSELECT COUNT(*) AS convite_criado FROM auth_invites WHERE token_hash = '${tokenHash}';\n`;
await fs.writeFile(path.join(directory, 'invite.sql'), sql);
const link = `${target.origin}/auth/login#convite=${token}`;
await fs.writeFile(path.join(directory, 'ativar-painel.txt'), `ATIVAÇÃO PRIVADA — DELÍCIAS DO CÉU\n\nAbra este link somente no dispositivo da dona e escolha Criar minha chave de acesso:\n\n${link}\n\nVálido até ${new Date(expires * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (horário de Brasília), depois de importar invite.sql. Uso único. Não publique ou compartilhe com clientes.\n\nDepois da ativação, use ${target.origin}/admin/\n`);
console.log('Convite preparado em .local/ativar-painel.txt. Importe .local/invite.sql no D1 e confira convite_criado = 1 antes de entregar o link.');
