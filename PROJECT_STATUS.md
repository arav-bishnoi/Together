# Project Status: Together (Our Watch Party)

**Last Updated:** Phase 5 Completion  
**Repository:** [github.com/arav-bishnoi/Together](https://github.com/arav-bishnoi/Together)  
**Branch:** `main`  
**Current Resume Point:** **Phase 6: Production Deployment & Network Reliability**

---

## 1. Project Overview

A private, secure, two-person watch-party web application built for a long-distance couple.
- **Host:** Desktop / Laptop browser (shares screen/audio, camera, and microphone).
- **Guest:** Android phone (watches screen, camera, and microphone in a mobile-optimized theater mode).
- **Theme:** Romantic, modern, dark purple glassmorphism aesthetic with zero childish cliches.

---

## 2. Architecture & Technology Stack

```
                          ┌─────────────────────────┐
                          │   Host Browser (PC)     │
                          │   (Screen + Cam + Mic)  │
                          └───────────┬─────────────┘
                                      │ WebRTC Media Tracks
                                      ▼
┌────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│     Client (Vite)      │      │     LiveKit SFU         │◄────►│   Coturn (TURN / STUN)  │
│  React 19 + TypeScript │      │  WebRTC Media Engine    │      │ (NAT / CGNAT Traversal) │
└───────────┬────────────┘      └───────────▲─────────────┘      └─────────────────────────┘
            │                               │
            │ REST API                      │ Room / Token Minting
            ▼                               │
┌────────────────────────┐                  │
│    Node.js / Express   │──────────────────┘
│   TypeScript + Zod     │
└────────────────────────┘
            ▲
            │ WebRTC Media Tracks
            │
┌───────────┴────────────┐
│   Guest Browser (Phone)│
│    (Android Chrome)    │
└────────────────────────┘
```

- **Frontend (`/client`)**: React 19, TypeScript, Vite, Vanilla CSS with custom design tokens (`index.css`, `room.css`), LiveKit Client SDK (`livekit-client`).
- **Backend (`/server`)**: Node.js, Express, TypeScript, Zod schema validation, LiveKit Server SDK (`livekit-server-sdk`), in-memory room manager (`roomManager.ts`).
- **Media Engine**: LiveKit SFU (`livekit-server`), WebRTC with STUN fallback (`stun:stun.l.google.com:19302`) and optional TURN relay support.
- **Security**:
  - Cryptographically isolated 128-bit credentials (`hostSecret` for host control vs. `inviteSecret` for guest join).
  - Short-lived JWT media tokens (30 min TTL), strictly minted server-side.
  - Constant-time string comparisons (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
  - Strict 2-participant room boundary enforced at both API and SFU layers.
  - Zero server secrets or API keys exposed in frontend bundles.

---

## 3. Project Directory Structure

```
watch-party/
├── README.md                           # Documentation, run commands, ports & test checklist
├── PROJECT_STATUS.md                   # Architecture, phase tracking, status & resume point
├── .gitignore                          # Excludes node_modules, build outputs, and .env files
├── client/                             # Frontend React + TypeScript application
│   ├── .env.example                    # Placeholder frontend environment configuration
│   ├── index.html                      # HTML entry with Outfit typography & dark theme
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts                  # Vite config with /api proxy to port 3001
│   └── src/
│       ├── App.tsx                     # Main router & sessionStorage recovery
│       ├── types/index.ts              # Room, session, and connection type definitions
│       ├── hooks/
│       │   ├── useLiveKit.ts           # WebRTC hook: audio/video/screen, reconnect, online/visibility
│       │   └── useDraggable.ts         # Pointer-event draggable window hook with screen clamping
│       ├── components/
│       │   ├── Navbar.tsx              # Top navigation bar with live connection status pill
│       │   ├── VideoTile.tsx           # Floating draggable camera feed tile with mute indicators
│       │   ├── ScreenShareStage.tsx    # Screen sharing video stage & theater backdrop
│       │   └── ControlBar.tsx          # Bottom media controls (mic, cam, share, leave)
│       ├── pages/
│       │   ├── LobbyPage.tsx           # Landing page: Create party, join party, invite codes
│       │   └── RoomPage.tsx            # Watch party room: stage, floating tiles, alerts, retry
│       └── styles/
│           ├── index.css               # Global theme tokens, typography, glassmorphism
│           └── room.css                # Room layout, 100dvh, theater stage, responsive mobile CSS
└── server/                             # Backend Node.js + Express API
    ├── .env.example                    # Placeholder backend environment configuration
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── index.ts                    # Express server entry point (port 3001)
    │   ├── config.ts                   # Environment parser, TTL policies & ICE server configs
    │   ├── roomManager.ts              # Cryptographic room lifecycle, seats & LiveKit token minter
    │   └── routes/
    │       └── roomRoutes.ts           # REST endpoints: /create, /join, /reconnect, /revoke, /leave
    └── tests/
        ├── phase2_authorization.test.ts # 10 automated authorization & security tests
        └── phase5_reliability.test.ts   # 7 automated reconnection & recovery tests
```

---

## 4. Completed Phases Summary

### Phase 1: Foundation & Design System
- Monorepo folder structure configured with TypeScript, Vite, Node.js, and Express.
- Polished dark purple landing page with "Create Room" and "Join Room" forms.
- Vite reverse proxy configured for development (`/api` -> `localhost:3001`).
- Backend `/api/health` check endpoint.

### Phase 2: Private Room Creation, Invitations & Security
- Cryptographic room creation generating separate `hostSecret` and `inviteSecret`.
- Copyable invite links (`?join=...`) and human-readable 6-character party codes.
- Strict 2-participant limit enforcing 1 Host and 1 Guest maximum.
- Rate limiting and input validation with Zod.
- Complete 10-test automated security suite verifying seat isolation and timing attack protections.

### Phase 3: Real-Time Audio & Video (LiveKit)
- LiveKit SFU integration using short-lived media JWT tokens.
- Bidirectional camera and microphone streaming between host and guest.
- Device toggles: Mute/unmute microphone and enable/disable camera.
- Permission failure handlers and mobile audio autoplay unlock overlay (`room.startAudio()`).
- Event listeners for remote track subscription, participant connection, and clean teardown.

### Phase 4: Screen Sharing & Theater Stage
- Host screen-sharing with system/tab audio support where supported.
- Main theater stage displaying shared screen with 16:9 aspect ratio and fallback states.
- Draggable floating Picture-in-Picture (PiP) camera tiles over the shared content.
- Bounds clamping preventing camera tiles from being dragged off-screen.
- Clean track unpublishing when host ends sharing via browser or app button.

### Phase 5: Android Compatibility, Network Recovery & Reliability
- Dynamic viewport sizing (`100dvh`) for Android Chrome address bar collapsing.
- Scaled down PiP camera tiles (`130px`) on narrow screens (`<= 480px`) with touch dragging.
- Network offline detection (`window.online`/`offline`) and `document.visibilitychange` handling.
- `POST /api/rooms/reconnect` endpoint verifying existing participant credentials.
- `sessionStorage` session restoration preventing room-full errors upon refresh.
- Clean connection teardown (`room.removeAllListeners()`, `retryConnection`) preventing duplicate tracks.
- Prominent network alert banner with a manual "Retry Connection" button.
- ICE server delivery supporting public STUN and configurable TURN relay.
- Comprehensive 7-test automated network recovery suite (17 total tests passing).

---

## 5. Current Feature Status

| Feature | Status | Details |
| :--- | :---: | :--- |
| **Room Creation & Party Codes** | **Working** | Host creates room; generates copyable invite link and party code. |
| **Guest Authorization** | **Working** | Guest joins with code or link; rejects invalid/revoked/expired rooms. |
| **2-Participant Boundary** | **Working** | Exactly 1 host + 1 guest; 3rd person attempts strictly return 403. |
| **Camera & Microphone Streaming** | **Working** | Bidirectional WebRTC audio and video streaming. |
| **Mic & Camera Mute Toggles** | **Working** | Local mute/unmute and camera pause/resume. |
| **Screen Sharing with Audio** | **Working** | Host shares tab/window/screen with audio where supported. |
| **Theater Stage & Draggable PiP** | **Working** | Main shared screen with floating draggable camera feeds. |
| **Android Mobile Layout** | **Working** | Responsive CSS (`100dvh`), compact camera tiles, touch dragging. |
| **Reconnection on Refresh** | **Working** | `sessionStorage` preserves credentials; auto-reconnects cleanly. |
| **Network Loss Detection** | **Working** | Online/offline listeners and visible reconnect banner with manual retry. |
| **Security & Token Isolation** | **Working** | All tokens minted server-side; zero secrets in client bundle. |
| **Automated Test Suites** | **Working** | 17/17 backend tests passing (`npm test`). |
| **Client & Server Builds** | **Working** | TypeScript compilation succeeds with 0 errors on both client and server. |
| **STUN NAT Traversal** | **Working** | Defaults to `stun:stun.l.google.com:19302`. |
| **TURN Relay Traversal** | **Partially Implemented** | Code & config support TURN (`TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL`), but requires a live TURN server (Phase 6). |
| **Cellular WAN Streaming** | **Partially Implemented** | Verified in local environment; cross-network WAN traversal will be tested in Phase 6 deployment. |

---

## 6. Mobile Browser & OS Constraints

These behaviors are enforced by Android OS / Chrome and cannot be bypassed by web code:
1. **Background Camera Revocation**: Android OS suspends camera hardware when Chrome is sent to the background. Returning to the tab restores track sync.
2. **Aggressive OS Battery Optimization**: Android kills or freezes background tabs after inactivity. `sessionStorage` ensures clean session re-entry.
3. **Autoplay Restrictions**: Unmuted audio requires user interaction; the app displays an audio unlock modal when needed.
4. **Cellular CGNAT / Symmetric NAT**: Carrier networks block direct peer-to-peer UDP; requires TURN relay deployment in Phase 6.

---

## 7. Verification & Build Results

- **Backend Tests:** `17 passing, 0 failing` (`cd server && npm test`)
  - `phase2_authorization.test.ts`: 10 passed
  - `phase5_reliability.test.ts`: 7 passed
- **Client Build:** `tsc -b && vite build` completed with 0 errors (`dist/` created).
- **Server Build:** `tsc` completed with 0 errors (`dist/` created).
- **Git Status:** Clean (`main` branch up to date with `origin/main`).
- **Secrets Audit:** Clean. All `.env` files are ignored by git; only `.env.example` placeholder files are tracked.

---

## 8. Exact Resume Point: Phase 6

When development resumes, proceed with **Phase 6: Production Deployment and Network Reliability**:

### Phase 6 Tasks:
1. **LiveKit Server Cloud Deployment**: Deploy LiveKit SFU to a cloud instance (e.g., VPS / Fly.io / DigitalOcean) with a public IP/domain and TLS termination.
2. **Coturn TURN Server Setup**: Configure Coturn with static auth secret or temporary user credentials on ports 3478 (UDP/TCP) and 5349 (TLS) to guarantee mobile carrier (4G/5G) connectivity.
3. **Backend Deployment**: Deploy the Node.js Express server to a hosting provider (Render, Railway, or VPS) with production `.env` variables (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `TURN_URL`, `CLIENT_ORIGIN`).
4. **Frontend Deployment**: Deploy the Vite frontend to a static host (Vercel, Netlify, Cloudflare Pages, or Nginx) pointing to the production backend API.
5. **Real-World Cross-Network Testing**: Execute the manual testing checklist with Host on home Wi-Fi and Guest on mobile carrier cellular data.
