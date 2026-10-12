# Our Watch Party - Phase 1: Project Foundation

A private, modern web application designed for long-distance watch parties.

Phase 1 provides the complete full-stack architecture, configuration, security token infrastructure, health monitoring, and a polished landing page with create-room and join-room flows.

---

## Architecture & Technology Stack

*   **Frontend:** React 19, Vite, TypeScript, CSS (Dark romantic theme with subtle purple accents)
*   **Backend:** Node.js, Express, TypeScript
*   **Security:** Cryptographically secure 128-bit invitation passcodes, strict 2-participant room enforcement, rate limiting, and short-lived tokens
*   **Development Proxy:** Vite proxies `/api/*` directly to the Express backend on `http://127.0.0.1:3001`

---

## Directory Structure

```
watch-party/
├── server/                    # Node.js + Express backend API
│   ├── src/
│   │   ├── config.ts          # Validated environment configuration
│   │   ├── roomManager.ts     # In-memory room security & 2-participant guard
│   │   ├── livekitService.ts  # Token generation & capacity enforcement service
│   │   ├── routes/
│   │   │   └── roomRoutes.ts  # Endpoints: /api/rooms/create, /api/rooms/join, etc.
│   │   └── index.ts           # Express server entry point & /api/health endpoint
│   ├── .env                   # Local environment variables (git-ignored)
│   ├── .env.example           # Placeholder environment template
│   ├── package.json           # Backend dependencies and scripts
│   └── tsconfig.json          # NodeNext TypeScript configuration
├── client/                    # React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── pages/
│   │   │   └── LobbyPage.tsx  # Phase 1 landing page (Create Room & Join Room)
│   │   ├── styles/
│   │   │   └── index.css      # Dark violet design tokens & responsive styles
│   │   ├── types/
│   │   │   └── index.ts       # Shared TypeScript data models
│   │   ├── App.tsx            # Main application component
│   │   └── main.tsx           # React entry point
│   ├── .env.example           # Frontend placeholder template
│   ├── package.json           # Frontend dependencies and scripts
│   ├── tsconfig.json          # Vite TypeScript configuration
│   └── vite.config.ts         # Vite server & /api proxy configuration
├── package.json               # Root convenience scripts
├── .gitignore                 # Excludes node_modules, dist, .env, and logs
└── README.md                  # This documentation
```

---

## Prerequisites

Node.js (v20+ or v22 LTS) is installed in your user environment at `~/.local/node/bin`.

To ensure Node and npm are available in any terminal window, your `~/.bashrc` includes:
```bash
export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$PATH"
```

---

## Exact Commands to Run Phase 1

### Option A: Using Root Convenience Commands (Recommended)

From the project root (`/media/arav/Personal/Programming/watch-party`):

1. **Start the Backend Server (Terminal 1):**
   ```bash
   npm run dev:server
   ```
   *Runs on port `3001`. Logs: `[WatchParty Server] Running on http://0.0.0.0:3001`*

2. **Start the Frontend Application (Terminal 2):**
   ```bash
   npm run dev:client
   ```
   *Runs on port `5173`. Open **[http://localhost:5173](http://localhost:5173)** in your browser.*

---

### Option B: Running Individual Directories

1. **Backend Server:**
   ```bash
   cd /media/arav/Personal/Programming/watch-party/server
   npm install        # (Already installed)
   npm run build      # Compiles TypeScript to dist/
   npm run dev        # Runs dev server with auto-reload
   ```

2. **Frontend Client:**
   ```bash
   cd /media/arav/Personal/Programming/watch-party/client
   npm install        # (Already installed)
   npm run dev -- --host 0.0.0.0 --port 5173
   ```

---

## Verifying the Health Endpoint

To test the backend health check endpoint:

```bash
curl http://localhost:3001/api/health
```

Expected JSON response:
```json
{
  "status": "ok",
  "service": "watch-party-server",
  "version": "1.0.0",
  "uptime": 42,
  "timestamp": "2026-10-12T07:00:50.746Z",
  "environment": "development"
}
```

Because of the Vite proxy, you can also verify it through the frontend server:
```bash
curl http://localhost:5173/api/health
```

---

## Testing the Landing Page (Phase 1)

1. Open **[http://localhost:5173](http://localhost:5173)** in your browser.
2. Under **"Create Room"**, enter your name (e.g. `Arav`) and click **"Create Private Room"**.
3. The server validates the request and displays your **Room Code** and **One-Click Invitation Link**.
4. Click **"Copy Link"** or **"Copy Code"** to verify the clipboard feedback.
5. In an incognito window, paste the copied link (`http://localhost:5173/?room=...&key=...`). The page will automatically switch to the **"Join Room"** tab and pre-fill your room credentials!
6. Enter a guest name (e.g. `Elena`) and click **"Enter Watch Party"** to verify the guest authorization flow.
7. If a 3rd person attempts to join, the server rejects them with a **403 Forbidden** error (*"Watch party is full. Only 2 participants are permitted in this private room."*).
