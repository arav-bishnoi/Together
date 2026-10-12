# Project Status: Together

**Last Updated:** Visual Rebranding & Design System Complete  
**Repository:** [github.com/arav-bishnoi/Together](https://github.com/arav-bishnoi/Together)  
**Branch:** `main`  
**Current Resume Point:** **Phase 6: Live VPS Domain Linking & Final Cross-Network Verification**

---

## 1. Project Overview

A private, secure, two-person watch-party web application built for watching videos together with friends, family, or partners.
- **Host:** Desktop / Laptop browser (shares screen/audio, camera, and microphone).
- **Guest:** Android phone or secondary browser (watches screen, camera, and microphone in a mobile-optimized theater mode).
- **Theme:** Modern, sleek dark design with muted yellow-green accent (`#D4DE95`), elevated surfaces, and clean glassmorphism.

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

- **Frontend (`/client`)**: React 19, TypeScript, Vite, Vanilla CSS with custom design tokens (`index.css`, `room.css`), LiveKit Client SDK (`livekit-client`), dynamic API URL adapter (`config/api.ts`).
- **Backend (`/server`)**: Node.js, Express, TypeScript, Zod schema validation, LiveKit Server SDK (`livekit-server-sdk`), in-memory room manager (`roomManager.ts`), security headers, hardened CORS, and rate limiting.
- **Media Engine**: LiveKit SFU (`livekit-server`), WebRTC with STUN fallback (`stun:stun.l.google.com:19302`) and Coturn TURN relay for mobile cellular CGNAT traversal.
- **Reverse Proxy**: Caddy with automatic Let's Encrypt TLS/SSL certificates and WebSocket reverse proxying.
- **Security**:
  - Cryptographically isolated 128-bit credentials (`hostSecret` for host control vs. `inviteSecret` for guest join).
  - Short-lived JWT media tokens (30 min TTL), strictly minted server-side.
  - Constant-time string comparisons (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
  - Strict 2-participant room boundary enforced at both API and SFU layers.
  - Zero server secrets or API keys exposed in frontend bundles or Git.
  - Production refusal to start if default development credentials (`devkey`/`secret`) are detected.

---

## 3. Project Directory Structure

```
watch-party/
├── README.md                           # Documentation, run commands, ports & test checklist
├── PROJECT_STATUS.md                   # Architecture, phase tracking, status & resume point
├── DEPLOYMENT.md                       # Complete production deployment & cross-network guide
├── Caddyfile                           # Production reverse proxy with automatic HTTPS
├── docker-compose.production.yml       # Production container orchestration (Caddy + Node + LiveKit + Coturn)
├── livekit.production.yaml             # Production LiveKit SFU configuration
├── turnserver.conf                     # Production Coturn TURN relay configuration
├── .gitignore                          # Excludes node_modules, build outputs, and .env files
├── client/                             # Frontend React + TypeScript application
│   ├── .env.example                    # Development environment template
│   ├── .env.production.example         # Production environment template
│   ├── index.html                      # HTML entry with Outfit typography & dark theme
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts                  # Vite config with /api proxy to port 3001
│   └── src/
│       ├── App.tsx                     # Main router & sessionStorage recovery
│       ├── config/
│       │   └── api.ts                  # Dynamic API URL resolver (relative vs cross-origin)
│       ├── types/index.ts              # Room, session, and connection type definitions
│       ├── hooks/
│       │   ├── useLiveKit.ts           # WebRTC hook: audio/video/screen, reconnect, online/visibility
│       │   └── useDraggable.ts         # Pointer-event draggable window hook with screen clamping
│       ├── components/
│       │   ├── Navbar.tsx              # Top navigation bar with live connection status pill
│       │   ├── FloatingCamera.tsx      # Floating draggable camera feed tile with mute indicators
│       │   ├── ScreenViewer.tsx        # Screen sharing video stage & theater backdrop
│       │   ├── Controls.tsx            # Bottom media controls (mic, cam, share, leave)
│       │   ├── AudioUnlockBanner.tsx   # Mobile autoplay permission banner
│       │   └── InviteModal.tsx         # Host invitation sharing modal
│       ├── pages/
│       │   ├── LobbyPage.tsx           # Landing page: Create party, join party, invite codes
│       │   └── RoomPage.tsx            # Watch party room: stage, floating tiles, alerts, retry
│       └── styles/
│           ├── index.css               # Global theme tokens, typography, glassmorphism
│           └── room.css                # Room layout, 100dvh, theater stage, responsive mobile CSS
└── server/                             # Backend Node.js + Express API
    ├── .env.example                    # Development environment template
    ├── .env.production.example         # Production environment template
    ├── Dockerfile                      # Multi-stage production container build
    ├── package.json
    ├── tsconfig.json
    ├── scripts/
    │   └── verifyTurnConnectivity.ts   # Live STUN and TURN UDP socket relay tester
    ├── src/
    │   ├── index.ts                    # Express server entry point (port 3001) & security headers
    │   ├── config.ts                   # Environment parser, security checks & ICE configs
    │   ├── roomManager.ts              # Cryptographic room lifecycle, seats & token minter
    │   └── routes/
    │       └── roomRoutes.ts           # REST endpoints: /create, /join, /reconnect, /revoke, /leave
    └── tests/
        ├── phase2_auth.test.ts         # 10 automated authorization & security tests
        └── phase5_reliability.test.ts   # 7 automated reconnection & recovery tests
```

---

## 4. Completed Phases Summary

### Phase 1: Foundation & Design System
- Monorepo folder structure configured with TypeScript, Vite, Node.js, and Express.
- Polished dark landing page with "Create Room" and "Join Room" forms and modern `#D4DE95` design system.
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
- Scaled down PiP camera tiles (`150px` / `110px`) on mobile with pointer touch dragging.
- Network offline detection (`window.online`/`offline`) and `document.visibilitychange` handling.
- `POST /api/rooms/reconnect` endpoint verifying existing participant credentials.
- `sessionStorage` session restoration preventing room-full errors upon refresh.
- Clean connection teardown (`room.removeAllListeners()`, `retryConnection`) preventing duplicate tracks.
- Prominent network alert banner with a manual "Retry Connection" button.
- Comprehensive 7-test automated network recovery suite (17 total tests passing).

### Phase 6: Production Deployment Preparation & Hardening
- Dynamic frontend API URL resolver (`client/src/config/api.ts`) supporting both unified reverse-proxy and separate origin deployments.
- Production environment verification in `server/src/config.ts` enforcing unique credentials and rejecting development keys (`devkey`/`secret`).
- OWASP security headers added to Express (`nosniff`, `DENY`, `strict-origin-when-cross-origin`, `Strict-Transport-Security`).
- Origin allowlist validation protecting CORS endpoints against unauthorized cross-site requests.
- Administrative rate limiting (`adminActionLimiter`) on invite revocation and room termination.
- Built-in UDP socket STUN/TURN tester (`server/scripts/verifyTurnConnectivity.ts`) validating NAT traversal.
- Complete Docker Compose stack (`docker-compose.production.yml`) with Caddy automatic TLS, LiveKit SFU, Coturn TURN, and Express backend.
- Full step-by-step beginner guide documented in `DEPLOYMENT.md`.

---

## 5. Current Feature Status

| Feature | Status | Details |
| :--- | :--- :--- | :--- |
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
| **STUN NAT Traversal** | **Working** | Verified with `npm run test:turn` (Google STUN: 15–20 ms RTT). |
| **TURN Relay Traversal** | **Configured** | Coturn container configured in `docker-compose.production.yml` and `turnserver.conf`. |
| **Production Orchestration** | **Configured** | Caddy + Node + LiveKit + Coturn container stack ready to launch. |

---

## 6. Verification & Build Results

- **Backend Tests:** `17 passing, 0 failing` (`cd server && npm test`)
  - `phase2_auth.test.ts`: 10 passed
  - `phase5_reliability.test.ts`: 7 passed
- **STUN / TURN Socket Probe:** `REACHABLE` (`cd server && npm run test:turn`)
  - `stun:stun.l.google.com:19302`: Reachable (20 ms latency, discovered NAT mapping)
  - `stun:stun1.l.google.com:19302`: Reachable (15 ms latency, discovered NAT mapping)
- **Client Build:** `tsc -b && vite build` completed with 0 errors (`dist/` created).
- **Server Build:** `tsc` completed with 0 errors (`dist/` created).
- **Secrets Audit:** Clean. All `.env` files are ignored by Git; only `.env.example` and `.env.production.example` files are tracked.

---

## 7. Next Step: Live Server Deployment

All code, configurations, security headers, container definitions, and documentation are prepared.
When ready to take the project live:
1. Provision a VPS (e.g. Hetzner Cloud or DigitalOcean).
2. Point your domain's DNS `A` records to the VPS IP address.
3. Follow the exact step-by-step instructions in [DEPLOYMENT.md](file:///media/arav/Personal/Programming/watch-party/DEPLOYMENT.md).
