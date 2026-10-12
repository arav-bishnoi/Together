# Our Watch Party - Phase 3: Real-Time Audio & Video

A private, modern WebRTC web application designed for long-distance watch parties.

Phase 3 implements real-time two-person audio and video streaming powered by the official LiveKit WebRTC client and server SDKs.

---

## Architecture & Technology Stack

*   **Frontend:** React 19, Vite, TypeScript, `livekit-client`
*   **Backend:** Node.js, Express, TypeScript, `livekit-server-sdk`
*   **Media Server:** Standalone LiveKit Server (`livekit-server --dev`)
*   **Security:** 128-bit invitation credentials, short-lived media JWT tokens, zero secrets in client code, and atomic 2-participant limit enforcement

---

## Networking: Signalling Server vs. Media Server

WebRTC communication involves two distinct networking layers:

1.  **Signalling Server (Control & Coordination):**
    *   Runs over WebSocket (HTTP port `7880`).
    *   Exchanges metadata: room entry passes (JWTs), participant joins/leaves, and SDP (Session Description Protocol) handshakes.
    *   **Does not** carry audio or video bytes; it only sets up the call.

2.  **Media Server / SFU (Selective Forwarding Unit):**
    *   Transfers the actual real-time camera and microphone packets over UDP (`port 7882` / `50000-60000`) and TCP (`port 7881`).
    *   Receives each participant's encrypted video and audio streams and forwards them directly to the other participant with ultra-low latency (< 300ms).

> **Important Internet Networking Note:**
> Testing locally (`localhost` or home Wi-Fi) connects directly because both devices share the same local network. However, a local connection does **not** prove that a public internet deployment is configured correctly.
> When connecting between two different cities across cellular (4G/5G) or NAT firewalls, direct UDP connections are frequently blocked by carriers (Carrier-Grade NAT). In production, a **TURN relay server** (such as LiveKit Cloud's free global relays) is required to route media traffic when direct UDP is blocked.

---

## How to Test with Two Browser Sessions

All three required servers are currently running:
* **Frontend:** `http://localhost:5173`
* **Backend:** `http://localhost:3001`
* **LiveKit Server:** `ws://127.0.0.1:7880`

### Step 1: Open the Host Session (Session 1)
1. Open your browser (e.g. Google Chrome) and go to:
   ```
   http://localhost:5173
   ```
2. In the **"Create Room"** tab, enter your name (e.g. `Arav`) and click **"Create Private Room"**.
3. You will see your created room card with your Room ID and private invitation link.
4. Click **"Copy"** next to the invitation link.
5. Click the purple **"Enter Video Room"** button to enter the live video room as Host.
6. Notice that your camera and microphone start **disabled** (protecting privacy). Click the **Microphone** and **Camera** buttons in the bottom control pill to turn them on!

### Step 2: Open the Guest Session (Session 2)
1. Open a **Private / Incognito window** (or a different browser such as Firefox) so it has its own separate session.
2. Paste the copied invitation link into the address bar.
3. The page automatically switches to the **"Join Room"** tab with your Room ID and Invitation Credential pre-filled!
4. Enter the guest name (e.g. `Elena`) and click **"Enter Watch Party"**.
5. You will enter the live video room as Guest.
6. In the guest window, click the **Microphone** and **Camera** buttons to publish the guest feed.

### Step 3: Verify Real-Time Communication
* **Two-Way Video:** In the host window, you will see the guest's live video in the left frame and your mirrored camera in the right frame. In the guest window, you will see the host's video!
* **Two-Way Audio:** Speaking into the microphone illuminates the green speaking ring on that participant's frame and streams live audio.
* **Mute/Unmute:** Click the microphone button in either window to mute. The other participant's window immediately shows a red muted badge.
* **Camera Toggle:** Turn off your camera. The frame immediately switches to an elegant avatar placeholder showing "Camera is turned off".
* **Leaving & Rejoining:** Click the red **"Leave"** button in one window. The remaining window updates immediately to "Waiting for partner to join...". You can rejoin using the invitation link.
* **Permission Denied Test:** To test permission failures, block camera/microphone in your browser's site settings (click the tune/lock icon next to the URL) and click the camera button. A clear, user-friendly alert will appear explaining that access was denied.

---

## Exact Commands to Start the Project from Scratch

If you ever restart your laptop:

1. **Terminal 1 - Media Server:**
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

4. **Run Automated Test Suite:**
   ```bash
   npm test
   ```
