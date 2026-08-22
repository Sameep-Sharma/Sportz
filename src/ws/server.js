import WebSocket, { WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet.js";

function sendJson(socket, payload) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadCast(wss, payload) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;

    client.send(JSON.stringify(payload));
  }
}

export function attachWebSocketServer(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", async (socket,req) => {

    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);
        console.log(`Arcjet conclusion: ${decision.conclusion}, isDenied: ${decision.isDenied()}`);
        for (const res of decision.results) {
          console.log(` - Rule [${res.reason?.type}]: ${res.conclusion}`);
        }

        if (decision.isDenied()) {
          const code = decision.reason.isRateLimit() ? 1013 : 1008;
          const reason = decision.reason.isRateLimit()
            ? "Rate limit exceeded"
            : "Forbidden";

          console.log(`Closing socket: ${code} ${reason}`);
          socket.close(code, reason);
          return;
        }
      } catch (err) {
        console.error("Arcjet WebSocket security check failed:", err);
        socket.close(1011, "Internal Server Error");
        return;
      }
    } else {
      console.log("wsArcjet is not defined or null");
    }

    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    sendJson(socket, { type: "welcome" });

    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    (wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      }));
  }, 3000);

  wss.on("close", () => clearInterval(interval));

  function broadCastMatchCreated(match) {
    broadCast(wss, { type: "match_created", data: match });
  }

  return { broadCastMatchCreated };
}
