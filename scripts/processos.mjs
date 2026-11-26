// Ajudas para gerir processos filhos (usado pelo `npm run dev` e pelo `npm test`).
import { spawnSync } from 'node:child_process';
import net from 'node:net';

/**
 * Termina um processo E todos os seus filhos.
 * No Windows, `child.kill()` num processo lançado com `shell: true` só fecha o cmd.exe
 * e deixa o Node (a API) a correr órfão — por isso usamos `taskkill /T`.
 */
export function terminarArvore(filho) {
  if (!filho || filho.exitCode !== null || !filho.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-filho.pid, 'SIGTERM'); // grupo de processos (requer detached: true)
    } catch {
      filho.kill('SIGTERM');
    }
  }
}

/** Confirma que uma porta TCP está livre antes de arrancar um servidor nela. */
export function portaLivre(porta) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(porta);
  });
}
