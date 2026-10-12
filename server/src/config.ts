import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  livekitUrl: process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880',
  livekitApiKey: process.env.LIVEKIT_API_KEY || 'devkey',
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || 'secret',
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  tokenTtlSeconds: parseInt(process.env.TOKEN_TTL_SECONDS || '1800', 10), // 30 minutes default
  roomExpiryHours: parseInt(process.env.ROOM_EXPIRY_HOURS || '12', 10), // 12 hours room life
};
