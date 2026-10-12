import React, { useEffect, useState, useRef } from 'react';
import type { RoomSession } from '../types/index.js';
import { useLiveKit } from '../hooks/useLiveKit.js';
import { Navbar } from '../components/Navbar.js';
import { ScreenViewer } from '../components/ScreenViewer.js';
import { FloatingCamera } from '../components/FloatingCamera.js';
import { Controls } from '../components/Controls.js';
import { AudioUnlockBanner } from '../components/AudioUnlockBanner.js';
import { InviteModal } from '../components/InviteModal.js';
import '../styles/room.css';

interface RoomPageProps {
  session: RoomSession;
  onLeave: () => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({ session, onLeave }) => {
  const {
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
  } = useLiveKit();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const remoteVoiceAudioRef = useRef<HTMLAudioElement | null>(null);

  // Connect to LiveKit on load
  useEffect(() => {
    connect(session.livekitUrl, session.token);
  }, [connect, session.livekitUrl, session.token]);

  // Attach partner's voice track to background audio element
  useEffect(() => {
    const audioElem = remoteVoiceAudioRef.current;
    if (remoteAudioTrack && audioElem) {
      remoteAudioTrack.attach(audioElem);
      return () => {
        remoteAudioTrack.detach(audioElem);
      };
    }
  }, [remoteAudioTrack]);

  // Handle leave
  const handleLeave = async () => {
    try {
      await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: session.roomId,
          participantId: session.participantId,
        }),
      });
    } catch {
      // Ignore network errors on leave
    }
    disconnect();
    onLeave();
  };

  // Determine active screen share (either partner is sharing, or you are sharing)
  const activeScreenTrack = remoteScreenTrack || localScreenTrack;
  const partnerName = remoteParticipant?.name || 'Partner';

  return (
    <div className="room-container">
      {/* Background audio player for partner's microphone */}
      <audio ref={remoteVoiceAudioRef} autoPlay />

      {/* Top Navigation */}
      <Navbar
        roomId={session.roomId}
        connectionStatus={connectionStatus}
        role={session.role}
        onOpenInvite={() => setIsInviteOpen(true)}
        onLeaveRoom={handleLeave}
      />

      {/* Android Mobile Audio Unlock Banner */}
      {isAudioBlocked && <AudioUnlockBanner onUnlock={unlockAudio} />}

      {/* Error Banner */}
      {errorMessage && (
        <div
          style={{
            position: 'absolute',
            top: '64px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(239, 68, 68, 0.9)',
            color: '#ffffff',
            padding: '8px 18px',
            borderRadius: 'var(--radius-full)',
            zIndex: 100,
            fontSize: '0.85rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Main Theatre Area */}
      <main className="theatre-stage">
        <ScreenViewer
          screenTrack={activeScreenTrack}
          screenAudioTrack={remoteScreenAudioTrack}
          isHost={session.role === 'host'}
          onStartShare={toggleScreenShare}
        />

        {/* Floating Camera 1: Partner (Guest / Host) */}
        {remoteParticipant && (
          <FloatingCamera
            participantName={`${partnerName} ❤️`}
            track={remoteCameraTrack}
            isMuted={!remoteAudioTrack}
            isSpeaking={remoteIsSpeaking}
            initialPosition={{ x: 24, y: 75 }}
            isLocal={false}
          />
        )}

        {/* Floating Camera 2: You */}
        <FloatingCamera
          participantName={`${session.displayName} (You)`}
          track={localCameraTrack}
          isMuted={!isMicEnabled}
          isSpeaking={localIsSpeaking}
          initialPosition={{ x: Math.max(20, window.innerWidth - 240), y: 75 }}
          isLocal={true}
        />
      </main>

      {/* Floating Bottom Media Controls */}
      <Controls
        isCameraEnabled={isCameraEnabled}
        isMicEnabled={isMicEnabled}
        isScreenShareEnabled={isScreenShareEnabled}
        isHost={session.role === 'host'}
        onToggleCamera={toggleCamera}
        onToggleMic={toggleMicrophone}
        onToggleScreenShare={toggleScreenShare}
        onOpenInvite={() => setIsInviteOpen(true)}
        onLeaveRoom={handleLeave}
      />

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roomId={session.roomId}
        inviteSecret={session.inviteSecret}
      />
    </div>
  );
};
