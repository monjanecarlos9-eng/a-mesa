// Arranca tudo para desenvolvimento com um só comando: `npm run dev`
//   1. PostgreSQL local (server/.pgdata)  2. migrações (+ dados de exemplo na 1.ª vez)
//   3. API em http://localhost:4000       4. site em http://localhost:5180
// Se já tiveres outra base de dados no server/.env: `npm run dev -- --sem-db`
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iniciarDbLocal, URL_DB_LOCAL } from './scripts/db-local.mjs';
import { portaLivre, terminarArvore } from './scripts/processos.mjs';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(raiz, 'server');
const client = path.join(raiz, 'client');
const semDb = process.argv.includes('--sem-db');

for (const [porta, o] of [[4000, 'a API'], [5180, 'o site']]) {
  if (!(await portaLivre(porta))) {
    console.error(`✖ A porta ${porta} (${o}) já está ocupada — o projeto já está a correr noutra janela?`);
    process.exit(1);
  }
}

const envServidor = { ...process.env };
let pg = null;
let filhos = [];

async function sair(codigo = 0) {
  for (const f of filhos) terminarArvore(f);
  if (pg) await pg.stop().catch(() => {});
  process.exit(codigo);
}
process.on('SIGINT', () => sair(0));
process.on('SIGTERM', () => sair(0));

if (!semDb) {
  process.stdout.write('🐘 A iniciar o PostgreSQL local… ');
  const r = await iniciarDbLocal();
  pg = r.pg;
  envServidor.DATABASE_URL = URL_DB_LOCAL;
  console.log('pronto.');

  const migrar = spawnSync('npx prisma migrate deploy', { cwd: server, env: envServidor, shell: true, stdio: 'inherit' });
  if (migrar.status !== 0) await sair(1);
  if (r.novo) spawnSync('npx prisma db seed', { cwd: server, env: envServidor, shell: true, stdio: 'inherit' });
}

filhos = [
  spawn('npx tsx watch src/index.ts', { cwd: server, env: envServidor, shell: true, stdio: 'inherit', detached: process.platform !== 'win32' }),
  spawn('npx vite --host', { cwd: client, env: process.env, shell: true, stdio: 'inherit', detached: process.platform !== 'win32' }),
];
