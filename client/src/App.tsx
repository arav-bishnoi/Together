import { useState } from 'react';
import type { RoomSession } from './types/index.js';
import { LobbyPage } from './pages/LobbyPage.js';
import { RoomPage } from './pages/RoomPage.js';

export function App() {
  const [session, setSession] = useState<RoomSession | null>(null);

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
