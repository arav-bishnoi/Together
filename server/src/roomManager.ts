import crypto from 'node:crypto';
import { config } from './config.js';

export interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest';
  joinedAt: Date;
  lastSeenAt: Date;
}

export interface Invitation {
  secret: string; // Cryptographically random 128-bit invitation credential
  createdAt: Date;
  revoked: boolean;
  claimedByGuestId?: string;
}

export interface RoomRecord {
  id: string;
  hostSecret: string; // Administrative secret, known only to the host
  hostId: string;
  invitation: Invitation; // Guest invitation credential
  createdAt: Date;
  expiresAt: Date;
  participants: Map<string, Participant>;
}

class RoomManager {
  private rooms: Map<string, RoomRecord> = new Map();

  constructor() {
    // Periodic sweep every 5 minutes to clean expired rooms from memory
    const timer = setInterval(() => this.cleanupExpiredRooms(), 5 * 60 * 1000);
    if (timer.unref) {
      timer.unref();
    }
  }

  /**
   * Generates a readable, memorable Room ID (e.g. "spark-4913")
   */
  private generateRoomId(): string {
    const prefixes = ['spark', 'velvet', 'cozy', 'night', 'star', 'amber', 'dusk', 'moon'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
  }

  /**
   * Generates a cryptographically strong 128-bit random hex credential
   */
  private generateSecureSecret(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Constant-time string equality check to protect against timing attacks
   */
  private timingSafeCompare(a: string, b: string): boolean {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Creates a new private room with distinct host and invitation credentials
   */
  public createRoom(hostName: string, customExpiryHours?: number): { room: RoomRecord; hostParticipant: Participant } {
    let roomId = this.generateRoomId();
    while (this.rooms.has(roomId)) {
      roomId = this.generateRoomId();
    }

    const hostSecret = this.generateSecureSecret();
    const inviteSecret = this.generateSecureSecret();
    const hostId = `host-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date();
    const expiryHours = customExpiryHours ?? config.roomExpiryHours;
    const expiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);

    const hostParticipant: Participant = {
      id: hostId,
      name: hostName.trim() || 'Host',
      role: 'host',
      joinedAt: now,
      lastSeenAt: now,
    };

    const room: RoomRecord = {
      id: roomId,
      hostSecret,
      hostId,
      invitation: {
        secret: inviteSecret,
        createdAt: now,
        revoked: false,
      },
      createdAt: now,
      expiresAt,
      participants: new Map([[hostId, hostParticipant]]),
    };

    this.rooms.set(roomId, room);
    return { room, hostParticipant };
  }

  /**
   * Verifies the host's administrative secret
   */
  public verifyHost(roomId: string, hostSecret: string): { valid: boolean; room?: RoomRecord; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { valid: false, error: 'Room does not exist or has expired.' };
    }
    if (new Date() > room.expiresAt) {
      this.rooms.delete(roomId);
      return { valid: false, error: 'This room has expired.' };
    }
    if (!this.timingSafeCompare(room.hostSecret, hostSecret)) {
      return { valid: false, error: 'Invalid administrative credentials.' };
    }
    return { valid: true, room };
  }

  /**
   * Inspects and validates a guest invitation without claiming the seat
   */
  public inspectInvitation(roomId: string, inviteSecret: string): {
    valid: boolean;
    status: number;
    error?: string;
    room?: RoomRecord;
  } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { valid: false, status: 404, error: 'Room not found or has expired.' };
    }

    if (new Date() > room.expiresAt) {
      this.rooms.delete(roomId);
      return { valid: false, status: 410, error: 'This watch party has expired.' };
    }

    if (room.invitation.revoked) {
      return { valid: false, status: 403, error: 'This invitation has been revoked by the host.' };
    }

    if (!this.timingSafeCompare(room.invitation.secret, inviteSecret)) {
      return { valid: false, status: 401, error: 'Invalid invitation credentials.' };
    }

    if (room.participants.size >= 2) {
      return { valid: false, status: 403, error: 'Watch party is full. Maximum 2 participants allowed.' };
    }

    return { valid: true, status: 200, room };
  }

  /**
   * Atomically claims the single guest seat in the room.
   * Runs completely synchronously to guarantee zero race conditions between concurrent requests.
   */
  public claimGuestSeat(
    roomId: string,
    inviteSecret: string,
    guestName: string,
    existingGuestId?: string
  ): {
    success: boolean;
    status: number;
    error?: string;
    guest?: Participant;
    room?: RoomRecord;
  } {
    const inspection = this.inspectInvitation(roomId, inviteSecret);
    const room = inspection.room;

    if (!inspection.valid || !room) {
      // Reconnection check: if guest is reconnecting with existing guestId, allow even if size == 2
      if (room && existingGuestId && room.participants.has(existingGuestId)) {
        if (!room.invitation.revoked && this.timingSafeCompare(room.invitation.secret, inviteSecret)) {
          const guest = room.participants.get(existingGuestId)!;
          guest.lastSeenAt = new Date();
          return { success: true, status: 200, guest, room };
        }
      }
      return { success: false, status: inspection.status, error: inspection.error };
    }

    // Atomic room capacity enforcement: exactly 2 participants
    if (room.participants.size >= 2) {
      return {
        success: false,
        status: 403,
        error: 'Watch party is full. Only 2 participants are permitted in this private room.',
      };
    }

    const guestId = `guest-${crypto.randomBytes(6).toString('hex')}`;
    const now = new Date();

    const guestParticipant: Participant = {
      id: guestId,
      name: guestName.trim() || 'Guest',
      role: 'guest',
      joinedAt: now,
      lastSeenAt: now,
    };

    // Synchronously claim the seat
    room.participants.set(guestId, guestParticipant);
    room.invitation.claimedByGuestId = guestId;

    return { success: true, status: 200, guest: guestParticipant, room };
  }

  /**
   * Host revokes the active invitation credential
   */
  public revokeInvitation(roomId: string, hostSecret: string): { success: boolean; error?: string } {
    const hostCheck = this.verifyHost(roomId, hostSecret);
    if (!hostCheck.valid || !hostCheck.room) {
      return { success: false, error: hostCheck.error };
    }

    hostCheck.room.invitation.revoked = true;
    return { success: true };
  }

  /**
   * Host generates a new fresh invitation credential
   */
  public regenerateInvitation(roomId: string, hostSecret: string): { success: boolean; newInviteSecret?: string; error?: string } {
    const hostCheck = this.verifyHost(roomId, hostSecret);
    if (!hostCheck.valid || !hostCheck.room) {
      return { success: false, error: hostCheck.error };
    }

    const newSecret = this.generateSecureSecret();
    hostCheck.room.invitation = {
      secret: newSecret,
      createdAt: new Date(),
      revoked: false,
    };

    return { success: true, newInviteSecret: newSecret };
  }

  /**
   * Host closes the room, evicting all participants and deleting from memory
   */
  public closeRoom(roomId: string, hostSecret: string): { success: boolean; error?: string } {
    const hostCheck = this.verifyHost(roomId, hostSecret);
    if (!hostCheck.valid) {
      return { success: false, error: hostCheck.error };
    }

    this.rooms.delete(roomId);
    return { success: true };
  }

  /**
   * Removes a participant on exit
   */
  public removeParticipant(roomId: string, participantId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.participants.delete(participantId);
      if (room.invitation.claimedByGuestId === participantId) {
        room.invitation.claimedByGuestId = undefined;
      }
    }
  }

  /**
   * Retrieves sanitized public room status
   */
  public getRoomStatus(roomId: string): {
    exists: boolean;
    hostName?: string;
    participantCount?: number;
    isFull?: boolean;
    isRevoked?: boolean;
    isExpired?: boolean;
  } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { exists: false };
    }
    const isExpired = new Date() > room.expiresAt;
    if (isExpired) {
      this.rooms.delete(roomId);
      return { exists: false, isExpired: true };
    }

    const host = room.participants.get(room.hostId);
    return {
      exists: true,
      hostName: host ? host.name : 'Host',
      participantCount: room.participants.size,
      isFull: room.participants.size >= 2,
      isRevoked: room.invitation.revoked,
      isExpired: false,
    };
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

  /**
   * Internal test helper to simulate room expiration
   */
  public _forceExpireRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.expiresAt = new Date(Date.now() - 1000);
    }
  }

  /**
   * Internal test helper to get direct room for assertions
   */
  public _getRoom(roomId: string): RoomRecord | undefined {
    return this.rooms.get(roomId);
  }
}

export const roomManager = new RoomManager();
