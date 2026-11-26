import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verificarToken } from './middleware/auth';
import { prisma } from './prisma';

/**
 * Salas:
 *  - "equipa"          → cozinha e admin (recebem novo_pedido, estado_atualizado, chamar_empregado)
 *  - "pedido:<id>"     → o cliente que fez esse pedido (recebe estado_atualizado)
 * Eventos globais: "menu_atualizado" (para todos os menus abertos se atualizarem).
 */
let io: Server | null = null;

export function iniciarSocket(servidor: HttpServer, origens: string[] | boolean) {
  io = new Server(servidor, { cors: { origin: origens } });

  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token;
    if (typeof token === 'string' && verificarToken(token)) {
      socket.join('equipa');
    }

    // O cliente pede para seguir um pedido. Só entra na sala se o token da mesa bater certo.
    socket.on('seguir_pedido', async (dados: unknown) => {
      try {
        const { pedidoId, token: qrToken } = (dados ?? {}) as { pedidoId?: unknown; token?: unknown };
        if (typeof pedidoId !== 'number' || typeof qrToken !== 'string') return;
        const pedido = await prisma.pedido.findFirst({
          where: { id: pedidoId, mesa: { qrToken } },
          select: { id: true },
        });
        if (pedido) socket.join(`pedido:${pedido.id}`);
      } catch (e) {
        console.error('seguir_pedido falhou', e);
      }
    });
  });

  return io;
}

export function obterIo(): Server {
  if (!io) throw new Error('Socket.IO ainda não foi iniciado');
  return io;
}

export function avisarMenuAtualizado() {
  obterIo().emit('menu_atualizado');
}
