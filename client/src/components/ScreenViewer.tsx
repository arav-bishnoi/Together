import React, { useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { Maximize, Minimize, Film, Share2, StopCircle, Info, ExternalLink, ShieldAlert } from 'lucide-react';

interface ScreenViewerProps {
  screenTrack: Track | null;
  screenAudioTrack: Track | null;
  isHost: boolean;
  isSharing?: boolean;
  onStartShare: () => void;
  onStopShare?: () => void;
  theatreRef?: React.RefObject<HTMLDivElement | null>;
}

export const ScreenViewer: React.FC<ScreenViewerProps> = ({
  screenTrack,
  screenAudioTrack,
  isHost,
  isSharing = false,
  onStartShare,
  onStopShare,
  theatreRef,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDrmModal, setShowDrmModal] = useState(false);

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

  // Attach screen audio track (tab sound - only for remote viewers to prevent local echo)
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
    // Prefer fullscreen on the entire theatre stage so floating camera feeds remain visible
    const targetElem = theatreRef?.current || containerRef.current;
    if (!targetElem) return;

    try {
      if (!document.fullscreenElement) {
        if (targetElem.requestFullscreen) {
          await targetElem.requestFullscreen();
        } else if ((targetElem as any).webkitRequestFullscreen) {
          await (targetElem as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
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
      {/* Audio element for remote screen share audio (tab audio) */}
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

          {/* Top Bar Floating Controls */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              zIndex: 30,
            }}
          >
            {isSharing && onStopShare && (
              <button
                onClick={onStopShare}
                className="btn-danger"
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                }}
                title="Stop sharing your screen"
              >
                <StopCircle size={15} />
                <span>Stop Sharing</span>
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              style={{
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
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
              }}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </>
      ) : (
        <div className="theatre-standby">
          <Film size={52} color="var(--accent-primary)" />
          <h2>Watch Together</h2>
          <p>
            The screen is currently waiting for video or screen share to begin.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
            {isHost && (
              <button
                className="btn-primary"
                onClick={onStartShare}
              >
                <Share2 size={18} />
                <span>Share Screen / Tab</span>
              </button>
            )}

            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                window.open('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', '_blank')
              }
              title="Open open-source test video in a new tab to test screen + audio sharing"
              style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            >
              <ExternalLink size={16} color="var(--accent-primary)" />
              <span>Open Free HD Test Video</span>
            </button>
          </div>

          <div className="tips-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={16} color="var(--accent-primary)" />
                <strong>Tips for Best Video & Sound:</strong>
              </div>
              <button
                type="button"
                onClick={() => setShowDrmModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.78rem',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Why Netflix/Prime DRM blacks out
              </button>
            </div>
            <ul style={{ paddingLeft: '18px', margin: 0 }}>
              <li>
                To share sound, select <strong>"Chrome Tab"</strong> in the browser prompt and make sure <strong>"Also share tab audio"</strong> is checked.
              </li>
              <li style={{ marginTop: '4px' }}>
                Works great with <strong>YouTube, Twitch, Vimeo</strong>, or your own video files (MP4/MKV) opened in Chrome!
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* DRM & OTT Limitation Info Modal */}
      {showDrmModal && (
        <div className="modal-overlay" onClick={() => setShowDrmModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <ShieldAlert size={24} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Streaming Services & DRM Limitations
              </h3>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
              Commercial streaming services (like <strong>Netflix, Amazon Prime Video, Disney+, Hulu</strong>) enforce hardware-level DRM (Digital Rights Management via Widevine / HDCP).
            </p>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '12px' }}>
              When you attempt to screen share these protected tabs, the browser and operating system automatically black out the video and mute protected audio. This is a browser security constraint, not an application error.
            </p>
            <div
              style={{
                background: 'rgba(212, 222, 149, 0.08)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '12px',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                marginBottom: '20px',
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>Recommended for Watch Parties:</strong>
              <ul style={{ paddingLeft: '16px', margin: '6px 0 0' }}>
                <li>YouTube, Twitch, Vimeo, and web video players.</li>
                <li>Your own personal movie or video files: simply drag any .mp4 or .webm file into an empty browser tab and share that tab with audio!</li>
              </ul>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowDrmModal(false)}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
