import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { verificarToken } from './middleware/auth';
import { prisma } from './prisma';

/**
 * Salas:
 *  - "equipa"          → cozinha e admin (recebem novo_pedido, estado_atualizado, chamar_empregado)
 *  - "admins"          → só admin (recebe conta_pendente)
 *  - "pedido:<id>"     → o cliente que fez esse pedido (recebe estado_atualizado)
 * Eventos globais: "menu_atualizado" (para todos os menus abertos se atualizarem).
 */
let io: Server | null = null;

const MAX_PEDIDOS_SEGUIDOS = 20;

export function iniciarSocket(servidor: HttpServer, origens: string[] | boolean) {
  io = new Server(servidor, { cors: { origin: origens }, maxHttpBufferSize: 10_000 });

  // Verifica o token ANTES de aceitar a ligação. Assim, quando o browser recebe "connect",
  // a cozinha já está na sala certa e não perde pedidos que cheguem nesse instante.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token === 'string' && token.length < 2000) {
      socket.data.utilizador = await verificarToken(token).catch(() => null);
    }
    next(); // clientes sem token (menu, estado do pedido) também podem ligar-se
  });

  io.on('connection', (socket) => {
    // A equipa (cozinha/admin) junta-se às salas privadas só com um token válido e atual.
    const u = socket.data.utilizador as { id: number; papel: string } | null | undefined;
    if (u) {
      socket.join('equipa');
      socket.join(`utilizador:${u.id}`);
      if (u.papel === 'admin') socket.join('admins');
    }

    let seguidos = 0;
    // O cliente pede para seguir um pedido. Só entra na sala se o token da mesa bater certo.
    socket.on('seguir_pedido', async (dados: unknown) => {
      try {
        if (seguidos >= MAX_PEDIDOS_SEGUIDOS) return;
        const { pedidoId, token: qrToken } = (dados ?? {}) as { pedidoId?: unknown; token?: unknown };
        if (!Number.isInteger(pedidoId) || typeof qrToken !== 'string' || qrToken.length > 100) return;
        const pedido = await prisma.pedido.findFirst({
          where: { id: pedidoId as number, mesa: { qrToken } },
          select: { id: true },
        });
        if (pedido) {
          seguidos++;
          socket.join(`pedido:${pedido.id}`);
        }
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

/**
 * Corta já as ligações em tempo real de uma pessoa (ao suspender, apagar, mudar papel ou senha).
 * Sem isto, uma cozinha suspensa continuava a receber os pedidos até fechar a página.
 * Ao religar, o browser volta a enviar o token antigo, que já não é aceite.
 */
export function desligarSessoes(utilizadorId: number) {
  obterIo().in(`utilizador:${utilizadorId}`).disconnectSockets(true);
}

export function avisarMenuAtualizado() {
  obterIo().emit('menu_atualizado');
}
