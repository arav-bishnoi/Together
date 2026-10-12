import React, { useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { MicOff, ChevronDown, ChevronUp, User } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable.js';

interface FloatingCameraProps {
  participantName: string;
  track: Track | null;
  isMuted: boolean;
  isSpeaking: boolean;
  initialPosition: { x: number; y: number };
  isLocal?: boolean;
}

export const FloatingCamera: React.FC<FloatingCameraProps> = ({
  participantName,
  track,
  isMuted,
  isSpeaking,
  initialPosition,
  isLocal = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const cardWidth = isMinimized ? 140 : 220;
  const cardHeight = isMinimized ? 48 : 155;

  const { position, dragHandlers } = useDraggable({
    initialPosition,
    elementWidth: cardWidth,
    elementHeight: cardHeight,
  });

  useEffect(() => {
    const videoElem = videoRef.current;
    if (track && videoElem) {
      track.attach(videoElem);
      return () => {
        track.detach(videoElem);
      };
    }
  }, [track]);

  return (
    <div
      className={`floating-camera-card ${isMinimized ? 'minimized' : ''} ${
        isSpeaking ? 'speaking-ring' : ''
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      {...dragHandlers}
    >
      {/* Top Header Bar */}
      <div className="camera-header-bar">
        <div className="participant-label">
          <span>{participantName}</span>
          {isMuted && <MicOff size={13} color="#fca5a5" />}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized((prev) => !prev);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#d8b4fe',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          title={isMinimized ? 'Expand Camera' : 'Minimize Camera'}
        >
          {isMinimized ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Camera Video / Placeholder */}
      {!isMinimized && (
        <>
          {track ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isLocal}
              className="camera-video-elem"
            />
          ) : (
            <div className="camera-off-placeholder">
              <div className="avatar-circle">
                {participantName.charAt(0).toUpperCase() || <User size={20} />}
              </div>
              <span style={{ fontSize: '0.75rem', marginTop: '6px', color: '#a78bfa' }}>
                Camera Off
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
