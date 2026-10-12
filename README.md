# Together - Private Two-Person Watch Party Platform

A private, modern WebRTC web application engineered for watching videos together with friends, couples, and family.
Built with React 19, TypeScript, Node.js, Express, and LiveKit SFU.

---

## 1. Architecture Overview

* **Frontend:** React 19, Vite, TypeScript, `livekit-client`, Vanilla CSS (Dark modern aesthetic with muted yellow-green accent `#D4DE95`, dark background `#10120D`, elevated surface `#191C14`).
* **Backend:** Node.js, Express, TypeScript, Zod validation, in-memory concurrency-safe room manager, rate limiting.
* **Media Server:** LiveKit SFU (`livekit-server`), WebRTC audio/video/screenshare routing.
* **NAT / CGNAT Traversal:** Coturn STUN/TURN server for cellular 4G/5G mobile carrier traversal.
* **Reverse Proxy:** Caddy with automatic Let's Encrypt TLS/SSL certificates and WebSocket upgrade reverse-proxying.
* **Security & Privacy:** 128-bit cryptographically separated credentials (`hostSecret` vs `inviteSecret`), short-lived JWT tokens (30 min TTL), zero server secrets in client bundle, constant-time comparisons (`crypto.timingSafeEqual`), and strictly enforced 2-participant limit at both API and SFU levels.

---

## 2. OTT & Streaming Service DRM Limitations

### Digital Rights Management (DRM) & Capture Restrictions
When using the screen sharing feature to watch movies together, be aware of browser and operating system media capture constraints:

1. **Hardware-Level DRM (Widevine / PlayReady / HDCP)**:
   - Commercial OTT platforms (such as **Netflix, Amazon Prime Video, Disney+, Hulu, and Apple TV+**) use hardware-accelerated Content Decryption Modules (CDM) and HDCP.
   - When you share your screen via the browser's `getDisplayMedia()` API, the operating system's graphics compositor intentionally blocks video pixels, resulting in a **black screen with muted audio**.
   - This is an intentional security design enforced by web browsers (Chrome, Edge, Firefox, Safari) and OS kernels (Windows, macOS, Android, Linux). Web applications cannot and should not bypass these protections.

2. **Tested vs. Untested Media Sources**:
   - **Fully Tested & Supported**:
     - **YouTube, Twitch, Vimeo, and Web Video Players**: Flawless 1080p video with stereo tab audio.
     - **Personal Video Files**: Dragging any `.mp4`, `.webm`, or `.mkv` file into an empty Chrome tab and sharing that tab with audio.
     - **Browser Canvas & Web Games**: Full video and sound sharing.
   - **Tested & Blocked by DRM**:
     - Netflix, Amazon Prime, Disney+ (displays black video output).
   - **Untested / Unreliable**:
     - Disabling hardware acceleration in browser flags: unrecommended, as it degrades video playback framerate and does not guarantee DRM bypass across OS updates.

---

## 3. Network Architecture: Ports, Firewall & NAT Traversal

WebRTC media communication relies on distinct signalling and media transports:

### Required TCP/UDP Ports & Firewall Rules

| Port | Protocol | Component | Purpose |
| :--- | :--- | :--- | :--- |
| **80** | **TCP** | Caddy / Web | HTTP verification & automatic redirect to HTTPS |
| **443** | **TCP/UDP** | Caddy / Web | HTTPS serving & HTTP/3 |
| **7880** | **TCP** | LiveKit Server | Signalling over WebSockets (`ws://` / `wss://`) |
| **7881** | **TCP** | LiveKit Server | WebRTC TURN/TCP fallback for strict firewalls |
| **3478** | **UDP/TCP** | STUN / Coturn | Session Traversal Utilities for NAT (discovering public endpoints) |
| **50000–50100** | **UDP** | LiveKit Server | Real-time WebRTC media streams (RTP/RTCP packets) |
| **49152–49250** | **UDP** | Coturn Relay | TURN relay media packets for cellular carrier CGNAT |
| **3001** | **TCP** | Node Express | Room authorization, token minting, and REST API |
| **5173** | **TCP** | Vite Dev | Local development frontend server |

---

## 4. Mobile Browser (Android Chrome) Behavior

Web applications running in mobile browsers are subject to strict operating system security and power management policies:

1. **Background App Suspension**:
   - When a guest switches away from Chrome or locks the phone, Android OS throttles background JavaScript execution.
   - **Handling**: The app listens to `document.visibilitychange`. When returning to the tab, the app immediately re-evaluates `room.canPlaybackAudio` and the true connection state.
2. **Camera Sensor Revocation**:
   - Android OS security policy immediately suspends the camera sensor when the tab is hidden or minimized.
   - When returning to the app, the local video track automatically resynchronizes.
3. **Autoplay Restrictions**:
   - Mobile browsers prohibit playing non-muted audio unless triggered by a direct user touch gesture.
   - **Handling**: An interactive `AudioUnlockBanner` appears (*"Tap to unlock party audio"*). Tapping it executes `room.startAudio()`.
4. **Touch Dragging & Viewport**:
   - The camera cards support pointer touch dragging with screen bounds clamping.
   - CSS uses `100dvh` to seamlessly adjust as Android Chrome's top address bar expands and collapses.

---

## 5. Local Development Commands

### 1. Start the LiveKit SFU:
```bash
~/.local/bin/livekit-server --dev
```

### 2. Start the Backend API Server:
```bash
cd server
npm run dev
# Running on http://localhost:3001
```

### 3. Start the Frontend Client:
```bash
cd client
npm run dev
# Running on http://localhost:5173
```

---

## 6. Testing & Quality Verification

### Run Automated Backend Security & Reliability Tests:
```bash
cd server
npm test
# Executes 17 automated tests covering authorization, atomic seat claiming, concurrency, and session recovery.
```

### Run Live STUN & TURN Relay Connectivity Probe:
```bash
cd server
npm run test:turn
# Sends binary RFC 5389 STUN packets over UDP, tests DNS, latency, and NAT mapping.
```

### Run Frontend Linter:
```bash
cd client
npm run lint
```

### Build Production Bundles:
```bash
npm run build
# Compiles both server (tsc) and client (tsc -b && vite build) with zero errors.
```

---

## 7. Production Deployment (Docker Compose)

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for complete cloud server setup.

Quick launch summary on your VPS:
```bash
# 1. Clone repository
git clone https://github.com/arav-bishnoi/Together.git /opt/watch-party
cd /opt/watch-party

# 2. Configure environment
cp server/.env.production.example server/.env
nano server/.env
nano Caddyfile
nano turnserver.conf

# 3. Build frontend and start containers
cd client && npm ci && npm run build && cd ..
docker compose -f docker-compose.production.yml up -d --build
```

---

## 8. Troubleshooting Guide

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Guest can't hear tab sound during screen share** | "Also share tab audio" was unchecked in browser dialog | When clicking "Share Screen", ensure you select the **"Chrome Tab"** tab and check the **"Also share tab audio"** box in the bottom left. |
| **Screen turns black on Netflix / Prime** | Hardware DRM protection | DRM prevents capture. Share personal MP4 files in a Chrome tab, YouTube, Vimeo, or web-based streams instead. |
| **No audio on Android guest** | Android Chrome autoplay restriction | Tap the **"Unlock Party Audio"** banner at the top of the screen to permit audio playback. |
| **"Permission Denied" on Camera / Mic** | Browser site settings blocked media | Click the padlock or settings icon in your browser address bar and set Camera and Microphone to **Allow**, then toggle the control button. |
| **Cellular (4G/5G) guest stuck on "Connecting"** | Carrier Symmetric NAT (CGNAT) blocking direct UDP | Configure your TURN server credentials in `server/.env` and verify relay reachability with `cd server && npm run test:turn`. |
| **Camera video goes black when phone is locked** | Android OS hardware privacy suspension | This is enforced by Android OS. Unlocking the phone and returning to Chrome automatically restores camera sync. |
