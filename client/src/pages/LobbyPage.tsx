import React, { useState, useEffect } from 'react';
import { Heart, Sparkles, Film, KeyRound, User, AlertCircle, ArrowRight } from 'lucide-react';
import type { RoomSession } from '../types/index.js';

interface LobbyPageProps {
  onSessionReady: (session: RoomSession) => void;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({ onSessionReady }) => {
  const [mode, setMode] = useState<'host' | 'guest'>('host');
  const [hostName, setHostName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check URL query parameters on initial page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    const urlKey = params.get('key');

    if (urlRoom && urlKey) {
      setRoomId(urlRoom);
      setPasscode(urlKey);
      setMode('guest');
    }
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostName: hostName.trim() || 'Host' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create watch party room.');
      }

      onSessionReady({
        roomId: data.roomId,
        passcode: data.passcode,
        token: data.token,
        livekitUrl: data.livekitUrl,
        role: 'host',
        participantId: data.participant.id,
        displayName: data.participant.name,
      });
    } catch (err: any) {
      console.error('Error creating room:', err);
      setErrorMessage(err?.message || 'Server connection error. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: roomId.trim(),
          passcode: passcode.trim(),
          guestName: guestName.trim() || 'Guest',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to join room. Please check the code.');
      }

      onSessionReady({
        roomId: data.roomId,
        passcode: passcode.trim(),
        token: data.token,
        livekitUrl: data.livekitUrl,
        role: 'guest',
        participantId: data.participant.id,
        displayName: data.participant.name,
      });
    } catch (err: any) {
      console.error('Error joining room:', err);
      setErrorMessage(err?.message || 'Failed to join party. Check passcode or room capacity.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'radial-gradient(circle at 50% 25%, #181133 0%, var(--bg-primary) 75%)',
        position: 'relative',
        minHeight: '100dvh',
      }}
    >
      {/* Romantic decorative glow background */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '320px',
          height: '320px',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          zIndex: 10,
        }}
      >
        {/* Header Title */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.28)',
              color: '#d8b4fe',
              fontSize: '0.85rem',
              marginBottom: '14px',
            }}
          >
            <Heart size={15} fill="#ec4899" color="#ec4899" className="pulse-heart" />
            <span>Private Two-Person Theatre</span>
            <Sparkles size={14} color="#c084fc" />
          </div>

          <h1
            style={{
              fontSize: '2.1rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #ffffff 30%, #d8b4fe 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '8px',
            }}
          >
            Date Night
          </h1>
          <p style={{ color: '#a19bb8', fontSize: '0.95rem' }}>
            Watch movies, videos, and shows together seamlessly across any distance.
          </p>
        </div>

        {/* Card Panel */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          {/* Mode Switcher Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(11, 8, 22, 0.7)',
              borderRadius: 'var(--radius-full)',
              padding: '4px',
              marginBottom: '24px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode('host');
                setErrorMessage(null);
              }}
              style={{
                flex: 1,
                padding: '9px 0',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: mode === 'host' ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-rose))' : 'transparent',
                color: mode === 'host' ? '#ffffff' : '#a19bb8',
                boxShadow: mode === 'host' ? '0 2px 10px var(--accent-glow)' : 'none',
              }}
            >
              Start Date Night
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('guest');
                setErrorMessage(null);
              }}
              style={{
                flex: 1,
                padding: '9px 0',
                border: 'none',
                borderRadius: 'var(--radius-full)',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: mode === 'guest' ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-rose))' : 'transparent',
                color: mode === 'guest' ? '#ffffff' : '#a19bb8',
                boxShadow: mode === 'guest' ? '0 2px 10px var(--accent-glow)' : 'none',
              }}
            >
              Join with Code
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                fontSize: '0.85rem',
                marginBottom: '18px',
              }}
            >
              <AlertCircle size={17} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Host Form */}
          {mode === 'host' ? (
            <form onSubmit={handleCreateRoom}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#c084fc', marginBottom: '8px', fontWeight: 500 }}>
                  Your Name:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={hostName}
                    onChange={(e) => setHostName(e.target.value)}
                    placeholder="e.g. Arav"
                    className="input-romantic"
                    style={{ paddingLeft: '40px' }}
                  />
                  <User
                    size={18}
                    color="#a19bb8"
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-romantic"
                style={{ width: '100%', padding: '13px 0' }}
              >
                {isLoading ? (
                  <span>Preparing Room...</span>
                ) : (
                  <>
                    <span>Create Private Party</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Guest Form */
            <form onSubmit={handleJoinRoom}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#c084fc', marginBottom: '6px', fontWeight: 500 }}>
                  Your Name:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="e.g. Elena"
                    className="input-romantic"
                    style={{ paddingLeft: '40px' }}
                  />
                  <User
                    size={18}
                    color="#a19bb8"
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#c084fc', marginBottom: '6px', fontWeight: 500 }}>
                  Room ID:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="e.g. date-4829"
                    required
                    className="input-romantic"
                    style={{ paddingLeft: '40px' }}
                  />
                  <Film
                    size={18}
                    color="#a19bb8"
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#c084fc', marginBottom: '6px', fontWeight: 500 }}>
                  Secret Passcode:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Enter passkey from your partner"
                    required
                    className="input-romantic"
                    style={{ paddingLeft: '40px' }}
                  />
                  <KeyRound
                    size={18}
                    color="#a19bb8"
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-romantic"
                style={{ width: '100%', padding: '13px 0' }}
              >
                {isLoading ? (
                  <span>Joining Party...</span>
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
      </div>
    </div>
  );
};
