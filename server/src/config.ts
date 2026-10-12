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

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  livekitUrl: process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880',
  livekitApiKey: process.env.LIVEKIT_API_KEY || 'devkey',
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || 'secret',
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  tokenTtlSeconds: parseInt(process.env.TOKEN_TTL_SECONDS || '1800', 10), // 30 minutes default
  roomExpiryHours: parseInt(process.env.ROOM_EXPIRY_HOURS || '12', 10), // 12 hours room life
  iceServers: getIceServers(),
};
