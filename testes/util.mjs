// Ajudas partilhadas pelos testes.
import { createRequire } from 'node:module';
import path from 'node:path';

export const API_DEV = process.env.API_DEV ?? 'http://localhost:4100';
export const API_PROD = process.env.API_PROD ?? 'http://localhost:4101';

// O cliente Socket.IO vem das dependências do front-end
const requireCliente = createRequire(path.join(process.env.PASTA_CLIENT ?? 'client', 'package.json'));
export const { io } = requireCliente('socket.io-client');

let falhas = 0;
export function ok(condicao, mensagem) {
  console.log(`${condicao ? '  ✔' : '  ✖'} ${mensagem}`);
  if (!condicao) falhas++;
}
export function terminar() {
  if (falhas) console.log(`  ${falhas} falha(s)`);
  process.exitCode = falhas ? 1 : 0;
}

/** Pedido JSON à API. Devolve { s: estado, d: corpo, h: cabeçalhos }. */
export function cliente(base) {
  return async (caminho, { method = 'GET', body, token, headers = {} } = {}) => {
    const r = await fetch(base + '/api' + caminho, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const texto = await r.text();
    let d;
    try {
      d = texto ? JSON.parse(texto) : null;
    } catch {
      d = texto;
    }
    return { s: r.status, d, h: r.headers };
  };
}

/** Espera por um evento Socket.IO (falha ao fim de 4 s). */
export function esperar(socket, evento, ms = 4000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout à espera de ' + evento)), ms);
    socket.once(evento, (x) => {
      clearTimeout(t);
      resolve(x);
    });
  });
}

/** Espera por um evento cujo conteúdo cumpra uma condição (ignora eventos de outros pedidos). */
export function esperarQue(socket, evento, condicao, ms = 4000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(evento, ouvir);
      reject(new Error('timeout à espera de ' + evento));
    }, ms);
    function ouvir(x) {
      if (!condicao(x)) return;
      clearTimeout(t);
      socket.off(evento, ouvir);
      resolve(x);
    }
    socket.on(evento, ouvir);
  });
}

export const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
