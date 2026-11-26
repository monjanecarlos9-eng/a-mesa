// `npm test` — corre os testes automáticos contra um servidor real, numa base de dados temporária.
//   1. Cria um PostgreSQL temporário (apagado no fim) — não mexe nos teus dados de server/.pgdata
//   2. Aplica as migrações e os dados de exemplo
//   3. Arranca duas APIs: uma em modo desenvolvimento e outra em modo PRODUÇÃO (base de dados vazia)
//   4. Corre os ficheiros *.test.mjs e mostra o resultado
//
// Na CI (GitHub Actions) usa-se um PostgreSQL que já existe: TESTES_PG_URL=postgresql://utilizador:senha@host:5432
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { portaLivre, terminarArvore } from '../scripts/processos.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = path.join(raiz, 'server');
const PORTA_DB = 5434;
const PORTA_DEV = 4100;
const PORTA_PROD = 4101;
const CODIGO = crypto.randomBytes(12).toString('hex');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'a-mesa-testes-'));
const PG_EXTERNO = (process.env.TESTES_PG_URL ?? '').replace(/\/$/, '');
const urlDb = (nome) => `${PG_EXTERNO || `postgresql://postgres:postgres@localhost:${PORTA_DB}`}/${nome}?schema=public`;

// Sem PostgreSQL externo, cria um temporário (a biblioteca só é carregada nesse caso)
const pg = PG_EXTERNO
  ? null
  : new (await import('embedded-postgres')).default({
      databaseDir: pasta,
      user: 'postgres',
      password: 'postgres',
      port: PORTA_DB,
      persistent: false,
      postgresFlags: ['-c', 'listen_addresses=localhost'],
      onLog: () => {},
    });

const servidores = [];
async function limpar(codigo) {
  for (const s of servidores) terminarArvore(s);
  await pg?.stop().catch(() => {});
  fs.rmSync(pasta, { recursive: true, force: true });
  process.exit(codigo);
}
process.on('SIGINT', () => limpar(130));

function correr(cmd, env) {
  const r = spawnSync(cmd, { cwd: server, env: { ...process.env, ...env }, shell: true, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`✖ Falhou: ${cmd}\n${r.stdout}\n${r.stderr}`);
    return limpar(1);
  }
}

async function arrancarApi(porta, env) {
  const p = spawn('npx tsx src/index.ts', {
    cwd: server,
    shell: true,
    env: { ...process.env, PORT: String(porta), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  let log = '';
  p.stdout.on('data', (d) => (log += d));
  p.stderr.on('data', (d) => (log += d));
  servidores.push(p);
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`http://localhost:${porta}/api/saude`)).ok) return () => log;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(`✖ A API na porta ${porta} não arrancou:\n${log}`);
  return limpar(1);
}

for (const porta of PG_EXTERNO ? [PORTA_DEV, PORTA_PROD] : [PORTA_DB, PORTA_DEV, PORTA_PROD]) {
  if (!(await portaLivre(porta))) {
    console.error(`✖ A porta ${porta} está ocupada (talvez por testes anteriores). Fecha esse processo e tenta de novo.`);
    process.exit(1);
  }
}

console.log('🐘 A preparar a base de dados temporária…');
if (pg) {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('a_mesa_testes');
  await pg.createDatabase('a_mesa_vazia');
} // com TESTES_PG_URL, o "prisma migrate deploy" cria as bases de dados se não existirem
correr('npx prisma migrate deploy', { DATABASE_URL: urlDb('a_mesa_testes') });
correr('npx prisma db seed', { DATABASE_URL: urlDb('a_mesa_testes') });
correr('npx prisma migrate deploy', { DATABASE_URL: urlDb('a_mesa_vazia') });

console.log('🚀 A arrancar as APIs de teste…');
const segredo = () => crypto.randomBytes(40).toString('hex');
await arrancarApi(PORTA_DEV, { DATABASE_URL: urlDb('a_mesa_testes'), JWT_SECRET: segredo(), NODE_ENV: 'development', FRONTEND_URL: '', SMTP_URL: '' });
const logProd = await arrancarApi(PORTA_PROD, {
  DATABASE_URL: urlDb('a_mesa_vazia'),
  JWT_SECRET: segredo(),
  NODE_ENV: 'production',
  FRONTEND_URL: 'https://tasca.exemplo.pt',
  CODIGO_CONFIGURACAO: CODIGO,
  SMTP_URL: '',
  CLOUDINARY_URL: '',
});

const ficheiros = fs
  .readdirSync(path.join(raiz, 'testes'))
  .filter((f) => f.endsWith('.test.mjs'))
  .sort();

let falhas = 0;
for (const f of ficheiros) {
  console.log(`\n━━ ${f} ━━`);
  const r = spawnSync(process.execPath, [path.join(raiz, 'testes', f)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      API_DEV: `http://localhost:${PORTA_DEV}`,
      API_PROD: `http://localhost:${PORTA_PROD}`,
      CODIGO_CONFIGURACAO: CODIGO,
      PASTA_CLIENT: path.join(raiz, 'client'),
    },
  });
  if (r.status !== 0) falhas++;
}

if (process.argv.includes('--log')) console.log('\n--- registo da API de produção ---\n' + logProd());
console.log(falhas ? `\n❌ ${falhas} ficheiro(s) com falhas` : '\n✅ Todos os testes passaram');
await limpar(falhas ? 1 : 0);
