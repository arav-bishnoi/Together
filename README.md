# Our Watch Party - Private Two-Person WebRTC Platform

A private, modern WebRTC web application engineered for long-distance watch parties.
Built with React 19, TypeScript, Node.js, Express, and LiveKit SFU.

---

## Architecture Overview

*   **Frontend:** React 19, Vite, TypeScript, `livekit-client`, Vanilla CSS (Dark romantic theme, `#07060c` / `#8b5cf6`).
*   **Backend:** Node.js, Express, TypeScript, Zod validation, in-memory concurrency-safe room manager, rate limiting.
*   **Media Server:** LiveKit SFU (`livekit-server`), WebRTC audio/video/screenshare routing.
*   **Security & Privacy:** 128-bit cryptographically separated credentials (`hostSecret` vs `inviteSecret`), short-lived JWT tokens (30 min TTL), zero server secrets in client bundle, and strictly enforced 2-participant limit at both API and SFU levels.

---

## Network Architecture: Ports, Firewall & NAT Traversal

WebRTC media communication relies on distinct signalling and media transports:

### 1. Required TCP/UDP Ports & Firewall Rules

| Port | Protocol | Component | Purpose |
| :--- | :--- | :--- | :--- |
| **7880** | **TCP** | LiveKit Server | Signalling over HTTP / WebSockets (`ws://` / `wss://`) |
| **7881** | **TCP** | LiveKit Server | WebRTC TURN/TCP fallback (used when UDP is blocked by strict firewalls) |
| **7882** | **UDP** | LiveKit Server | WebRTC media transmission (RTP/RTCP packets for video, audio, screenshare) |
| **3478** | **UDP/TCP** | STUN / TURN | Session Traversal Utilities for NAT (discovering public endpoints) |
| **5349** | **TCP** | TURN / TLS | Encrypted TURN relay (traverses restrictive corporate and university firewalls) |
| **3001** | **TCP** | Node.js Express | Room authorization, token minting, and invitation management API |
| **5173** | **TCP** | Vite Dev / Web | Web application HTTP(S) serving |

---

## Restrictive Networks & TURN Relay Configuration

### Why TURN is Required for Real-World Networks
Testing locally (on `localhost` or within the same home Wi-Fi) connects directly because both devices share the same local subnet. However, a local connection **does not** prove public internet connectivity:
* **Carrier-Grade NAT (CGNAT)**: When a guest connects from an Android phone on 4G/5G mobile data, the cellular carrier assigns a private carrier IP behind a Symmetric NAT.
* **Symmetric NAT Behavior**: In a Symmetric NAT, external ports change dynamically for each remote destination. Direct peer-to-peer UDP hole-punching fails consistently.
* **The Solution (TURN Relays)**: Traversal Using Relays around NAT (TURN) acts as a trusted relay in the cloud. Both endpoints send their encrypted media packets to the TURN server, which forwards them directly, guaranteeing a connection under any firewall or cellular network restriction.

### Configuring Custom TURN / STUN in Our Watch Party

In `server/.env`, configure your TURN credentials:
```env
# Optional Custom TURN Relay (e.g. Metered, Coturn, Cloudflare, Twilio)
TURN_URL=turn:turn.example.com:3478?transport=udp
TURN_USERNAME=your-turn-username
TURN_CREDENTIAL=your-turn-password
```
When configured, the backend automatically issues these ICE servers in `/api/rooms/create`, `/api/rooms/join`, and `/api/rooms/reconnect` responses. The frontend passes them directly to `room.connect(url, token, { rtcConfig: { iceServers } })`.

*(If using LiveKit Cloud in production, LiveKit provides globally distributed built-in TURN relays automatically at no configuration cost).*

---

## Android Chrome & Mobile Browser Limitations

Web applications running in mobile browsers (Android Chrome, Samsung Internet) are subject to strict operating system security and power management policies that **cannot be overridden by web code**:

1. **Background App Suspension & Audio Throttling**:
   - When a guest switches away from Chrome (e.g., answering WhatsApp or locking the phone), Android OS flags the tab as `hidden`.
   - Android aggressively throttles background JavaScript execution to save battery.
   - **How we handle it**: The app listens to `document.visibilitychange`. When the guest returns to the tab, the app immediately re-evaluates `room.canPlaybackAudio` and the true connection state rather than falsely reporting that the connection remained active.
2. **Camera Access Revocation in Background**:
   - Android OS security policy **immediately stops the camera sensor** when the tab is hidden or minimized.
   - When returning to the app, the local video track is automatically resynchronized with the camera toggle.
3. **Autoplay Restrictions**:
   - Mobile browsers prohibit playing non-muted audio unless triggered by a direct user touch gesture.
   - **How we handle it**: When audio is restricted, an interactive `AudioUnlockBanner` appears (*"Tap to unlock party audio"*). Tapping it executes `room.startAudio()`.
4. **Orientation & Fullscreen Controls**:
   - Mobile browsers cannot lock screen orientation programmatically unless running in standalone PWA / full screen mode.
   - The theatre stage provides a dedicated Fullscreen button that requests HTML5 Fullscreen on the theatre stage, allowing Android devices to view the shared screen in landscape mode without browser address bar clutter.

---

## Comprehensive Testing Checklist

Use this checklist to systematically verify real-world edge cases:

- [ ] **1. Laptop Host & Android Guest (Local Wi-Fi)**:
  - Host creates room at `http://localhost:5173`.
  - Android phone joins via `http://<LAN_IP>:5173/?room=...&invite=...`.
  - Verify two-way audio, video, and active speaker green ring.
- [ ] **2. Different Networks (Laptop Wi-Fi vs. Android 5G Mobile Data)**:
  - Host connects to Home Wi-Fi; Guest disconnects from Wi-Fi and connects via cellular 4G/5G.
  - Verify that STUN/TURN connects the session across carrier NAT.
- [ ] **3. Network Switching (Wi-Fi to Mobile Data Transition)**:
  - On the Android phone, toggle Wi-Fi off while in a call so the phone transitions to 5G.
  - Notice the `network-alert-banner` displaying *"Network interrupted. Attempting to reconnect..."*.
  - Verify that LiveKit automatically recovers the session or that tapping **"Retry Now"** recovers the call.
- [ ] **4. Camera or Microphone Permission Denied**:
  - In browser site settings, block camera or microphone access.
  - Click the camera/microphone toggle in the control bar.
  - Verify that an informative error toast appears (e.g., *"Permission denied. Please allow camera access in your address bar"*) rather than a silent failure.
- [ ] **5. Screen Sharing Stopped by Host**:
  - Host shares a browser tab with tab audio.
  - Host stops sharing from either the red in-app *"Stop Sharing"* button or Chrome's floating *"Stop sharing"* bar.
  - Verify that the shared screen closes on the guest device while both camera and microphone feeds remain uninterrupted.
- [ ] **6. Guest Refreshes or Briefly Disconnects**:
  - Guest reloads the browser tab.
  - Verify that `sessionStorage` and `/api/rooms/reconnect` automatically recover the guest's seat and token without prompting to re-enter room details.
  - Verify that the host's session does not duplicate the guest's video or audio tracks.
- [ ] **7. Room Expired or Invitation Revoked**:
  - Host clicks **"Invite"** -> **"Revoke Link"**.
  - Guest attempts to join with the revoked credential.
  - Verify that the server rejects the join with `403 Forbidden` (*"This invitation has been revoked by the host"*).

---

## Exact Run Commands

1. **Terminal 1 - LiveKit Server:**
   ```bash
   ~/.local/bin/livekit-server --dev
   ```

2. **Terminal 2 - Backend Server:**
   ```bash
   cd /media/arav/Personal/Programming/watch-party
   npm run dev:server
   ```

3. **Terminal 3 - Frontend Client:**
   ```bash
   cd /media/arav/Personal/Programming/watch-party
   npm run dev:client
   ```

4. **Run Automated Test Suites:**
   ```bash
   cd server && npm test
   # Runs 17 automated tests covering authorization, atomic seat claiming, concurrency, and Phase 5 session recovery.
   ```

