import React from 'react';
import { Volume2 } from 'lucide-react';

interface AudioUnlockBannerProps {
  onUnlock: () => void;
}

export const AudioUnlockBanner: React.FC<AudioUnlockBannerProps> = ({ onUnlock }) => {
  return (
    <div
      className="audio-unlock-overlay"
      onClick={onUnlock}
      title="Tap to allow audio playback"
    >
      <Volume2 size={20} />
      <span>Audio is muted by your browser. Tap here to listen!</span>
    </div>
  );
};
