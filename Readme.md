# ⚡ WebSockets — From Zero to Real-Time
---

## 🧠 Core Learnings

| # | Concept |
|---|---------|
| 01 | Core mechanics of WebSockets |
| 02 | How a WebSocket starts life as HTTP |
| 03 | What the `101 Switching Protocols` response actually does |
| 04 | How full-duplex communication lets data flow instantly |
| 05 | Keeping thousands of connections stable |
| 06 | Ghost connections that silently kill servers |
| 07 | Ping-pong heartbeats |
| 08 | Structuring messages so the server always knows intent |
| 09 | Broadcast · Unicast · Rooms |
| 10 | Pub/Sub architecture |
| 11 | Acknowledgements for reliability |
| 12 | How back pressure forms |
| 13 | How real systems avoid memory blow-ups |

---

## Tech Stack

```
React.js       →  Frontend client
Node.js        →  Runtime
Express.js     →  HTTP layer
PostgreSQL     →  Persistent storage
ws             →  WebSocket library
Arcjet         →  Rate limiting & security
CodeRabbit     →  AI code review
```

---

## WebSocket Lifecycle

```
CONNECTING (0) ──→ OPEN (1) ──→ CLOSING (2) ──→ CLOSED (3)
```

A WebSocket doesn't just appear — it negotiates. The client sends a normal HTTP request with an `Upgrade` header, the server replies with `101 Switching Protocols`, and the TCP connection stays open. From that point on, both sides can push data freely — no request/response cycle needed.

---

##  Server-Side Events

```
client connects  →  client sends data  →  client disconnects  →  crash
```

### Connection

```js
wss.on('connection', (socket, request) => {
  console.log('Client connected', request.socket.remoteAddress);
});
```

### Receiving Messages

> In `ws`, messages arrive as **Buffers** — always `.toString()` before using them.

```js
socket.on('message', (raw) => {
  const text = raw.toString();
  console.log('Message from client:', text);
});
```

### Error Handling

```js
socket.on('error', (err) => {
  console.log('Error:', err.message);
});
```

---

##  Client-Side Events

### Open

```js
socket.addEventListener('open', () => {
  console.log('Connected to server');
  socket.send('Hello Server!');
});
```

### Message

```js
socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('New Data', data);
});
```

### Close

```js
socket.addEventListener('close', (event) => {
  console.log('Connection closed', event.code, event.reason);
});
```

---

##  Quick Reference

### Server (`ws` library)

```js
wss.on('connection', (ws) => {
  ws.on('message', (data)         => { /* handle incoming */ });
  ws.on('error',   (err)          => { /* handle error    */ });
  ws.on('close',   (code, reason) => { /* handle close    */ });
});
```

### Client (Browser native WebSocket)

```js
const socket = new WebSocket('ws://localhost:8080');

socket.onopen    = ()        => { /* connection established */ };
socket.onmessage = (event)   => { /* data received         */ };
socket.onerror   = (error)   => { /* something went wrong  */ };
socket.onclose   = (event)   => { /* connection closed     */ };
```

---

## Things That Will Bite You in Production

- **Ghost connections** — clients that disconnect without sending a close frame. The server still holds memory for them. Fix: ping-pong heartbeats on an interval; terminate sockets that don't pong back.
- **Back pressure** — your server pushes faster than the client can consume. Messages queue in memory. Fix: check `socket.bufferedAmount` before sending; implement flow control.
- **Unstructured messages** — if the server can't tell what a message *means*, you'll write `if (msg === 'this')` chains forever. Fix: always send JSON with a `type` field.
- **No rooms/namespaces** — broadcasting everything to everyone doesn't scale. Fix: maintain a `Map` of rooms or move to a pub/sub layer (Redis).

---

##  Patterns Worth Knowing

| Pattern | When to use |
|---|---|
| **Broadcast** | Push to every connected client (live feed, announcements) |
| **Unicast** | Target one specific socket by ID (DMs, private notifications) |
| **Rooms** | Group sockets together (chat rooms, game lobbies) |
| **Pub/Sub** | Decouple producers and consumers across services (Redis + ws) |
| **Acknowledgements** | Confirm the other side received a critical message |

---

*Built while learning*