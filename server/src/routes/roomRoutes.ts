import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { roomManager } from '../roomManager.js';
import { livekitService } from '../livekitService.js';
import { config } from '../config.js';

export const roomRouter = Router();

// Rate limiter for room creation (prevents flooding room creations)
const createRoomLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many rooms created. Please wait a moment.' },
});

// Rate limiter for join attempts (prevents brute forcing room passcodes)
const joinRoomLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Too many join attempts. Please slow down.' },
});

// Zod schemas for input validation
const CreateRoomSchema = z.object({
  hostName: z.string().trim().min(1).max(40).optional(),
});

const JoinRoomSchema = z.object({
  roomId: z.string().trim().min(3).max(40),
  passcode: z.string().trim().min(8).max(64),
  guestName: z.string().trim().min(1).max(40).optional(),
});

const ValidateRoomSchema = z.object({
  roomId: z.string().trim().min(3).max(40),
  passcode: z.string().trim().min(8).max(64),
});

const LeaveRoomSchema = z.object({
  roomId: z.string().trim().min(3).max(40),
  participantId: z.string().trim().min(3).max(64),
});

// Dynamically adapts LiveKit URL for local LAN devices (e.g., Android phone on Wi-Fi)
const resolveLiveKitUrl = (req: Request): string => {
  if (process.env.PUBLIC_LIVEKIT_URL) {
    return process.env.PUBLIC_LIVEKIT_URL;
  }
  if (config.livekitUrl.includes('127.0.0.1') || config.livekitUrl.includes('localhost')) {
    const protocol = req.protocol === 'https' ? 'wss' : 'ws';
    return `${protocol}://${req.hostname}:7880`;
  }
  return config.livekitUrl;
};

/**
 * POST /api/rooms/create
 * Host initiates a new date-night watch party
 */
roomRouter.post('/create', createRoomLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = CreateRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid host name provided.' });
    }

    const hostName = parseResult.data.hostName || 'Host';
    const { room, hostParticipant } = roomManager.createRoom(hostName);

    // Prepare LiveKit room with maxParticipants: 2 limit
    await livekitService.ensureRoomConfigured(room.id);

    // Generate host token
    const token = await livekitService.generateToken(
      room.id,
      hostParticipant.id,
      hostParticipant.name,
      'host'
    );

    return res.status(201).json({
      success: true,
      roomId: room.id,
      passcode: room.passcode,
      token,
      livekitUrl: resolveLiveKitUrl(req),
      participant: hostParticipant,
      expiresAt: room.expiresAt,
    });
  } catch (error: any) {
    console.error('[Route /create] Error creating room:', error);
    return res.status(500).json({ error: 'Failed to create watch party room.' });
  }
});

/**
 * POST /api/rooms/validate
 * Inspects room status without consuming a seat
 */
roomRouter.post('/validate', async (req: Request, res: Response) => {
  try {
    const parseResult = ValidateRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ valid: false, error: 'Invalid room details provided.' });
    }

    const { roomId, passcode } = parseResult.data;
    const validation = roomManager.validateCredentials(roomId, passcode);

    if (!validation.valid || !validation.room) {
      return res.status(401).json({ valid: false, error: validation.error });
    }

    const room = validation.room;
    const host = Array.from(room.participants.values()).find((p) => p.role === 'host');
    const livekitCount = await livekitService.getLiveKitParticipantCount(roomId);
    const participantCount = Math.max(room.participants.size, livekitCount);

    return res.json({
      valid: true,
      roomId: room.id,
      hostName: host ? host.name : 'Host',
      participantCount,
      isFull: participantCount >= 2,
    });
  } catch (error: any) {
    console.error('[Route /validate] Error validating room:', error);
    return res.status(500).json({ valid: false, error: 'Validation check failed.' });
  }
});

/**
 * POST /api/rooms/join
 * Guest joins the watch party with passcode
 */
roomRouter.post('/join', joinRoomLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = JoinRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Please enter valid room credentials.' });
    }

    const { roomId, passcode, guestName } = parseResult.data;

    // Double check capacity at SFU level
    const livekitCount = await livekitService.getLiveKitParticipantCount(roomId);
    if (livekitCount >= 2) {
      return res.status(403).json({
        error: 'Watch party is full. Only 2 participants are permitted in this private room.',
      });
    }

    const registerResult = roomManager.registerGuest(roomId, passcode, guestName || 'Guest');
    if (!registerResult.success || !registerResult.guest) {
      return res.status(403).json({ error: registerResult.error || 'Failed to join room.' });
    }

    const guest = registerResult.guest;

    // Generate guest token
    const token = await livekitService.generateToken(
      roomId,
      guest.id,
      guest.name,
      'guest'
    );

    return res.json({
      success: true,
      roomId,
      token,
      livekitUrl: resolveLiveKitUrl(req),
      participant: guest,
    });
  } catch (error: any) {
    console.error('[Route /join] Error joining room:', error);
    return res.status(500).json({ error: 'Failed to join room.' });
  }
});

/**
 * POST /api/rooms/leave
 * Notifies server that a user has exited
 */
roomRouter.post('/leave', (req: Request, res: Response) => {
  const parseResult = LeaveRoomSchema.safeParse(req.body);
  if (parseResult.success) {
    const { roomId, participantId } = parseResult.data;
    roomManager.removeParticipant(roomId, participantId);
  }
  return res.json({ success: true });
});

/**
 * POST /api/rooms/heartbeat
 * Keeps active session alive
 */
roomRouter.post('/heartbeat', (req: Request, res: Response) => {
  const parseResult = LeaveRoomSchema.safeParse(req.body);
  if (parseResult.success) {
    const { roomId, participantId } = parseResult.data;
    roomManager.heartbeat(roomId, participantId);
  }
  return res.json({ alive: true });
});
