import React from 'react';
import { Heart, UserPlus, LogOut, Sparkles } from 'lucide-react';
import type { ConnectionStatus, ParticipantRole } from '../types/index.js';

interface NavbarProps {
  roomId: string;
  connectionStatus: ConnectionStatus;
  role: ParticipantRole;
  onOpenInvite: () => void;
  onLeaveRoom: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomId,
  connectionStatus,
  role,
  onOpenInvite,
  onLeaveRoom,
}) => {
  return (
    <header className="room-navbar">
      <div className="brand-section">
        <div className="brand-title">
          <Heart className="pulse-heart" size={20} fill="#ec4899" />
          <span>Date Night</span>
          <Sparkles size={16} color="#c084fc" />
        </div>

        <div className="status-badge">
          <span
            className={`status-dot ${
              connectionStatus === 'reconnecting'
                ? 'reconnecting'
                : connectionStatus === 'disconnected'
                ? 'disconnected'
                : ''
            }`}
          />
          <span>
            {connectionStatus === 'connected'
              ? 'Connected'
              : connectionStatus === 'reconnecting'
              ? 'Reconnecting...'
              : 'Connecting...'}
          </span>
        </div>

        <div
          style={{
            fontSize: '0.8rem',
            color: '#a19bb8',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span>Room: </span>
          <strong style={{ color: '#d8b4fe' }}>{roomId}</strong>
          <span style={{ marginLeft: '6px', opacity: 0.7 }}>({role})</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button
          className="btn-ghost"
          onClick={onOpenInvite}
          title="Share invitation link"
          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
        >
          <UserPlus size={16} color="#c084fc" />
          <span>Invite</span>
        </button>

        <button
          className="btn-danger"
          onClick={onLeaveRoom}
          title="Leave party"
          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
        >
          <LogOut size={16} />
          <span>Leave</span>
        </button>
      </div>
    </header>
  );
};
