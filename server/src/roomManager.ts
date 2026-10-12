import crypto from 'node:crypto';
import { config } from './config.js';

export interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest';
  joinedAt: Date;
  lastSeenAt: Date;
}

export interface RoomRecord {
  id: string;
  passcode: string;
  hostId: string;
  createdAt: Date;
  expiresAt: Date;
  participants: Map<string, Participant>;
}

class RoomManager {
  private rooms: Map<string, RoomRecord> = new Map();

  constructor() {
    // Periodic sweep every 5 minutes to clean expired rooms
    setInterval(() => this.cleanupExpiredRooms(), 5 * 60 * 1000);
  }

  /**
   * Generates a readable, memorable Room ID (e.g. "date-9428")
   */
  private generateRoomId(): string {
    const prefixes = ['date', 'star', 'cozy', 'night', 'spark', 'heart'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
  }

  /**
   * Generates a cryptographically strong 128-bit random secret passcode
   */
  private generatePasscode(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Creates a new private room
   */
  public createRoom(hostName: string): { room: RoomRecord; hostParticipant: Participant } {
    let roomId = this.generateRoomId();
    while (this.rooms.has(roomId)) {
      roomId = this.generateRoomId();
    }

    const passcode = this.generatePasscode();
    const hostId = `host-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.roomExpiryHours * 60 * 60 * 1000);

    const hostParticipant: Participant = {
      id: hostId,
      name: hostName.trim() || 'Host',
      role: 'host',
      joinedAt: now,
      lastSeenAt: now,
    };

    const room: RoomRecord = {
      id: roomId,
      passcode,
      hostId,
      createdAt: now,
      expiresAt,
      participants: new Map([[hostId, hostParticipant]]),
    };

    this.rooms.set(roomId, room);
    return { room, hostParticipant };
  }

  /**
   * Validates room existence, expiration, and secret passcode
   */
  public validateCredentials(roomId: string, passcode: string): { valid: boolean; error?: string; room?: RoomRecord } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { valid: false, error: 'Room not found or has expired.' };
    }

    if (new Date() > room.expiresAt) {
      this.rooms.delete(roomId);
      return { valid: false, error: 'This room has expired.' };
    }

    // Timing-safe comparison to prevent timing attacks
    const bufferA = Buffer.from(room.passcode);
    const bufferB = Buffer.from(passcode || '');
    if (bufferA.length !== bufferB.length || !crypto.timingSafeEqual(bufferA, bufferB)) {
      return { valid: false, error: 'Invalid invitation credentials or passcode.' };
    }

    return { valid: true, room };
  }

  /**
   * Verifies if a user can join the room (enforces strict 2-participant cap)
   */
  public canJoin(roomId: string, passcode: string, participantId?: string): { allowed: boolean; error?: string; room?: RoomRecord } {
    const validation = this.validateCredentials(roomId, passcode);
    if (!validation.valid || !validation.room) {
      return { allowed: false, error: validation.error };
    }

    const room = validation.room;

    // If this participant is already registered, they are re-joining/reconnecting
    if (participantId && room.participants.has(participantId)) {
      return { allowed: true, room };
    }

    // Enforce strict 2-participant maximum
    if (room.participants.size >= 2) {
      return { allowed: false, error: 'Room is full. Watch parties are private for 2 people only.' };
    }

    return { allowed: true, room };
  }

  /**
   * Registers a guest in the room
   */
  public registerGuest(roomId: string, passcode: string, guestName: string): { success: boolean; error?: string; guest?: Participant } {
    const joinCheck = this.canJoin(roomId, passcode);
    if (!joinCheck.allowed || !joinCheck.room) {
      return { success: false, error: joinCheck.error };
    }

    const guestId = `guest-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date();

    const guest: Participant = {
      id: guestId,
      name: guestName.trim() || 'Guest',
      role: 'guest',
      joinedAt: now,
      lastSeenAt: now,
    };

    joinCheck.room.participants.set(guestId, guest);
    return { success: true, guest };
  }

  /**
   * Removes a participant on departure
   */
  public removeParticipant(roomId: string, participantId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.participants.delete(participantId);
    }
  }

  /**
   * Updates participant heartbeat timestamp
   */
  public heartbeat(roomId: string, participantId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      const p = room.participants.get(participantId);
      if (p) {
        p.lastSeenAt = new Date();
      }
    }
  }

  /**
   * Returns current active participant count
   */
  public getParticipantCount(roomId: string): number {
    const room = this.rooms.get(roomId);
    return room ? room.participants.size : 0;
  }

  /**
   * Cleans up expired rooms
   */
  public cleanupExpiredRooms(): void {
    const now = new Date();
    for (const [roomId, room] of this.rooms.entries()) {
      if (now > room.expiresAt) {
        this.rooms.delete(roomId);
      }
    }
  }
}

export const roomManager = new RoomManager();
