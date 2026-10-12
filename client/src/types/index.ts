export type ParticipantRole = 'host' | 'guest';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'offline'
  | 'error';

export interface ParticipantUser {
  id: string;
  name: string;
  role: ParticipantRole;
}

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface RoomSession {
  roomId: string;
  hostSecret?: string; // Administrative secret (host only)
  inviteSecret: string; // The invitation credential for the guest
  token: string;
  livekitUrl: string;
  role: ParticipantRole;
  participantId: string;
  displayName: string;
  iceServers?: IceServerConfig[];
}

export interface DeviceState {
  cameraEnabled: boolean;
  micEnabled: boolean;
  screenShareEnabled: boolean;
  isSpeaking: boolean;
}
