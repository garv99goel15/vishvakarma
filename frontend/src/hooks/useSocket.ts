// ============================================================================
// useSocket — Returns the shared Socket.IO client instance
// ============================================================================

import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket } from '../services/socket';

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    setSocket(getSocket());
  }, []);

  return socket;
}
