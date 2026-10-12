import React, { useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { Maximize, Minimize, Film, Share2, Info } from 'lucide-react';

interface ScreenViewerProps {
  screenTrack: Track | null;
  screenAudioTrack: Track | null;
  isHost: boolean;
  onStartShare: () => void;
}

export const ScreenViewer: React.FC<ScreenViewerProps> = ({
  screenTrack,
  screenAudioTrack,
  isHost,
  onStartShare,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Attach screen video track
  useEffect(() => {
    const videoElem = videoRef.current;
    if (screenTrack && videoElem) {
      screenTrack.attach(videoElem);
      return () => {
        screenTrack.detach(videoElem);
      };
    }
  }, [screenTrack]);

  // Attach screen audio track (tab sound)
  useEffect(() => {
    const audioElem = audioRef.current;
    if (screenAudioTrack && audioElem) {
      screenAudioTrack.attach(audioElem);
      return () => {
        screenAudioTrack.detach(audioElem);
      };
    }
  }, [screenAudioTrack]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="screen-wrapper" ref={containerRef}>
      {/* Audio element for screen share sound */}
      <audio ref={audioRef} autoPlay />

      {screenTrack ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="screen-video"
          />

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(0, 0, 0, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 30,
              backdropFilter: 'blur(8px)',
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </>
      ) : (
        <div className="theatre-standby">
          <Film size={52} color="#c084fc" />
          <h2>Cozy Date Night Theatre</h2>
          <p>
            The screen is currently waiting for a video to begin. Settle in with some snacks!
          </p>

          {isHost && (
            <button
              className="btn-romantic"
              onClick={onStartShare}
              style={{ marginBottom: '24px' }}
            >
              <Share2 size={18} />
              <span>Share Screen / Tab</span>
            </button>
          )}

          <div className="tips-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Info size={16} color="#ec4899" />
              <strong>Tips for Best Video & Sound:</strong>
            </div>
            <ul style={{ paddingLeft: '18px', margin: 0 }}>
              <li>
                To share sound, select <strong>"Chrome Tab"</strong> in the browser prompt and make sure <strong>"Also share tab audio"</strong> is checked.
              </li>
              <li style={{ marginTop: '4px' }}>
                Streaming services (Netflix, Prime, Disney+) use DRM encryption that automatically blacks out screens. Play YouTube, Twitch, Vimeo, or open your own movie files directly in the browser!
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
