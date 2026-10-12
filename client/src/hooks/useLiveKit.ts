import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  TrackPublication,
  RemoteTrackPublication,
  RemoteParticipant,
  LocalVideoTrack,
  Participant,
} from 'livekit-client';
import type { ConnectionStatus } from '../types/index.js';

export function useLiveKit() {
  const roomRef = useRef<Room | null>(null);

  // Connection and system states
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [isAudioBlocked, setIsAudioBlocked] = useState<boolean>(false);

  // Local media states (Default to false: Never silently activate camera or mic without user action)
  const [isCameraEnabled, setIsCameraEnabled] = useState<boolean>(false);
  const [isMicEnabled, setIsMicEnabled] = useState<boolean>(false);

  // Local tracks
  const [localCameraTrack, setLocalCameraTrack] = useState<LocalVideoTrack | null>(null);

  // Remote participant and tracks
  const [remoteParticipant, setRemoteParticipant] = useState<RemoteParticipant | null>(null);
  const [remoteCameraTrack, setRemoteCameraTrack] = useState<Track | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<Track | null>(null);
  const [isRemoteCameraMuted, setIsRemoteCameraMuted] = useState<boolean>(true);
  const [isRemoteMicMuted, setIsRemoteMicMuted] = useState<boolean>(true);

  // Speaking indicators
  const [localIsSpeaking, setLocalIsSpeaking] = useState<boolean>(false);
  const [remoteIsSpeaking, setRemoteIsSpeaking] = useState<boolean>(false);

  // Formats device/permission errors into helpful messages for beginners
  const formatDeviceError = (err: any, deviceType: 'camera' | 'microphone'): string => {
    const errorName = err?.name || '';
    if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
      return `Permission denied. Please allow ${deviceType} access in your browser address bar.`;
    }
    if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
      return `No ${deviceType} was detected on this device.`;
    }
    if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
      return `The ${deviceType} is already in use by another application.`;
    }
    return `Could not access ${deviceType}: ${err?.message || 'Unknown error'}`;
  };

  /**
   * Initializes or returns single LiveKit room instance with registered event listeners
   */
  const getOrCreateRoom = useCallback(() => {
    if (!roomRef.current) {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Track subscriptions
      room.on(RoomEvent.TrackSubscribed, (track: Track, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        setRemoteParticipant(participant);

        if (track.source === Track.Source.Camera) {
          setRemoteCameraTrack(track);
          setIsRemoteCameraMuted(pub.isMuted);
        } else if (track.source === Track.Source.Microphone) {
          setRemoteAudioTrack(track);
          setIsRemoteMicMuted(pub.isMuted);
        }
      });

      // Track unsubscription
      room.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
        if (track.source === Track.Source.Camera) {
          setRemoteCameraTrack(null);
          setIsRemoteCameraMuted(true);
        } else if (track.source === Track.Source.Microphone) {
          setRemoteAudioTrack(null);
          setIsRemoteMicMuted(true);
        }
      });

      // Remote track muted/unmuted events (e.g. partner toggles their mic/cam)
      room.on(RoomEvent.TrackMuted, (pub: TrackPublication, participant: Participant) => {
        if (participant.identity !== room.localParticipant?.identity) {
          if (pub.source === Track.Source.Camera) setIsRemoteCameraMuted(true);
          if (pub.source === Track.Source.Microphone) setIsRemoteMicMuted(true);
        }
      });

      room.on(RoomEvent.TrackUnmuted, (pub: TrackPublication, participant: Participant) => {
        if (participant.identity !== room.localParticipant?.identity) {
          if (pub.source === Track.Source.Camera) setIsRemoteCameraMuted(false);
          if (pub.source === Track.Source.Microphone) setIsRemoteMicMuted(false);
        }
      });

      // Remote participant join / departure
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        setRemoteParticipant(participant);
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        setRemoteParticipant(null);
        setRemoteCameraTrack(null);
        setRemoteAudioTrack(null);
        setIsRemoteCameraMuted(true);
        setIsRemoteMicMuted(true);
      });

      // Active speaker detection
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const localSpeaking = speakers.some((s) => s.identity === room.localParticipant?.identity);
        const remoteSpeaking = speakers.some((s) => s.identity !== room.localParticipant?.identity);
        setLocalIsSpeaking(localSpeaking);
        setRemoteIsSpeaking(remoteSpeaking);
      });

      // Mobile browser autoplay restrictions
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setIsAudioBlocked(!room.canPlaybackAudio);
      });

      // Connection lifecycle states
      room.on(RoomEvent.Connected, () => {
        setConnectionStatus('connected');
        setIsAudioBlocked(!room.canPlaybackAudio);
      });

      room.on(RoomEvent.Reconnecting, () => {
        setConnectionStatus('reconnecting');
      });

      room.on(RoomEvent.Reconnected, () => {
        setConnectionStatus('connected');
      });

      room.on(RoomEvent.Disconnected, () => {
        setConnectionStatus('disconnected');
        setRemoteParticipant(null);
      });

      roomRef.current = room;
    }
    return roomRef.current;
  }, []);

  /**
   * Connect to LiveKit SFU using short-lived JWT token from backend
   */
  const connect = useCallback(async (livekitUrl: string, token: string) => {
    try {
      setConnectionStatus('connecting');
      setErrorMessage(null);
      setDeviceError(null);

      const room = getOrCreateRoom();
      await room.connect(livekitUrl, token);
      // Camera and microphone remain OFF initially until user explicitly clicks toggles
    } catch (err: any) {
      console.error('[LiveKit Connect] Error connecting to room:', err);
      setConnectionStatus('error');
      setErrorMessage(err?.message || 'Could not connect to LiveKit media server.');
    }
  }, [getOrCreateRoom]);

  /**
   * Toggle camera with graceful permission/device failure handling
   */
  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    setDeviceError(null);
    try {
      const nextState = !isCameraEnabled;
      await room.localParticipant.setCameraEnabled(nextState);
      setIsCameraEnabled(nextState);

      if (nextState) {
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.track) {
          setLocalCameraTrack(camPub.track as LocalVideoTrack);
        }
      } else {
        setLocalCameraTrack(null);
      }
    } catch (err: any) {
      const msg = formatDeviceError(err, 'camera');
      setDeviceError(msg);
      setIsCameraEnabled(false);
      setLocalCameraTrack(null);
    }
  }, [isCameraEnabled]);

  /**
   * Toggle microphone with graceful permission/device failure handling
   */
  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    setDeviceError(null);
    try {
      const nextState = !isMicEnabled;
      await room.localParticipant.setMicrophoneEnabled(nextState);
      setIsMicEnabled(nextState);
    } catch (err: any) {
      const msg = formatDeviceError(err, 'microphone');
      setDeviceError(msg);
      setIsMicEnabled(false);
    }
  }, [isMicEnabled]);

  /**
   * Unlocks audio for mobile browsers that block autoplay
   */
  const unlockAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setIsAudioBlocked(false);
    } catch (err: any) {
      console.warn('Audio unlock gesture failed:', err?.message);
    }
  }, []);

  /**
   * Complete media track and listener cleanup to prevent memory leaks and duplicate listeners
   */
  const disconnect = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      try {
        // Stop local tracks
        room.localParticipant?.videoTrackPublications.forEach((pub) => {
          pub.track?.stop();
        });
        room.localParticipant?.audioTrackPublications.forEach((pub) => {
          pub.track?.stop();
        });
        room.removeAllListeners();
        room.disconnect();
      } catch (err) {
        console.warn('Error during room disconnect cleanup:', err);
      }
      roomRef.current = null;
    }

    setConnectionStatus('disconnected');
    setIsCameraEnabled(false);
    setIsMicEnabled(false);
    setLocalCameraTrack(null);
    setRemoteParticipant(null);
    setRemoteCameraTrack(null);
    setRemoteAudioTrack(null);
    setIsRemoteCameraMuted(true);
    setIsRemoteMicMuted(true);
    setLocalIsSpeaking(false);
    setRemoteIsSpeaking(false);
  }, []);

  // Ensure cleanup on component unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    room: roomRef.current,
    connectionStatus,
    errorMessage,
    deviceError,
    setDeviceError,
    isAudioBlocked,
    isCameraEnabled,
    isMicEnabled,
    localCameraTrack,
    remoteParticipant,
    remoteCameraTrack,
    remoteAudioTrack,
    isRemoteCameraMuted,
    isRemoteMicMuted,
    localIsSpeaking,
    remoteIsSpeaking,
    connect,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    unlockAudio,
  };
}
