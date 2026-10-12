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

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAudioBlocked, setIsAudioBlocked] = useState<boolean>(false);

  // Local device states
  const [isCameraEnabled, setIsCameraEnabled] = useState<boolean>(false);
  const [isMicEnabled, setIsMicEnabled] = useState<boolean>(true);
  const [isScreenShareEnabled, setIsScreenShareEnabled] = useState<boolean>(false);

  // Tracks for rendering
  const [localCameraTrack, setLocalCameraTrack] = useState<LocalVideoTrack | null>(null);
  const [localScreenTrack, setLocalScreenTrack] = useState<LocalVideoTrack | null>(null);

  const [remoteParticipant, setRemoteParticipant] = useState<RemoteParticipant | null>(null);
  const [remoteCameraTrack, setRemoteCameraTrack] = useState<Track | null>(null);
  const [remoteScreenTrack, setRemoteScreenTrack] = useState<Track | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<Track | null>(null);
  const [remoteScreenAudioTrack, setRemoteScreenAudioTrack] = useState<Track | null>(null);

  // Speaking indicators
  const [localIsSpeaking, setLocalIsSpeaking] = useState<boolean>(false);
  const [remoteIsSpeaking, setRemoteIsSpeaking] = useState<boolean>(false);

  // Clean room initialization
  const getOrCreateRoom = useCallback(() => {
    if (!roomRef.current) {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Track subscriptions
      room.on(RoomEvent.TrackSubscribed, (track: Track, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        setRemoteParticipant(participant);

        if (track.source === Track.Source.Camera) {
          setRemoteCameraTrack(track);
        } else if (track.source === Track.Source.ScreenShare) {
          setRemoteScreenTrack(track);
        } else if (track.source === Track.Source.Microphone) {
          setRemoteAudioTrack(track);
        } else if (track.source === Track.Source.ScreenShareAudio) {
          setRemoteScreenAudioTrack(track);
        }
      });

      // Track unsubscribed
      room.on(RoomEvent.TrackUnsubscribed, (track: Track) => {
        if (track.source === Track.Source.Camera) {
          setRemoteCameraTrack(null);
        } else if (track.source === Track.Source.ScreenShare) {
          setRemoteScreenTrack(null);
        } else if (track.source === Track.Source.Microphone) {
          setRemoteAudioTrack(null);
        } else if (track.source === Track.Source.ScreenShareAudio) {
          setRemoteScreenAudioTrack(null);
        }
      });

      // Participant events
      room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
        setRemoteParticipant(participant);
      });

      room.on(RoomEvent.ParticipantDisconnected, () => {
        setRemoteParticipant(null);
        setRemoteCameraTrack(null);
        setRemoteScreenTrack(null);
        setRemoteAudioTrack(null);
        setRemoteScreenAudioTrack(null);
      });

      // Active speakers
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        const localSpeaking = speakers.some((s) => s.identity === room.localParticipant?.identity);
        const remoteSpeaking = speakers.some((s) => s.identity !== room.localParticipant?.identity);
        setLocalIsSpeaking(localSpeaking);
        setRemoteIsSpeaking(remoteSpeaking);
      });

      // Autoplay / Audio restrictions on mobile
      room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
        setIsAudioBlocked(!room.canPlaybackAudio);
      });

      // Connection lifecycle
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

      // Local track unpublished (e.g. user clicks "Stop Sharing" on browser's native banner)
      room.on(RoomEvent.LocalTrackUnpublished, (pub: TrackPublication) => {
        if (pub.source === Track.Source.ScreenShare) {
          setIsScreenShareEnabled(false);
          setLocalScreenTrack(null);
        } else if (pub.source === Track.Source.Camera) {
          setIsCameraEnabled(false);
          setLocalCameraTrack(null);
        }
      });

      roomRef.current = room;
    }
    return roomRef.current;
  }, []);

  const connect = useCallback(async (livekitUrl: string, token: string) => {
    try {
      setConnectionStatus('connecting');
      setErrorMessage(null);
      const room = getOrCreateRoom();

      await room.connect(livekitUrl, token);

      // Attempt to enable microphone by default with gentle fallback
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        setIsMicEnabled(true);
      } catch (err: any) {
        console.warn('Microphone permission not granted yet:', err?.message);
        setIsMicEnabled(false);
      }
    } catch (err: any) {
      console.error('Failed to connect to LiveKit room:', err);
      setConnectionStatus('error');
      setErrorMessage(err?.message || 'Could not connect to watch party media server.');
    }
  }, [getOrCreateRoom]);

  const disconnect = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setConnectionStatus('disconnected');
    setLocalCameraTrack(null);
    setLocalScreenTrack(null);
    setRemoteParticipant(null);
    setRemoteCameraTrack(null);
    setRemoteScreenTrack(null);
  }, []);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

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
      console.error('Failed to toggle camera:', err);
      alert('Camera access denied or unavailable. Please check browser permissions.');
    }
  }, [isCameraEnabled]);

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      const nextState = !isMicEnabled;
      await room.localParticipant.setMicrophoneEnabled(nextState);
      setIsMicEnabled(nextState);
    } catch (err: any) {
      console.error('Failed to toggle microphone:', err);
      alert('Microphone access denied or unavailable.');
    }
  }, [isMicEnabled]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      if (isScreenShareEnabled) {
        await room.localParticipant.setScreenShareEnabled(false);
        setIsScreenShareEnabled(false);
        setLocalScreenTrack(null);
      } else {
        // Request screen share with audio
        await room.localParticipant.setScreenShareEnabled(true, {
          audio: true,
          selfBrowserSurface: 'include',
        });
        setIsScreenShareEnabled(true);

        const screenPub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
        if (screenPub?.track) {
          setLocalScreenTrack(screenPub.track as LocalVideoTrack);
        }
      }
    } catch (err: any) {
      // User cancelled screen picker or browser denied
      console.log('Screen sharing cancelled or unavailable:', err?.message);
      setIsScreenShareEnabled(false);
      setLocalScreenTrack(null);
    }
  }, [isScreenShareEnabled]);

  const unlockAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setIsAudioBlocked(false);
    } catch (err: any) {
      console.warn('Failed to unlock audio:', err?.message);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    room: roomRef.current,
    connectionStatus,
    errorMessage,
    isAudioBlocked,
    isCameraEnabled,
    isMicEnabled,
    isScreenShareEnabled,
    localCameraTrack,
    localScreenTrack,
    remoteParticipant,
    remoteCameraTrack,
    remoteScreenTrack,
    remoteAudioTrack,
    remoteScreenAudioTrack,
    localIsSpeaking,
    remoteIsSpeaking,
    connect,
    disconnect,
    toggleCamera,
    toggleMicrophone,
    toggleScreenShare,
    unlockAudio,
  };
}
