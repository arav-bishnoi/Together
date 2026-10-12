import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  UserPlus,
  PhoneOff,
} from 'lucide-react';

interface ControlsProps {
  isCameraEnabled: boolean;
  isMicEnabled: boolean;
  isScreenShareEnabled?: boolean;
  isHost?: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleScreenShare?: () => void;
  onOpenInvite: () => void;
  onLeaveRoom: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  isCameraEnabled,
  isMicEnabled,
  isScreenShareEnabled = false,
  isHost = false,
  onToggleCamera,
  onToggleMic,
  onToggleScreenShare,
  onOpenInvite,
  onLeaveRoom,
}) => {
  return (
    <div className="controls-wrapper">
      <div className="controls-pill">
        {/* Microphone Toggle */}
        <button
          className={`ctrl-btn ${!isMicEnabled ? 'off' : ''}`}
          onClick={onToggleMic}
          title={isMicEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
        </button>

        {/* Camera Toggle */}
        <button
          className={`ctrl-btn ${!isCameraEnabled ? 'off' : ''}`}
          onClick={onToggleCamera}
          title={isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
        >
          {isCameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        {/* Screen Share Toggle (Only if handler provided) */}
        {onToggleScreenShare && isHost && (
          <button
            className={`ctrl-btn ${isScreenShareEnabled ? 'active' : ''}`}
            onClick={onToggleScreenShare}
            title={isScreenShareEnabled ? 'Stop Screen Sharing' : 'Share Screen / Tab with Audio'}
          >
            {isScreenShareEnabled ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
          </button>
        )}

        {/* Invite Modal Button */}
        <button
          className="ctrl-btn"
          onClick={onOpenInvite}
          title="Share Invite Link & Passcode"
        >
          <UserPlus size={20} color="var(--accent-muted)" />
        </button>

        {/* Leave Room Button */}
        <button
          className="ctrl-btn danger"
          onClick={onLeaveRoom}
          title="Leave Watch Party"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
};
