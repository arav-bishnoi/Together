import React, { useEffect, useState, useRef } from 'react';
import type { RoomSession } from '../types/index.js';
import { useLiveKit } from '../hooks/useLiveKit.js';
import { Navbar } from '../components/Navbar.js';
import { Controls } from '../components/Controls.js';
import { ScreenViewer } from '../components/ScreenViewer.js';
import { FloatingCamera } from '../components/FloatingCamera.js';
import { AudioUnlockBanner } from '../components/AudioUnlockBanner.js';
import { InviteModal } from '../components/InviteModal.js';
import { User, MicOff, AlertCircle, X, UserPlus, Clock, WifiOff, RefreshCw } from 'lucide-react';
import '../styles/room.css';

interface RoomPageProps {
  session: RoomSession;
  onLeave: () => void;
}

export const RoomPage: React.FC<RoomPageProps> = ({ session, onLeave }) => {
  const {
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
  } = useLiveKit();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'theatre' | 'call'>('theatre');
  const [isRetrying, setIsRetrying] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const theatreStageRef = useRef<HTMLDivElement | null>(null);

  const hasScreenShare = !!(remoteScreenTrack || localScreenTrack);

  // Automatically switch to theatre view if screen share starts
  useEffect(() => {
    if (hasScreenShare) {
      setViewMode('theatre');
    }
  }, [hasScreenShare]);

  // Connect to LiveKit SFU on mount using provided credentials and ICE config
  useEffect(() => {
    connect(session.livekitUrl, session.token, session.iceServers);
  }, [connect, session.livekitUrl, session.token, session.iceServers]);

  // Manual retry handler that queries /api/rooms/reconnect for fresh token & ICE servers
  const handleManualRetry = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch('/api/rooms/reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: session.roomId,
          role: session.role,
          secret: session.role === 'host' ? session.hostSecret : session.inviteSecret,
          participantId: session.participantId,
          displayName: session.displayName,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await retryConnection(data.livekitUrl, data.token, data.iceServers);
      } else {
        await retryConnection(session.livekitUrl, session.token, session.iceServers);
      }
    } catch {
      await retryConnection(session.livekitUrl, session.token, session.iceServers);
    } finally {
      setIsRetrying(false);
    }
  };

  // Attach local camera video track in side-by-side mode
  useEffect(() => {
    const videoElem = localVideoRef.current;
    if (localCameraTrack && videoElem && viewMode === 'call') {
      localCameraTrack.attach(videoElem);
      return () => {
        localCameraTrack.detach(videoElem);
      };
    }
  }, [localCameraTrack, viewMode]);

  // Attach remote camera video track in side-by-side mode
  useEffect(() => {
    const videoElem = remoteVideoRef.current;
    if (remoteCameraTrack && videoElem && viewMode === 'call') {
      remoteCameraTrack.attach(videoElem);
      return () => {
        remoteCameraTrack.detach(videoElem);
      };
    }
  }, [remoteCameraTrack, viewMode]);

  // Attach remote voice audio track to audio element
  useEffect(() => {
    const audioElem = remoteAudioRef.current;
    if (remoteAudioTrack && audioElem) {
      remoteAudioTrack.attach(audioElem);
      return () => {
        remoteAudioTrack.detach(audioElem);
      };
    }
  }, [remoteAudioTrack]);

  // Handle participant leave
  const handleLeave = async () => {
    try {
      sessionStorage.removeItem('watch_party_session');
      await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: session.roomId,
          participantId: session.participantId,
        }),
      });
    } catch {
      // Ignore network errors on departure
    }
    disconnect();
    onLeave();
  };

  const partnerName = remoteParticipant?.name || 'Partner';

  return (
    <div className="room-container">
      {/* Background audio player for partner's live voice */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Top Navbar */}
      <Navbar
        roomId={session.roomId}
        connectionStatus={connectionStatus}
        role={session.role}
        viewMode={viewMode}
        hasScreenShare={hasScreenShare}
        onToggleViewMode={() => setViewMode((prev) => (prev === 'theatre' ? 'call' : 'theatre'))}
        onOpenInvite={() => setIsInviteOpen(true)}
        onLeaveRoom={handleLeave}
      />

      {/* Mobile Autoplay Permission Banner */}
      {isAudioBlocked && <AudioUnlockBanner onUnlock={unlockAudio} />}

      {/* Network Alert / Offline / Reconnection Banner with Manual Retry Action */}
      {(isOffline || connectionStatus === 'reconnecting' || connectionStatus === 'offline' || (connectionStatus === 'error' && errorMessage)) && (
        <div className="network-alert-banner">
          <div className="network-alert-content">
            {isOffline ? (
              <>
                <WifiOff size={18} color="#f87171" />
                <span>You are currently offline. Check your internet connection.</span>
              </>
            ) : connectionStatus === 'reconnecting' ? (
              <>
                <RefreshCw size={18} className="spin-slow" color="#fbbf24" />
                <span>Network interrupted. Attempting to reconnect...</span>
              </>
            ) : (
              <>
                <AlertCircle size={18} color="#f87171" />
                <span>{errorMessage || 'Connection interrupted.'}</span>
              </>
            )}
          </div>

          <button
            type="button"
            className="btn-retry"
            onClick={handleManualRetry}
            disabled={isRetrying}
          >
            <RefreshCw size={14} className={isRetrying ? 'spin-fast' : ''} />
            <span>{isRetrying ? 'Reconnecting...' : 'Retry Connection'}</span>
          </button>
        </div>
      )}

      {/* Device/Permission Error Toast */}
      {deviceError && (
        <div
          style={{
            position: 'absolute',
            top: '70px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(239, 68, 68, 0.95)',
            color: '#ffffff',
            padding: '10px 20px',
            borderRadius: 'var(--radius-full)',
            zIndex: 100,
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 25px rgba(239, 68, 68, 0.4)',
          }}
        >
          <AlertCircle size={16} />
          <span>{deviceError}</span>
          <button
            onClick={() => setDeviceError(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Active Stage: Theatre View (Screen + Draggable PIP Cameras) OR Call View (Side by Side) */}
      {viewMode === 'theatre' ? (
        <div className="theatre-stage" ref={theatreStageRef}>
          {/* Main Theatre Screen Viewer */}
          <ScreenViewer
            screenTrack={remoteScreenTrack || localScreenTrack}
            screenAudioTrack={remoteScreenAudioTrack}
            isHost={session.role === 'host'}
            isSharing={isScreenShareEnabled}
            onStartShare={toggleScreenShare}
            onStopShare={toggleScreenShare}
            theatreRef={theatreStageRef}
          />

          {/* Draggable Floating PIP Camera: Remote Partner */}
          <FloatingCamera
            participantName={partnerName}
            track={remoteCameraTrack && !isRemoteCameraMuted ? remoteCameraTrack : null}
            isMuted={isRemoteMicMuted}
            isSpeaking={remoteIsSpeaking}
            initialPosition={{
              x: typeof window !== 'undefined' ? Math.max(15, window.innerWidth - (window.innerWidth <= 768 ? 165 : 240)) : 800,
              y: 75,
            }}
          />

          {/* Draggable Floating PIP Camera: Local User (You) */}
          <FloatingCamera
            participantName={`${session.displayName} (You)`}
            track={isCameraEnabled && localCameraTrack ? localCameraTrack : null}
            isMuted={!isMicEnabled}
            isSpeaking={localIsSpeaking}
            isLocal={true}
            initialPosition={{
              x: 20,
              y: 75,
            }}
          />
        </div>
      ) : (
        /* Alternative View: Side-by-Side Video Stage */
        <main
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
            padding: '24px',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%',
            overflowY: 'auto',
          }}
        >
          {/* Frame 1: Remote Partner Video */}
          <div
            className={`glass-panel ${remoteIsSpeaking ? 'speaking-ring' : ''}`}
            style={{
              height: '100%',
              maxHeight: '440px',
              minHeight: '260px',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#090712',
              border: '1.5px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6)',
            }}
          >
            {remoteParticipant ? (
              <>
                {remoteCameraTrack && !isRemoteCameraMuted ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <div className="avatar-circle">
                      {partnerName.charAt(0).toUpperCase() || <User size={24} />}
                    </div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>Camera is turned off</span>
                  </div>
                )}

                {/* Status Header Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    top: '14px',
                    left: '16px',
                    right: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 5,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(0, 0, 0, 0.65)',
                      padding: '4px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <span>{partnerName}</span>
                    {isRemoteMicMuted && <MicOff size={13} color="var(--danger)" />}
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '30px 20px',
                  color: 'var(--text-secondary)',
                }}
              >
                <Clock size={40} color="var(--accent-muted)" style={{ marginBottom: '14px' }} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Waiting for Partner to Join
                </h3>
                <p style={{ fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.5, marginBottom: '18px' }}>
                  Share your private invitation link with your partner so she can connect to this room.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setIsInviteOpen(true)}
                  style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                >
                  <UserPlus size={16} />
                  <span>Get Invitation Link</span>
                </button>
              </div>
            )}
          </div>

          {/* Frame 2: Local Participant Video (You) */}
          <div
            className={`glass-panel ${localIsSpeaking ? 'speaking-ring' : ''}`}
            style={{
              height: '100%',
              maxHeight: '440px',
              minHeight: '260px',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#090712',
              border: '1.5px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 12px 35px rgba(0, 0, 0, 0.6)',
            }}
          >
            {isCameraEnabled && localCameraTrack ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)', // Local camera mirror
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                <div className="avatar-circle">
                  {session.displayName.charAt(0).toUpperCase() || <User size={24} />}
                </div>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>Your camera is turned off</span>
              </div>
            )}

            {/* Status Header Overlay */}
            <div
              style={{
                position: 'absolute',
                top: '14px',
                left: '16px',
                right: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 5,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(0, 0, 0, 0.65)',
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#ffffff',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span>{session.displayName} (You)</span>
                {!isMicEnabled && <MicOff size={13} color="var(--danger)" />}
              </div>
            </div>
          </div>
        </main>
      )}

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
