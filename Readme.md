# Sportz — Real-Time Sports Platform

---

## Local Setup

Follow these steps after cloning the repository.

### Prerequisites

- Node.js 18 or newer and npm
- A PostgreSQL database, such as a Neon database
- An Arcjet API key

### 1. Install backend dependencies

From the repository root:

```bash
npm ci
```

Create a root `.env` file from `.env.example` and fill in the required values:

```env
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
ARCJET_KEY="your-arcjet-key"
API_URL="http://localhost:8000"
PORT=8000
HOST=0.0.0.0
ARCJET_MODE=DRY_RUN
```

The sports provider keys are optional. Without them the server still runs — it simply skips live data ingestion and you can use the seed script for local testing.

```env
# Optional — real-time sports data providers
FOOTBALL_DATA_API_KEY="your-football-data-key"
CRIC_API_KEY="your-cricapi-key"
BALLDONTLIE_API_KEY="your-balldontlie-key"
```

### 2. Create the database schema

Run the committed Drizzle migrations from the repository root:

```bash
npm run db:migrate
```

Only run `npm run db:generate` after changing `src/db/schema.js`.

### 3. Install frontend dependencies

In a second terminal:

```bash
cd frontend
npm ci
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL="http://localhost:8000"
VITE_WS_BASE_URL="ws://localhost:8000/ws"
```

### 4. Start the backend

From the repository root:

```bash
npm run dev
```

The REST API runs at `http://localhost:8000` and the WebSocket endpoint at `ws://localhost:8000/ws`.

### 5. Seed local match data

With the backend running, use another terminal from the repository root:

```bash
npm run seed
```

The seed script loads `src/data/data.json` and inserts sample matches and commentary via the REST API. This step is optional when using live sports provider keys.

### 6. Start the frontend

From `frontend`:

```bash
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:3000`. The port is configurable via `VITE_DEV_PORT` in the frontend `.env`.

---

## Tech Stack

```
React 19 + TypeScript  →  Frontend client
Vite                   →  Frontend build tool & dev server
Node.js                →  Runtime
Express 5              →  HTTP layer
PostgreSQL             →  Persistent storage
Drizzle ORM            →  Database schema, migrations & queries
ws                     →  WebSocket library
Zod 4                  →  Request validation
Arcjet                 →  Rate limiting & security (HTTP + WebSocket)
```

---

## Project Structure

```
├── src/
│   ├── index.js                 # Express + HTTP server entry point
│   ├── arcjet.js                # Arcjet shield, bot detection & rate limiting
│   ├── ws/
│   │   └── server.js            # WebSocket server (rooms, heartbeats, broadcast)
│   ├── routes/
│   │   ├── matches.js           # /matches CRUD endpoints
│   │   └── commentary.js        # /matches/:id/commentary endpoints
│   ├── db/
│   │   ├── db.js                # Drizzle client
│   │   └── schema.js            # matches + commentary table schemas
│   ├── validation/
│   │   ├── matches.js           # Zod schemas for match payloads
│   │   └── commnetary.js        # Zod schemas for commentary payloads
│   ├── services/
│   │   └── live-sports-fetcher.js  # Polls 3 sports APIs every 30s
│   ├── utils/
│   │   └── match-status.js      # Match status helper
│   ├── seed/
│   │   └── seed.js              # Seeds DB via REST API
│   └── data/
│       └── data.json            # Sample match & commentary data
├── frontend/
│   ├── App.tsx                  # Main application component
│   ├── components/
│   │   ├── MatchCard.tsx        # Match display card
│   │   ├── LiveFeed.tsx         # Real-time commentary feed
│   │   └── StatusIndicator.tsx  # Match status badge
│   ├── hooks/
│   │   ├── useWebSocket.ts      # WebSocket connection with reconnect
│   │   └── useMatchData.ts      # Match data fetching & state
│   ├── services/
│   │   └── api.ts               # REST API client
│   ├── constants.ts             # API/WS base URLs
│   ├── types.ts                 # TypeScript type definitions
│   └── vite.config.ts           # Vite configuration
└── drizzle/                     # Generated SQL migration files
```

---

## Live Sports Data Ingestion

When sports provider API keys are configured, the server automatically syncs real-world match data:

| Provider                                            | Sport             | Env Variable            |
| --------------------------------------------------- | ----------------- | ----------------------- |
| [Football-Data.org](https://www.football-data.org/) | Football / Soccer | `FOOTBALL_DATA_API_KEY` |
| [CricAPI](https://cricapi.com/)                     | Cricket           | `CRIC_API_KEY`          |
| [Balldontlie](https://www.balldontlie.io/)          | Basketball (NBA)  | `BALLDONTLIE_API_KEY`   |

The sync runs on server boot and every **30 seconds** thereafter. It:

1. Fetches live/recent matches from each provider
2. Inserts new matches into PostgreSQL
3. Updates scores and status for existing matches
4. Broadcasts changes to WebSocket subscribers in real time

Without API keys each fetcher silently returns an empty list — the server works normally with seed data only.

---

## Core Learnings

| #   | Concept                                                   |
| --- | --------------------------------------------------------- |
| 01  | Core mechanics of WebSockets                              |
| 02  | How a WebSocket starts life as HTTP                       |
| 03  | What the `101 Switching Protocols` response actually does |
| 04  | How full-duplex communication lets data flow instantly    |
| 05  | Keeping thousands of connections stable                   |
| 06  | Ghost connections that silently kill servers              |
| 07  | Ping-pong heartbeats                                      |
| 08  | Structuring messages so the server always knows intent    |
| 09  | Broadcast · Unicast · Rooms                               |
| 10  | Pub/Sub architecture                                      |
| 11  | Acknowledgements for reliability                          |
| 12  | How back pressure forms                                   |
| 13  | How real systems avoid memory blow-ups                    |

---

## WebSocket Lifecycle

```
CONNECTING (0) ──→ OPEN (1) ──→ CLOSING (2) ──→ CLOSED (3)
```

A WebSocket doesn't just appear — it negotiates. The client sends a normal HTTP request with an `Upgrade` header, the server replies with `101 Switching Protocols`, and the TCP connection stays open. From that point on, both sides can push data freely — no request/response cycle needed.

---

## Server-Side Events

```
client connects  →  client sends data  →  client disconnects  →  crash
```

### Connection

```js
wss.on("connection", (socket, request) => {
  console.log("Client connected", request.socket.remoteAddress);
});
```

### Receiving Messages

> In `ws`, messages arrive as **Buffers** — always `.toString()` before using them.

```js
socket.on("message", (raw) => {
  const text = raw.toString();
  console.log("Message from client:", text);
});
```

### Error Handling

```js
socket.on("error", (err) => {
  console.log("Error:", err.message);
});
```

---

## Client-Side Events

### Open

```js
socket.addEventListener("open", () => {
  console.log("Connected to server");
  socket.send("Hello Server!");
});
```

### Message

```js
socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  console.log("New Data", data);
});
```

### Close

```js
socket.addEventListener("close", (event) => {
  console.log("Connection closed", event.code, event.reason);
});
```

---

## Quick Reference

### Server (`ws` library)

```js
wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    /* handle incoming */
  });
  ws.on("error", (err) => {
    /* handle error    */
  });
  ws.on("close", (code, reason) => {
    /* handle close    */
  });
});
```

### Client (Browser native WebSocket)

```js
const socket = new WebSocket("ws://localhost:8000/ws");

socket.onopen = () => {
  /* connection established */
};
socket.onmessage = (event) => {
  /* data received         */
};
socket.onerror = (error) => {
  /* something went wrong  */
};
socket.onclose = (event) => {
  /* connection closed     */
};
```

---

## Things That Will Bite You in Production

- **Ghost connections** — clients that disconnect without sending a close frame. The server still holds memory for them. Fix: ping-pong heartbeats on an interval; terminate sockets that don't pong back.
- **Back pressure** — your server pushes faster than the client can consume. Messages queue in memory. Fix: check `socket.bufferedAmount` before sending; implement flow control.
- **Unstructured messages** — if the server can't tell what a message _means_, you'll write `if (msg === 'this')` chains forever. Fix: always send JSON with a `type` field.
- **No rooms/namespaces** — broadcasting everything to everyone doesn't scale. Fix: maintain a `Map` of rooms or move to a pub/sub layer (Redis).

---

## Patterns Worth Knowing

| Pattern              | When to use                                                   |
| -------------------- | ------------------------------------------------------------- |
| **Broadcast**        | Push to every connected client (live feed, announcements)     |
| **Unicast**          | Target one specific socket by ID (DMs, private notifications) |
| **Rooms**            | Group sockets together (chat rooms, game lobbies)             |
| **Pub/Sub**          | Decouple producers and consumers across services (Redis + ws) |
| **Acknowledgements** | Confirm the other side received a critical message            |

---

_Built while learning_
