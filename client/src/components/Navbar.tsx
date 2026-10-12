import React from 'react';
import { Heart, UserPlus, LogOut, Sparkles, Tv, Users } from 'lucide-react';
import type { ConnectionStatus, ParticipantRole } from '../types/index.js';

interface NavbarProps {
  roomId: string;
  connectionStatus: ConnectionStatus;
  role: ParticipantRole;
  viewMode?: 'theatre' | 'call';
  hasScreenShare?: boolean;
  onToggleViewMode?: () => void;
  onOpenInvite: () => void;
  onLeaveRoom: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomId,
  connectionStatus,
  role,
  viewMode,
  hasScreenShare = false,
  onToggleViewMode,
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

        {hasScreenShare && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(236, 72, 153, 0.2)',
              border: '1px solid rgba(236, 72, 153, 0.4)',
              color: '#f472b6',
              animation: 'heartPulse 2s infinite ease-in-out',
            }}
          >
            <Tv size={13} />
            <span>Screen Live</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {onToggleViewMode && (
          <button
            type="button"
            className="btn-ghost"
            onClick={onToggleViewMode}
            title={viewMode === 'theatre' ? 'Switch to Side-by-Side Video Stage' : 'Switch to Watch Party Theatre'}
            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
          >
            {viewMode === 'theatre' ? (
              <>
                <Users size={15} color="#c084fc" />
                <span>Side by Side</span>
              </>
            ) : (
              <>
                <Tv size={15} color="#ec4899" />
                <span>Theatre View</span>
              </>
            )}
          </button>
        )}

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
