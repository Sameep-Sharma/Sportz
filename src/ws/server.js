import WebSocket, { WebSocketServer } from "ws";
import { wsArcjet, arcjetMode } from "../arcjet.js";

const matchSubscribers = new Map(); //which sockets are subscribed to which matchId

function subscribeToMatch(socket, matchId) {
  if (!matchSubscribers.has(matchId)) {
    matchSubscribers.set(matchId, new Set());
  }
  matchSubscribers.get(matchId).add(socket);
}

function unsubscribeFromMatch(socket, matchId) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers) return;

  subscribers.delete(socket);

  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }
}

function cleanupSubscriptions(socket) {
  for (const matchId of socket.subscriptions) {
    unsubscribeFromMatch(socket, matchId);
  }
}

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;

    client.send(JSON.stringify(payload));
  }
}

function broadcastToMatch(matchId, payload) {
  const subscribers = matchSubscribers.get(matchId);
  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);
  for (const client of subscribers) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function handleMessage(socket, data) {
  let message;

  try {
    message = JSON.parse(data.toString());
  } catch {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
    return;
  }

  if (!message || typeof message !== "object") return;

  const matchId = Number.parseInt(message.matchId, 10);

  if (message.type === "subscribe" && Number.isInteger(matchId)) {
    subscribeToMatch(socket, matchId);
    socket.subscriptions.add(matchId);
    sendJson(socket, { type: "subscribed", matchId });
    return;
  }

  if (message.type === "unsubscribe" && Number.isInteger(matchId)) {
    unsubscribeFromMatch(socket, matchId);
    socket.subscriptions.delete(matchId);
    sendJson(socket, { type: "unsubscribed", matchId });
    return;
  }

  if (message.type === "setSubscriptions" && Array.isArray(message.matchIds)) {
    for (const rawId of message.matchIds) {
      const id = Number.parseInt(rawId, 10);
      if (Number.isInteger(id)) {
        subscribeToMatch(socket, id);
        socket.subscriptions.add(id);
      }
    }
    sendJson(socket, { type: "subscriptions", matchIds: Array.from(socket.subscriptions) });
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    noServer: true,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  server.on("upgrade", async (req, socket, head) => {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);

    if (pathname !== "/ws") {
      return;
    }

    if (wsArcjet && arcjetMode === "LIVE") {
      try {
        const decision = await wsArcjet.protect(req);

        if (decision.isDenied()) {
          if (decision.reason.isRateLimit()) {
            socket.write("HTTP/1.1 429 Too Many Requests\r\n\r\n");
          } else {
            socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          }
          socket.destroy();
          return;
        }
      } catch (e) {
        console.error("WS upgrade protection error", e);
        socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", async (socket, req) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.subscriptions = new Set();

    sendJson(socket, { type: "welcome" });

    socket.on("message", (data) => {
      handleMessage(socket, data);
    });

    socket.on("error", () => {
      socket.terminate();
    });

    socket.on("close", () => {
      cleanupSubscriptions(socket);
    });

    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  function broadcastMatchCreated(match) {
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  function broadcastCommentary(matchId, comment) {
    broadcastToMatch(matchId, { type: "commentary", data: comment });
  }

  function broadcastScoreUpdate(matchId, score) {
    broadcastToAll(wss, { type: "score_update", matchId, data: score });
    broadcastToMatch(matchId, { type: "score_update", matchId, data: score });
  }

  return { broadcastMatchCreated, broadcastCommentary, broadcastScoreUpdate };
}
