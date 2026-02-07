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

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
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
