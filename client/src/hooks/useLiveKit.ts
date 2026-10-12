import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  TrackPublication,
  RemoteTrackPublication,
  LocalTrackPublication,
  RemoteParticipant,
  LocalVideoTrack,
  Participant,
} from 'livekit-client';
import type { ConnectionStatus, IceServerConfig } from '../types/index.js';

export function useLiveKit() {
  const roomRef = useRef<Room | null>(null);
  const lastConnectParamsRef = useRef<{
    url: string;
    token: string;
    iceServers?: IceServerConfig[];
  } | null>(null);

  // Connection and system states
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [isAudioBlocked, setIsAudioBlocked] = useState<boolean>(false);

  // Local media states (Default to false: Never silently activate camera or mic without user action)
  const [isCameraEnabled, setIsCameraEnabled] = useState<boolean>(false);
  const [isMicEnabled, setIsMicEnabled] = useState<boolean>(false);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState<boolean>(false);

  // Local tracks
  const [localCameraTrack, setLocalCameraTrack] = useState<LocalVideoTrack | null>(null);
  const [localScreenTrack, setLocalScreenTrack] = useState<LocalVideoTrack | null>(null);

  // Remote participant and tracks
  const [remoteParticipant, setRemoteParticipant] = useState<RemoteParticipant | null>(null);
  const [remoteCameraTrack, setRemoteCameraTrack] = useState<Track | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<Track | null>(null);
  const [remoteScreenTrack, setRemoteScreenTrack] = useState<Track | null>(null);
  const [remoteScreenAudioTrack, setRemoteScreenAudioTrack] = useState<Track | null>(null);
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
        } else if (track.source === Track.Source.ScreenShare) {
          setRemoteScreenTrack(track);
        } else if (track.source === Track.Source.ScreenShareAudio) {
          setRemoteScreenAudioTrack(track);
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
        } else if (track.source === Track.Source.ScreenShare) {
          setRemoteScreenTrack(null);
        } else if (track.source === Track.Source.ScreenShareAudio) {
          setRemoteScreenAudioTrack(null);
        }
      });

      // Local track published
      room.on(RoomEvent.LocalTrackPublished, (pub: LocalTrackPublication) => {
        if (pub.source === Track.Source.ScreenShare && pub.track) {
          setIsScreenShareEnabled(true);
          const track = pub.track as LocalVideoTrack;
          setLocalScreenTrack(track);
          track.mediaStreamTrack.onended = () => {
            setIsScreenShareEnabled(false);
            setLocalScreenTrack(null);
          };
        }
      });

      // Local track unpublished (e.g. user clicked browser native "Stop sharing" bar)
      room.on(RoomEvent.LocalTrackUnpublished, (pub: LocalTrackPublication) => {
        if (pub.source === Track.Source.ScreenShare) {
          setIsScreenShareEnabled(false);
          setLocalScreenTrack(null);
        }
      });

      // Remote track muted/unmuted events (e.g. remote participant toggles their mic/cam)
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
        setRemoteScreenTrack(null);
        setRemoteScreenAudioTrack(null);
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
        setErrorMessage(null);
        setIsAudioBlocked(!room.canPlaybackAudio);
      });

      room.on(RoomEvent.SignalReconnecting, () => {
        setConnectionStatus('reconnecting');
      });

      room.on(RoomEvent.SignalConnected, () => {
        setConnectionStatus('connected');
      });

      room.on(RoomEvent.Reconnecting, () => {
        setConnectionStatus('reconnecting');
      });

      room.on(RoomEvent.Reconnected, () => {
        setConnectionStatus('connected');
        setErrorMessage(null);
        setIsAudioBlocked(!room.canPlaybackAudio);

        // Resynchronize camera track if user had camera enabled
        const camPub = room.localParticipant?.getTrackPublication(Track.Source.Camera);
        if (camPub?.track) {
          setLocalCameraTrack(camPub.track as LocalVideoTrack);
        }
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
   * Connect to LiveKit SFU using short-lived JWT token and optional TURN/STUN ICE servers
   */
  const connect = useCallback(async (livekitUrl: string, token: string, iceServers?: IceServerConfig[]) => {
    try {
      setConnectionStatus('connecting');
      setErrorMessage(null);
      setDeviceError(null);

      lastConnectParamsRef.current = { url: livekitUrl, token, iceServers };

      const room = getOrCreateRoom();
      const connectOptions = iceServers && iceServers.length > 0
        ? { rtcConfig: { iceServers: iceServers as any } }
        : undefined;

      await room.connect(livekitUrl, token, connectOptions);
      // Camera and microphone remain OFF initially until user explicitly clicks toggles
    } catch (err: any) {
      console.error('[LiveKit Connect] Error connecting to room:', err);
      setConnectionStatus('error');
      setErrorMessage(err?.message || 'Could not connect to LiveKit media server.');
    }
  }, [getOrCreateRoom]);

  /**
   * Cleanly retries connection with fresh or stored parameters
   */
  const retryConnection = useCallback(async (customUrl?: string, customToken?: string, customIceServers?: IceServerConfig[]) => {
    const url = customUrl || lastConnectParamsRef.current?.url;
    const token = customToken || lastConnectParamsRef.current?.token;
    const ice = customIceServers || lastConnectParamsRef.current?.iceServers;

    if (!url || !token) {
      setErrorMessage('Missing connection parameters for retry.');
      return;
    }

    // Clean up previous room to avoid duplicate connections
    if (roomRef.current) {
      try {
        roomRef.current.removeAllListeners();
        roomRef.current.disconnect();
      } catch (err) {
        console.warn('Cleanup error during retry:', err);
      }
      roomRef.current = null;
    }

    await connect(url, token, ice);
  }, [connect]);

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
   * Toggle screen sharing with browser tab audio support and native cancellation handling
   */
  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    setDeviceError(null);
    try {
      const nextState = !isScreenShareEnabled;
      if (nextState) {
        const pub = await room.localParticipant.setScreenShareEnabled(true, {
          audio: true,
          selfBrowserSurface: 'include',
          surfaceSwitching: 'include',
          systemAudio: 'include',
        });
        setIsScreenShareEnabled(true);
        if (pub?.track) {
          const track = pub.track as LocalVideoTrack;
          setLocalScreenTrack(track);
          // Handle browser native floating "Stop sharing" button
          track.mediaStreamTrack.onended = () => {
            setIsScreenShareEnabled(false);
            setLocalScreenTrack(null);
          };
        }
      } else {
        await room.localParticipant.setScreenShareEnabled(false);
        setIsScreenShareEnabled(false);
        setLocalScreenTrack(null);
      }
    } catch (err: any) {
      const errorName = err?.name || '';
      // Gracefully handle user cancelling the browser screen picker dialog
      if (errorName === 'NotAllowedError' || errorName === 'AbortError') {
        console.log('Screen sharing was cancelled by user.');
      } else {
        console.error('Screen sharing error:', err);
        setDeviceError(`Screen sharing failed: ${err?.message || 'Unknown error'}`);
      }
      setIsScreenShareEnabled(false);
      setLocalScreenTrack(null);
    }
  }, [isScreenShareEnabled]);

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
    setIsScreenShareEnabled(false);
    setLocalCameraTrack(null);
    setLocalScreenTrack(null);
    setRemoteParticipant(null);
    setRemoteCameraTrack(null);
    setRemoteAudioTrack(null);
    setRemoteScreenTrack(null);
    setRemoteScreenAudioTrack(null);
    setIsRemoteCameraMuted(true);
    setIsRemoteMicMuted(true);
    setLocalIsSpeaking(false);
    setRemoteIsSpeaking(false);
  }, []);

  // Monitor network online / offline state
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (connectionStatus === 'offline' || connectionStatus === 'disconnected') {
        setConnectionStatus('reconnecting');
        setErrorMessage(null);
        if (lastConnectParamsRef.current && roomRef.current?.state !== 'connected') {
          retryConnection();
        }
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      setConnectionStatus('offline');
      setErrorMessage('Your internet connection was lost. Reconnecting when network returns...');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectionStatus, retryConnection]);

  // Handle page visibility changes (Android Chrome app-switch or screen lock)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const room = roomRef.current;
        if (room) {
          // Do not falsely report healthy connection if disconnected while in background
          if (room.state === 'connected') {
            setIsAudioBlocked(!room.canPlaybackAudio);
            setConnectionStatus('connected');
            if (!room.canPlaybackAudio) {
              room.startAudio().catch(() => {});
            }
          } else if (room.state === 'reconnecting') {
            setConnectionStatus('reconnecting');
          } else if (room.state === 'disconnected') {
            setConnectionStatus('disconnected');
            setErrorMessage('Connection closed while the tab was in the background. Tap Retry to reconnect.');
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Ensure cleanup on component unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    getRoom: () => roomRef.current,
    connectionStatus,
    isOffline,
    errorMessage,
    deviceError,
    setDeviceError,
    isAudioBlocked,
    isCameraEnabled,
    isMicEnabled,
    isScreenShareEnabled,
    localCameraTrack,
    localScreenTrack,
    remoteParticipant,
    remoteCameraTrack,
    remoteAudioTrack,
    remoteScreenTrack,
    remoteScreenAudioTrack,
    isRemoteCameraMuted,
    isRemoteMicMuted,
    localIsSpeaking,
    remoteIsSpeaking,
    connect,
    retryConnection,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
    unlockAudio,
  };
}
