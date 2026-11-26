import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

/** Cria uma ligação Socket.IO. Com token de sessão, o servidor põe-nos na sala da equipa. */
export function criarSocket(token?: string | null): Socket {
  return io(API_URL || '/', {
    auth: token ? { token } : {},
    transports: ['websocket', 'polling'],
  });
}
