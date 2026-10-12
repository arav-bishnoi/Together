import React, { useState, useEffect } from 'react';
import {
  Film,
  Lock,
  Sparkles,
  User,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Ban,
  Link,
  ShieldAlert,
} from 'lucide-react';
import type { RoomSession } from '../types/index.js';

interface LobbyPageProps {
  onSessionReady?: (session: RoomSession) => void;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({ onSessionReady }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // Form states
  const [hostName, setHostName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [inviteSecret, setInviteSecret] = useState('');

  // UI status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<RoomSession | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRevoked, setIsRevoked] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Inspect URL for invitation query parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    // Supports both 'invite' and 'key' for backwards compatibility
    const urlInvite = params.get('invite') || params.get('key');

    if (urlRoom && urlInvite) {
      setRoomId(urlRoom);
      setInviteSecret(urlInvite);
      setActiveTab('join');
    }
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setActionSuccessMessage(null);

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: hostName.trim() || 'Host' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create room. Please try again.');
      }

      setIsRevoked(false);
      setCreatedSession({
        roomId: data.roomId,
        hostSecret: data.hostSecret,
        inviteSecret: data.inviteSecret,
        token: data.token,
        livekitUrl: data.livekitUrl,
        role: 'host',
        participantId: data.participant.id,
        displayName: data.participant.name,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Cannot reach backend server. Please verify backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !inviteSecret.trim()) {
      setErrorMessage('Please provide both the Room ID and the invitation credential.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setActionSuccessMessage(null);

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomId.trim(),
          inviteSecret: inviteSecret.trim(),
          guestName: guestName.trim() || 'Guest',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to join room. Check your invitation link.');
      }

      const guestSession = {
        roomId: data.roomId,
        inviteSecret: inviteSecret.trim(),
        token: data.token,
        livekitUrl: data.livekitUrl,
        role: 'guest' as const,
        participantId: data.participant.id,
        displayName: data.participant.name,
      };

      if (onSessionReady) {
        onSessionReady(guestSession);
      } else {
        setCreatedSession(guestSession);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to join watch party.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeInvitation = async () => {
    if (!createdSession || !createdSession.hostSecret) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/rooms/revoke-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: createdSession.roomId,
          hostSecret: createdSession.hostSecret,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke invitation.');
      }

      setIsRevoked(true);
      setActionSuccessMessage('Invitation link revoked. Guests can no longer use this link.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateInvitation = async () => {
    if (!createdSession || !createdSession.hostSecret) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/rooms/regenerate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: createdSession.roomId,
          hostSecret: createdSession.hostSecret,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate new invitation.');
      }

      setCreatedSession({
        ...createdSession,
        inviteSecret: data.newInviteSecret,
      });
      setIsRevoked(false);
      setActionSuccessMessage('New invitation generated. Send the updated link to your partner.');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, isLink: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isLink) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      alert('Copied: ' + text);
    }
  };

  const inviteUrl = createdSession
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
        createdSession.roomId
      )}&invite=${encodeURIComponent(createdSession.inviteSecret)}`
    : '';

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 16px',
        background: 'radial-gradient(circle at 50% 15%, #18122d 0%, var(--bg-deep) 70%)',
        position: 'relative',
        minHeight: '100dvh',
      }}
    >
      {/* Subtle ambient violet illumination */}
      <div
        style={{
          position: 'absolute',
          top: '18%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '380px',
          height: '380px',
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: '500px', zIndex: 10 }}>
        {/* Brand Header */}
        <header style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-muted)',
              fontSize: '0.82rem',
              fontWeight: 500,
              letterSpacing: '0.02em',
              marginBottom: '16px',
            }}
          >
            <Sparkles size={14} color="#a78bfa" />
            <span>Private Two-Person Cinema</span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '2.4rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #ffffff 40%, #c4b5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '8px',
            }}
          >
            Our Watch Party
          </h1>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
            A private, synchronized sanctuary for two.
          </p>
        </header>

        {/* Success Card when Room is Initialized (Phase 2 Authorization View) */}
        {createdSession ? (
          <div className="glass-panel" style={{ padding: '32px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'var(--success-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ShieldCheck size={22} color="var(--success)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {createdSession.role === 'host' ? 'Private Room Created' : 'Joined Private Room'}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Participant: <strong style={{ color: '#c4b5fd' }}>{createdSession.displayName}</strong> ({createdSession.role})
                </span>
              </div>
            </div>

            {/* Notification messages */}
            {actionSuccessMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(52, 211, 153, 0.12)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  color: 'var(--success)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                <Check size={16} />
                <span>{actionSuccessMessage}</span>
              </div>
            )}

            {isRevoked && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                <ShieldAlert size={16} />
                <span>Current invitation link is REVOKED. Generate a new link below to allow your partner to join.</span>
              </div>
            )}

            {/* Room Identifier Card */}
            <div
              style={{
                background: 'rgba(10, 8, 17, 0.8)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Room Identifier
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                  {createdSession.roomId}
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => copyToClipboard(createdSession.roomId, false)}
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                {copiedCode ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                <span>{copiedCode ? 'Copied' : 'Copy ID'}</span>
              </button>
            </div>

            {/* Direct Invitation Link (For Host) */}
            {createdSession.role === 'host' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--accent-muted)', marginBottom: '6px', fontWeight: 500 }}>
                  Private Guest Invitation Link:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={isRevoked ? 'Invitation revoked' : inviteUrl}
                    className="form-input"
                    style={{
                      fontSize: '0.85rem',
                      opacity: isRevoked ? 0.5 : 1,
                    }}
                  />
                  <button
                    type="button"
                    disabled={isRevoked}
                    className="btn-primary"
                    onClick={() => copyToClipboard(inviteUrl, true)}
                    style={{ padding: '0 18px', flexShrink: 0 }}
                  >
                    {copiedLink ? <Check size={16} /> : <Link size={16} />}
                    <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                  Contains the secret invitation credential. Does not expose your host administrative keys.
                </p>
              </div>
            )}

            {/* Host Administration Controls */}
            {createdSession.role === 'host' && (
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  paddingTop: '8px',
                  marginBottom: '20px',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                {!isRevoked ? (
                  <button
                    type="button"
                    disabled={isLoading}
                    className="btn-secondary"
                    onClick={handleRevokeInvitation}
                    style={{ flex: 1, fontSize: '0.82rem', borderColor: 'var(--danger-border)', color: '#fca5a5' }}
                  >
                    <Ban size={14} />
                    <span>Revoke Link</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isLoading}
                    className="btn-primary"
                    onClick={handleRegenerateInvitation}
                    style={{ flex: 1, fontSize: '0.82rem' }}
                  >
                    <RefreshCw size={14} />
                    <span>Generate New Link</span>
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {onSessionReady && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => onSessionReady(createdSession)}
                  style={{ width: '100%', padding: '13px 0' }}
                >
                  <ArrowRight size={17} />
                  <span>Enter Video Room</span>
                </button>
              )}

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setCreatedSession(null);
                  setIsRevoked(false);
                  setActionSuccessMessage(null);
                }}
                style={{ width: '100%' }}
              >
                <span>Return to Lobby</span>
              </button>
            </div>
          </div>
        ) : (
          /* Main Interactive Tab Card */
          <div className="glass-panel" style={{ padding: '32px 28px' }}>
            {/* Tab Navigation */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(8, 6, 14, 0.75)',
                borderRadius: 'var(--radius-full)',
                padding: '4px',
                marginBottom: '24px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveTab('create');
                  setErrorMessage(null);
                }}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: activeTab === 'create' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'create' ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'create' ? '0 2px 10px rgba(139, 92, 246, 0.35)' : 'none',
                }}
              >
                Create Room
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('join');
                  setErrorMessage(null);
                }}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: activeTab === 'join' ? 'var(--accent-primary)' : 'transparent',
                  color: activeTab === 'join' ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'join' ? '0 2px 10px rgba(139, 92, 246, 0.35)' : 'none',
                }}
              >
                Join Room
              </button>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  color: 'var(--danger)',
                  fontSize: '0.85rem',
                  marginBottom: '20px',
                  lineHeight: 1.4,
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Create Room Form */}
            {activeTab === 'create' ? (
              <form onSubmit={handleCreateRoom}>
                <div style={{ marginBottom: '22px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      marginBottom: '8px',
                      fontWeight: 500,
                    }}
                  >
                    Your Name (Host)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      placeholder="e.g. Arav"
                      disabled={isLoading}
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                    />
                    <User
                      size={17}
                      color="var(--text-tertiary)"
                      style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '13px 0' }}
                >
                  {isLoading ? (
                    <>
                      <div className="spinner" />
                      <span>Creating Secure Room...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Private Room</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Join Room Form */
              <form onSubmit={handleJoinRoom}>
                <div style={{ marginBottom: '14px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      marginBottom: '6px',
                      fontWeight: 500,
                    }}
                  >
                    Your Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. Elena"
                      disabled={isLoading}
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                    />
                    <User
                      size={17}
                      color="var(--text-tertiary)"
                      style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      marginBottom: '6px',
                      fontWeight: 500,
                    }}
                  >
                    Room ID
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      placeholder="e.g. spark-4913"
                      required
                      disabled={isLoading}
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                    />
                    <Film
                      size={17}
                      color="var(--text-tertiary)"
                      style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.85rem',
                      color: 'var(--text-primary)',
                      marginBottom: '6px',
                      fontWeight: 500,
                    }}
                  >
                    Invitation Credential
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={inviteSecret}
                      onChange={(e) => setInviteSecret(e.target.value)}
                      placeholder="Enter private invite credential or open link"
                      required
                      disabled={isLoading}
                      className="form-input"
                      style={{ paddingLeft: '40px' }}
                    />
                    <Lock
                      size={17}
                      color="var(--text-tertiary)"
                      style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '13px 0' }}
                >
                  {isLoading ? (
                    <>
                      <div className="spinner" />
                      <span>Authorizing Invitation...</span>
                    </>
                  ) : (
                    <>
                      <span>Enter Watch Party</span>
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
