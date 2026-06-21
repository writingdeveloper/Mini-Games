import http from 'node:http';
import { Server } from 'socket.io';
import { PORT, CORS_ORIGIN } from './config.js';
import { SocketManager } from './network/SocketManager.js';

const server = http.createServer((_req, res) => {
  // Health check endpoint
  if (_req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Mini-Games Server');
});

// Support comma-separated CORS origins or wildcard
const corsOrigin = CORS_ORIGIN === '*'
  ? '*'
  : CORS_ORIGIN.includes(',')
    ? CORS_ORIGIN.split(',').map(s => s.trim())
    : CORS_ORIGIN;

if (corsOrigin === '*') {
  console.warn(
    '[Server] WARNING: CORS_ORIGIN is "*" — any website can drive this socket server. ' +
    'Set CORS_ORIGIN to your site origin (e.g. https://games.writingdeveloper.blog) in production.'
  );
}

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
  // Bound incoming payload size so a client can't send arbitrarily large messages (memory DoS).
  maxHttpBufferSize: 1e5, // 100 KB
  // socket.io defaults: timeout >= interval so a brief lag spike isn't treated as a disconnect.
  pingInterval: 25000,
  pingTimeout: 20000,
});

const socketManager = new SocketManager(io);
socketManager.start();

server.listen(PORT, () => {
  console.log(`[Server] Mini-Games server running on port ${PORT}`);
  console.log(`[Server] CORS origin: ${CORS_ORIGIN}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('[Server] Shutting down...');
  socketManager.stop();
  io.close();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Last-resort guards: a stray throw or rejected promise must never take the whole server
// (and every active room) down. Log and keep serving.
process.on('uncaughtException', (err) => {
  console.error('[Server] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Server] unhandledRejection:', reason);
});
