// PostgreSQL local "embutido": não é preciso instalar nada. Os dados ficam em server/.pgdata.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const pasta = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', '.pgdata');
export const PORTA_DB = 5433;
export const URL_DB_LOCAL = `postgresql://postgres:postgres@localhost:${PORTA_DB}/a_mesa?schema=public`;

export async function iniciarDbLocal() {
  const novo = !fs.existsSync(path.join(pasta, 'PG_VERSION'));
  const pg = new EmbeddedPostgres({
    databaseDir: pasta,
    user: 'postgres',
    password: 'postgres',
    port: PORTA_DB,
    persistent: true,
    // Só aceita ligações deste computador (nunca da rede Wi-Fi), mesmo que a configuração por omissão mude.
    postgresFlags: ['-c', 'listen_addresses=localhost'],
    onLog: () => {},
  });
  if (novo) await pg.initialise();
  await pg.start();
  if (novo) await pg.createDatabase('a_mesa');
  return { pg, novo };
}

// Executado diretamente: `npm run db:local` (fica a correr até Ctrl+C)
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { pg } = await iniciarDbLocal();
  console.log(`🐘 PostgreSQL local em ${URL_DB_LOCAL}  (Ctrl+C para parar)`);
  const parar = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on('SIGINT', parar);
  process.on('SIGTERM', parar);
  setInterval(() => {}, 1 << 30);
}
