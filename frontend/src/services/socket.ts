// ============================================================================
// Socket.IO Client
// ============================================================================

import { io, Socket } from 'socket.io-client';

let socket: Socket;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
    });
  }
  return socket;
}
