import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { roomManager } from '../roomManager.js';
import { livekitService } from '../livekitService.js';
import { config } from '../config.js';

export const roomRouter = Router();

// Rate limiter for room creation
const createRoomLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many rooms created. Please wait a minute.' },
});

// Rate limiter for join attempts (prevents credential brute-forcing)
const joinRoomLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many join attempts. Please slow down.' },
});

// Input validation schemas
const CreateRoomSchema = z.object({
  hostName: z.string().trim().min(1, 'Name is required').max(40).optional(),
});

const JoinRoomSchema = z.object({
  roomId: z.string().trim().min(3).max(40),
  inviteSecret: z.string().trim().min(8).max(64),
  guestName: z.string().trim().min(1).max(40).optional(),
  guestId: z.string().trim().min(3).max(64).optional(),
});

const ValidateInviteSchema = z.object({
  roomId: z.string().trim().min(3).max(40),
  inviteSecret: z.string().trim().min(8).max(64),
});

const HostActionSchema = z.object({
  roomId: z.string().trim().min(3).max(40),
  hostSecret: z.string().trim().min(8).max(64),
});

const LeaveRoomSchema = z.object({
  roomId: z.string().trim().min(3).max(40),
  participantId: z.string().trim().min(3).max(64),
});

const ReconnectSchema = z.object({
  roomId: z.string().trim().min(3).max(40),
  role: z.enum(['host', 'guest']),
  secret: z.string().trim().min(8).max(64), // hostSecret if host, inviteSecret if guest
  participantId: z.string().trim().min(3).max(64).optional(),
  displayName: z.string().trim().min(1).max(40).optional(),
});

// Adapt LiveKit URL for local LAN connections (e.g. mobile phone on Wi-Fi)
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
 * Host initiates a new private room
 */
roomRouter.post('/create', createRoomLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = CreateRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid name provided.' });
    }

    const hostName = parseResult.data.hostName || 'Host';
    const { room, hostParticipant } = roomManager.createRoom(hostName);

    // Safe log: Never log secrets or tokens
    console.log(`[RoomManager] Room created: roomId=${room.id}`);

    // Pre-configure room on LiveKit SFU (maxParticipants: 2)
    await livekitService.ensureRoomConfigured(room.id);

    // Generate short-lived token for authorized host
    const token = await livekitService.generateToken(
      room.id,
      hostParticipant.id,
      hostParticipant.name,
      'host'
    );

    return res.status(201).json({
      success: true,
      roomId: room.id,
      hostSecret: room.hostSecret,
      inviteSecret: room.invitation.secret,
      token,
      livekitUrl: resolveLiveKitUrl(req),
      participant: hostParticipant,
      expiresAt: room.expiresAt,
      iceServers: config.iceServers,
    });
  } catch (error: any) {
    console.error('[RoomCreate] Error creating room');
    return res.status(500).json({ error: 'Failed to create watch party room.' });
  }
});

/**
 * POST /api/rooms/validate
 * Inspects invitation credentials before joining
 */
roomRouter.post('/validate', async (req: Request, res: Response) => {
  try {
    const parseResult = ValidateInviteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ valid: false, error: 'Invalid invitation credentials provided.' });
    }

    const { roomId, inviteSecret } = parseResult.data;
    const inspection = roomManager.inspectInvitation(roomId, inviteSecret);

    if (!inspection.valid || !inspection.room) {
      return res.status(inspection.status).json({
        valid: false,
        error: inspection.error,
      });
    }

    const room = inspection.room;
    const host = room.participants.get(room.hostId);

    return res.json({
      valid: true,
      roomId: room.id,
      hostName: host ? host.name : 'Host',
      participantCount: room.participants.size,
      isFull: room.participants.size >= 2,
    });
  } catch (error: any) {
    console.error('[RoomValidate] Error inspecting invitation');
    return res.status(500).json({ valid: false, error: 'Validation check failed.' });
  }
});

/**
 * POST /api/rooms/join
 * Guest joins the room using the invitation credential
 */
roomRouter.post('/join', joinRoomLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = JoinRoomSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid invitation details provided.' });
    }

    const { roomId, inviteSecret, guestName, guestId } = parseResult.data;

    // Atomically claim guest seat in roomManager
    const claimResult = roomManager.claimGuestSeat(roomId, inviteSecret, guestName || 'Guest', guestId);
    if (!claimResult.success || !claimResult.guest) {
      return res.status(claimResult.status).json({ error: claimResult.error });
    }

    const guest = claimResult.guest;
    console.log(`[RoomManager] Guest admitted: roomId=${roomId} guestId=${guest.id}`);

    // Generate short-lived token for authorized guest
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
      iceServers: config.iceServers,
    });
  } catch (error: any) {
    console.error('[RoomJoin] Error admitting guest');
    return res.status(500).json({ error: 'Failed to join room.' });
  }
});

/**
 * POST /api/rooms/reconnect
 * Allows authorized host or guest to recover session and get fresh token
 * without bypassing capacity or authorization.
 */
roomRouter.post('/reconnect', joinRoomLimiter, async (req: Request, res: Response) => {
  try {
    const parseResult = ReconnectSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid reconnection parameters.' });
    }

    const { roomId, role, secret, participantId, displayName } = parseResult.data;

    if (role === 'host') {
      const result = roomManager.reconnectHost(roomId, secret);
      if (!result.success || !result.host || !result.room) {
        return res.status(result.status).json({ error: result.error });
      }

      const token = await livekitService.generateToken(
        roomId,
        result.host.id,
        result.host.name,
        'host'
      );

      console.log(`[RoomManager] Host reconnected: roomId=${roomId}`);
      return res.json({
        success: true,
        roomId,
        token,
        livekitUrl: resolveLiveKitUrl(req),
        participant: result.host,
        hostSecret: result.room.hostSecret,
        inviteSecret: result.room.invitation.secret,
        iceServers: config.iceServers,
      });
    } else {
      const result = roomManager.reconnectGuest(roomId, secret, participantId, displayName);
      if (!result.success || !result.guest || !result.room) {
        return res.status(result.status).json({ error: result.error });
      }

      const token = await livekitService.generateToken(
        roomId,
        result.guest.id,
        result.guest.name,
        'guest'
      );

      console.log(`[RoomManager] Guest reconnected: roomId=${roomId} guestId=${result.guest.id}`);
      return res.json({
        success: true,
        roomId,
        token,
        livekitUrl: resolveLiveKitUrl(req),
        participant: result.guest,
        inviteSecret: result.room.invitation.secret,
        iceServers: config.iceServers,
      });
    }
  } catch (error: any) {
    console.error('[RoomReconnect] Error during reconnection');
    return res.status(500).json({ error: 'Failed to reconnect to room.' });
  }
});

/**
 * POST /api/rooms/revoke-invite
 * Host revokes the current invitation credential
 */
roomRouter.post('/revoke-invite', async (req: Request, res: Response) => {
  try {
    const parseResult = HostActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid host administrative credentials.' });
    }

    const { roomId, hostSecret } = parseResult.data;
    const result = roomManager.revokeInvitation(roomId, hostSecret);
    if (!result.success) {
      return res.status(403).json({ error: result.error });
    }

    console.log(`[RoomManager] Invitation revoked: roomId=${roomId}`);
    return res.json({ success: true, message: 'Invitation credential has been revoked.' });
  } catch (error: any) {
    console.error('[RoomRevoke] Error revoking invitation');
    return res.status(500).json({ error: 'Failed to revoke invitation.' });
  }
});

/**
 * POST /api/rooms/regenerate-invite
 * Host generates a fresh invitation credential
 */
roomRouter.post('/regenerate-invite', async (req: Request, res: Response) => {
  try {
    const parseResult = HostActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid host administrative credentials.' });
    }

    const { roomId, hostSecret } = parseResult.data;
    const result = roomManager.regenerateInvitation(roomId, hostSecret);
    if (!result.success || !result.newInviteSecret) {
      return res.status(403).json({ error: result.error });
    }

    console.log(`[RoomManager] New invitation generated: roomId=${roomId}`);
    return res.json({
      success: true,
      newInviteSecret: result.newInviteSecret,
    });
  } catch (error: any) {
    console.error('[RoomRegen] Error regenerating invitation');
    return res.status(500).json({ error: 'Failed to regenerate invitation.' });
  }
});

/**
 * POST /api/rooms/close
 * Host closes the watch party room
 */
roomRouter.post('/close', async (req: Request, res: Response) => {
  try {
    const parseResult = HostActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid host administrative credentials.' });
    }

    const { roomId, hostSecret } = parseResult.data;
    const result = roomManager.closeRoom(roomId, hostSecret);
    if (!result.success) {
      return res.status(403).json({ error: result.error });
    }

    console.log(`[RoomManager] Room closed by host: roomId=${roomId}`);
    return res.json({ success: true, message: 'Watch party closed.' });
  } catch (error: any) {
    console.error('[RoomClose] Error closing room');
    return res.status(500).json({ error: 'Failed to close room.' });
  }
});

/**
 * POST /api/rooms/leave
 * Notifies server that a participant has left
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
 * GET /api/rooms/status/:roomId
 * Public sanitized room status
 */
roomRouter.get('/status/:roomId', (req: Request, res: Response) => {
  const roomId = Array.isArray(req.params.roomId) ? req.params.roomId[0] : req.params.roomId;
  const status = roomManager.getRoomStatus(roomId);
  return res.json(status);
});
