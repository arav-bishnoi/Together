import { useState, useEffect } from 'react';
import type { RoomSession } from './types/index.js';
import { LobbyPage } from './pages/LobbyPage.js';
import { RoomPage } from './pages/RoomPage.js';

export function App() {
  const [session, setSession] = useState<RoomSession | null>(() => {
    try {
      const stored = sessionStorage.getItem('watch_party_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (session) {
      try {
        sessionStorage.setItem('watch_party_session', JSON.stringify(session));
      } catch {
        // Ignored if storage full/disabled
      }
    } else {
      try {
        sessionStorage.removeItem('watch_party_session');
      } catch {
        // Ignored
      }
    }
  }, [session]);

  return (
    <>
      {!session ? (
        <LobbyPage onSessionReady={(newSession) => setSession(newSession)} />
      ) : (
        <RoomPage session={session} onLeave={() => setSession(null)} />
      )}
    </>
  );
}

export default App;
