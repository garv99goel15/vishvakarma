// ============================================================================
// WebSocket / Socket.IO Server
// ============================================================================

import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { config } from '../config';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigins,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', socket => {
    console.log('[WS] Client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('[WS] Client disconnected:', socket.id);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
