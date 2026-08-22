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
    noServer: true,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  server.on("upgrade", async (req, socket, head) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    if (requestUrl.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    if (wsArcjet) {
      try {
        const decision = await wsArcjet.protect(req);
        console.log(
          `Arcjet conclusion: ${decision.conclusion}, isDenied: ${decision.isDenied()}`,
        );
        for (const res of decision.results) {
          console.log(` - Rule [${res.reason?.type}]: ${res.conclusion}`);
        }

        if (decision.isDenied()) {
          const statusCode = decision.reason.isRateLimit() ? 429 : 403;
          const reason = decision.reason.isRateLimit()
            ? "Too Many Requests"
            : "Forbidden";

          socket.write(
            `HTTP/1.1 ${statusCode} ${reason}\r\n` +
              "Connection: close\r\n" +
              "Content-Length: 0\r\n" +
              "\r\n",
          );
          socket.destroy();
          return;
        }
      } catch (err) {
        console.error("Arcjet WebSocket security check failed:", err);
        socket.write(
          "HTTP/1.1 503 Service Unavailable\r\n" +
            "Connection: close\r\n" +
            "Content-Length: 0\r\n" +
            "\r\n",
        );
        socket.destroy();
        return;
      }
    } else {
      console.log("wsArcjet is not defined or null");
    }

    wss.handleUpgrade(req, socket, head, (client) => {
      wss.emit("connection", client, req);
    });
  });

  wss.on("connection", (socket, req) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    sendJson(socket, { type: "welcome" });

    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 3000);

  wss.on("close", () => clearInterval(interval));

  function broadCastMatchCreated(match) {
    broadCast(wss, { type: "match_created", data: match });
  }

  return { broadCastMatchCreated };
}
