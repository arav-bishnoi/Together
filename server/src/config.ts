import dotenv from 'dotenv';
dotenv.config();

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// Build ICE servers list with default STUN and optional TURN relay support
const getIceServers = (): IceServerConfig[] => {
  const servers: IceServerConfig[] = [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ],
    },
  ];

  // Optional custom TURN relay (e.g. Coturn, Metered, Twilio, Cloudflare)
  if (process.env.TURN_URL) {
    servers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  return servers;
};

const parseAllowedOrigins = (rawOrigin?: string): string[] => {
  if (!rawOrigin || rawOrigin.trim() === '*') {
    return ['*'];
  }
  return rawOrigin
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
};

const isProduction = process.env.NODE_ENV === 'production';
const livekitApiKey = process.env.LIVEKIT_API_KEY || (isProduction ? '' : 'devkey');
const livekitApiSecret = process.env.LIVEKIT_API_SECRET || (isProduction ? '' : 'secret');

// Enforce security in production: Refuse to start with known default/insecure credentials
if (isProduction) {
  const insecureKeys = ['devkey', 'your_api_key_here', 'default', 'test', ''];
  const insecureSecrets = ['secret', 'your_api_secret_here', 'default', 'test', ''];

  if (insecureKeys.includes(livekitApiKey.toLowerCase())) {
    throw new Error(
      '[CRITICAL SECURITY CONFIG] Default or placeholder LIVEKIT_API_KEY detected in production. ' +
      'You must set a unique, cryptographically random key in your environment.'
    );
  }

  if (insecureSecrets.includes(livekitApiSecret.toLowerCase())) {
    throw new Error(
      '[CRITICAL SECURITY CONFIG] Default or placeholder LIVEKIT_API_SECRET detected in production. ' +
      'You must set a unique, cryptographically random secret in your environment.'
    );
  }

  const origins = parseAllowedOrigins(process.env.CLIENT_ORIGIN);
  if (origins.includes('*')) {
    console.warn(
      '⚠️ [SECURITY WARNING] CLIENT_ORIGIN is set to wildcard (*) in production. ' +
      'For maximum security, restrict CLIENT_ORIGIN to your frontend domain (e.g. CLIENT_ORIGIN=https://party.yourdomain.com).'
    );
  }
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  isProduction,
  livekitUrl: process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880',
  publicLivekitUrl: process.env.PUBLIC_LIVEKIT_URL ? process.env.PUBLIC_LIVEKIT_URL.trim() : undefined,
  livekitApiKey,
  livekitApiSecret,
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  clientOrigins: parseAllowedOrigins(process.env.CLIENT_ORIGIN),
  tokenTtlSeconds: parseInt(process.env.TOKEN_TTL_SECONDS || '1800', 10), // 30 minutes default
  roomExpiryHours: parseInt(process.env.ROOM_EXPIRY_HOURS || '12', 10), // 12 hours room life
  iceServers: getIceServers(),
};
