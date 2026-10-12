import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { roomRouter } from './routes/roomRoutes.js';

const app = express();

// Trust proxy for rate limiting behind reverse proxies (like Caddy / Nginx / cloudflared)
app.set('trust proxy', 1);

// Middleware
app.use(
  cors({
    origin: config.clientOrigin === '*' ? true : [config.clientOrigin],
    credentials: true,
  })
);
app.use(express.json());

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'watch-party-server',
    timestamp: new Date().toISOString(),
  });
});

// Room routes
app.use('/api/rooms', roomRouter);

// Start HTTP server
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[WatchParty Server] Running on http://0.0.0.0:${config.port}`);
  console.log(`[LiveKit Target] ${config.livekitUrl}`);
});

// Graceful shutdown
const shutdown = () => {
  console.log('\n[WatchParty Server] Gracefully shutting down...');
  server.close(() => {
    console.log('[WatchParty Server] Closed all HTTP connections.');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
