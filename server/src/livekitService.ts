import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { config } from './config.js';

class LiveKitService {
  private roomService: RoomServiceClient;

  constructor() {
    this.roomService = new RoomServiceClient(
      config.livekitUrl,
      config.livekitApiKey,
      config.livekitApiSecret
    );
  }

  /**
   * Generates a signed LiveKit JWT access token with restricted permissions and short TTL
   */
  public async generateToken(
    roomId: string,
    participantId: string,
    participantName: string,
    role: 'host' | 'guest'
  ): Promise<string> {
    const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity: participantId,
      name: participantName,
      ttl: config.tokenTtlSeconds,
      metadata: JSON.stringify({ role, participantId }),
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return await at.toJwt();
  }

  /**
   * Configures room on LiveKit server to enforce 2-participant limit at the SFU level
   */
  public async ensureRoomConfigured(roomId: string): Promise<void> {
    try {
      await this.roomService.createRoom({
        name: roomId,
        emptyTimeout: 10 * 60, // 10 minutes empty timeout
        maxParticipants: 2,    // Hard cap at media server level
      });
    } catch (err: any) {
      // If room already exists or error occurs, log and continue
      console.warn(`[LiveKitService] createRoom note for ${roomId}:`, err?.message || err);
    }
  }

  /**
   * Immediately terminates and evicts all connections from the LiveKit room
   */
  public async deleteRoom(roomId: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomId);
    } catch (err: any) {
      console.warn(`[LiveKitService] deleteRoom note for ${roomId}:`, err?.message || err);
    }
  }

  /**
   * Retrieves active connected participant count from LiveKit SFU
   */
  public async getLiveKitParticipantCount(roomId: string): Promise<number> {
    try {
      const participants = await this.roomService.listParticipants(roomId);
      return participants.length;
    } catch {
      return 0;
    }
  }
}

export const livekitService = new LiveKitService();
