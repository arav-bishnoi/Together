import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { roomRouter } from './routes/roomRoutes.js';

const app = express();

// Trust proxy for rate limiting behind reverse proxies (like Caddy / Nginx / cloudflared)
app.set('trust proxy', 1);

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self)');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Production-hardened CORS Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (config.clientOrigins.includes('*') || config.clientOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked: Origin ${origin} is not allowed`));
    },
    credentials: true,
  })
);

// Payload size limit to prevent denial-of-service via huge payloads
app.use(express.json({ limit: '10kb' }));

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'watch-party-server',
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Room routes
app.use('/api/rooms', roomRouter);

// Start HTTP server
const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[WatchParty Server] Running on http://0.0.0.0:${config.port}`);
  console.log(`[Environment] ${config.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  console.log(`[LiveKit Target] ${config.livekitUrl}`);
  if (config.publicLivekitUrl) {
    console.log(`[Public LiveKit WSS] ${config.publicLivekitUrl}`);
  }
  console.log(`[Allowed Origins] ${config.clientOrigins.join(', ')}`);
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
