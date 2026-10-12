# Production Deployment Guide: Our Watch Party

This guide explains how to deploy `our-watch-party` to production. It covers architecture options, real-world costs, DNS and firewall setup, exact commands, and cross-network verification.

---

## 1. Practical Deployment Options Comparison

| Option | Architecture | Monthly Cost | Reliability & Privacy | Maintenance Effort |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: Self-Hosted VPS (Recommended)** | 1 Linux VPS running Docker Compose (Caddy + LiveKit + Coturn + Express API + React Frontend) | **~$4 – $6 / month** (Fixed flat rate; e.g. Hetzner CX22 or DigitalOcean $6 Droplet) | **Highest**: 100% open-source, zero 3rd party snooping, 20 TB bandwidth included, permanent infrastructure. | Medium (Initial 10-minute Docker setup). |
| **Option B: Managed LiveKit Cloud + PaaS** | LiveKit Cloud (Media + TURN) + Render (Node API) + Vercel (React Frontend) | **$0 initially**, then variable ($0.15/GB bandwidth after 50 GB/month) | **Good for testing**, but Render free tier sleeps after 15 min inactivity (50s cold boot delay); LiveKit free tier limits bandwidth to 50 GB/mo. | Low (Web dashboards). |
| **Option C: Separately Hosted Static Frontend + Backend + VPS Media** | Vercel (Frontend) + Render (Backend) + VPS (LiveKit/Coturn) | **~$4 – $10 / month** | **Fragmented**: WebRTC media traffic *cannot* run on serverless/static hosts because it requires raw UDP streaming. You still need a VPS for media routing. | High (Managing 3 separate cloud providers). |

---

## 2. Bandwidth & Unavoidable Cost Reality

When building a watch party application with screen sharing and two webcams:
- **Screen Share (1080p, 30 fps)**: ~2.0 Mbps
- **Two Webcams (720p, 30 fps)**: ~1.0 Mbps total
- **Two Audio Streams (Opus 48 kHz)**: ~80 kbps total
- **Total Combined Bitrate**: ~3.1 Mbps ≈ **1.4 GB of data per hour**.

### Why "Free" WebRTC is not permanent:
- **Bandwidth is physical infrastructure**: Free tiers (like LiveKit Cloud's 50 GB/month) cover roughly **35 hours of watching per month**. After that, connections either fail or incur per-gigabyte billing ($0.15/GB).
- **TURN Relay Bandwidth**: When an Android guest connects over mobile 4G/5G data, the phone is behind a Carrier-Grade NAT (CGNAT). Direct peer-to-peer UDP is blocked, so 100% of the stream must pass through a TURN relay. Commercial TURN providers charge $0.05 to $0.40 per GB.
- **The Lowest-Cost Reality**: A **$4–$5/month Linux VPS** (like Hetzner Cloud CX22 at ~€3.80/mo or DigitalOcean at $6/mo) includes **20,000 GB (20 TB)** of monthly bandwidth. This gives you virtually unlimited watch party hours for a fixed, predictable price with zero per-gigabyte surprise bills.

---

## 3. Recommended Architecture: Single-VPS Docker Stack

In the project root, we have prepared a production orchestration stack:

```
                          Internet (Clients)
                                  │
          ┌───────────────────────┴───────────────────────┐
          │ HTTPS (Port 443)                              │ UDP (Ports 3478, 50000-50100)
          ▼                                               ▼
┌────────────────────────┐                     ┌────────────────────────┐
│     Caddy Gateway      │                     │     LiveKit Server     │
│  (Automatic Let's      │                     │   (WebRTC SFU Engine)  │
│   Encrypt TLS / WSS)   │                     └────────────────────────┘
└───────────┬────────────┘                                │
            │                                             │
    ┌───────┴───────┐                                     │
    │               │                                     ▼
    ▼               ▼                          ┌────────────────────────┐
Static Frontend  Express API ◄────────────────►│   Coturn TURN Server   │
(Vite React 19)  (Token Minting)               │ (Cellular NAT Relaying)│
                 (Port 3001)                   └────────────────────────┘
```

1. **Caddy**: Automatic TLS (HTTPS) certificate provisioning via Let's Encrypt, HTTP-to-HTTPS redirection, and WebSocket reverse proxying.
2. **React Frontend**: Served directly by Caddy as static files from `client/dist`.
3. **Express API**: Node.js backend running in Docker, issuing short-lived JWT tokens and enforcing the 2-participant limit.
4. **LiveKit SFU**: Handles video/audio routing over UDP ports `50000:50100`.
5. **Coturn**: Handles carrier NAT traversal over UDP/TCP port `3478` and relay ports `49152:49250`.

---

## 4. Key Concepts Explained for Beginners

### A. Domains and DNS Records
- **Domain**: A human-friendly address (e.g. `yourparty.com`).
- **A Record**: Maps your domain name directly to the public IPv4 address of your VPS.
  - `A @ -> <YOUR_VPS_IP>` (e.g., `party.yourdomain.com`)
  - `A livekit -> <YOUR_VPS_IP>` (e.g., `livekit.yourdomain.com`)
  - `A turn -> <YOUR_VPS_IP>` (e.g., `turn.yourdomain.com`)

### B. TLS / SSL Certificates (HTTPS & WSS)
- WebRTC, microphone, and camera access **strictly require HTTPS**. Browsers (especially Android Chrome) will refuse camera access over plain `http://`.
- Caddy automatically requests, verifies, and renews free Let's Encrypt certificates for your domain on ports 80 and 443. You never need to run `certbot` manually.

### C. Firewall Rules (UFW)
A firewall blocks unauthorized network traffic. WebRTC requires specific ports to be open:
- `80/tcp` and `443/tcp`: Web traffic & HTTPS certificate verification.
- `7880/tcp`: LiveKit WebSocket signalling.
- `7881/tcp`: WebRTC TCP fallback.
- `3478/udp` and `3478/tcp`: STUN/TURN discovery.
- `50000:50100/udp`: Real-time video and audio data packets.
- `49152:49250/udp`: TURN relay packets when direct connection fails.

---

## 5. Step-by-Step Deployment Instructions

### Step 1: Provision a Server
1. Create an account on [Hetzner Cloud](https://www.hetzner.com/cloud) (EU/US, ~€3.80/mo) or [DigitalOcean](https://www.digitalocean.com) ($6/mo Droplet).
2. Create an **Ubuntu 24.04 LTS** server with at least 1 GB RAM (2 GB recommended).
3. Note your server's public IPv4 address (e.g. `123.45.67.89`).

### Step 2: Configure DNS Records
At your domain registrar (Namecheap, Cloudflare, Porkbun, Google Domains):
- Create an `A` record for `party.yourdomain.com` pointing to your server's IP.
- Create an `A` record for `livekit.yourdomain.com` pointing to your server's IP.
- Create an `A` record for `turn.yourdomain.com` pointing to your server's IP.

*(Wait 2–5 minutes for DNS to propagate).*

### Step 3: Install Docker on the Server
SSH into your server:
```bash
ssh root@<YOUR_SERVER_IP>
```
Install Docker and Docker Compose:
```bash
apt-get update && apt-get install -y docker.io docker-compose-v2 ufw git
```

### Step 4: Configure the Firewall
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp          # SSH
ufw allow 80/tcp          # HTTP
ufw allow 443/tcp         # HTTPS
ufw allow 443/udp         # HTTP/3
ufw allow 7880/tcp        # LiveKit Signalling
ufw allow 7881/tcp        # LiveKit TCP fallback
ufw allow 3478/udp        # STUN/TURN UDP
ufw allow 3478/tcp        # STUN/TURN TCP
ufw allow 50000:50100/udp # WebRTC Media Range
ufw allow 49152:49250/udp # Coturn Relay Range
ufw enable
```

### Step 5: Clone the Repository on the Server
```bash
git clone https://github.com/arav-bishnoi/Together.git /opt/watch-party
cd /opt/watch-party
```

### Step 6: Configure Production Secrets
Generate strong random keys on the server:
```bash
openssl rand -hex 24   # Use for LIVEKIT_API_KEY
openssl rand -hex 32   # Use for LIVEKIT_API_SECRET
openssl rand -hex 24   # Use for TURN password
```

Create `server/.env`:
```bash
cp server/.env.production.example server/.env
nano server/.env
```
Fill in your actual domain, generated keys, and public URLs:
```env
NODE_ENV=production
PORT=3001
LIVEKIT_URL=http://livekit:7880
PUBLIC_LIVEKIT_URL=wss://livekit.yourdomain.com
LIVEKIT_API_KEY=<YOUR_GENERATED_KEY>
LIVEKIT_API_SECRET=<YOUR_GENERATED_SECRET>
CLIENT_ORIGIN=https://party.yourdomain.com
TURN_URL=turn:turn.yourdomain.com:3478?transport=udp
TURN_USERNAME=watchparty_guest
TURN_CREDENTIAL=<YOUR_GENERATED_TURN_PASSWORD>
TOKEN_TTL_SECONDS=1800
ROOM_EXPIRY_HOURS=12
```

Update `Caddyfile`:
```bash
nano Caddyfile
# Replace 'party.yourdomain.com' and 'livekit.yourdomain.com' with your real domains
```

Update `turnserver.conf`:
```bash
nano turnserver.conf
# Set realm=turn.yourdomain.com
# Set user=watchparty_guest:<YOUR_GENERATED_TURN_PASSWORD>
```

### Step 7: Build Frontend & Launch Containers
```bash
# Build the client production assets
cd client && npm ci && npm run build && cd ..

# Launch the production stack
docker compose -f docker-compose.production.yml up -d --build
```

### Step 8: Test TURN & STUN Relay
Run the built-in diagnostic tester to verify the TURN server is responding over UDP:
```bash
cd server && npm run test:turn
```

---

## 6. Real-World Verification: Two-Network Test

To verify connectivity between your laptop and Android phone:

1. **Host Setup (Laptop)**:
   - Connect laptop to your **Home Wi-Fi**.
   - Navigate to `https://party.yourdomain.com` in Chrome.
   - Click **"Create Private Party"**.
   - Copy the invitation link.
2. **Guest Setup (Android Phone)**:
   - **Disconnect your phone from Wi-Fi**.
   - Turn on **Mobile Cellular Data (4G or 5G)**.
   - Open the invitation link in Chrome on Android.
   - Enter your name and tap **"Join Watch Party"**.
3. **Check Connection**:
   - Verify that the connection pill in the navbar turns **green** (*"Connected"*).
   - Verify that camera video and audio stream in both directions.
   - Tap **"Unlock Party Audio"** on Android if audio is blocked by browser autoplay policy.
4. **Test Screen Sharing**:
   - On the laptop, click **"Share Screen"** and select a video tab with audio.
   - Verify that the video and tab audio appear on the Android phone theater stage.
   - Drag the camera tile on the Android phone to ensure touch dragging is smooth.
5. **Test Network Interruption**:
   - Toggle Airplane Mode on the Android phone for 5 seconds and turn it back on.
   - Observe the yellow reconnect banner (*"Network interrupted. Attempting to reconnect..."*).
   - Verify that the call automatically recovers or clicking **"Retry Connection"** restores the stream cleanly.
