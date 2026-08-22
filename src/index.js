import "dotenv/config";
import express from "express";
import { matchRouter } from "./routes/matches.js";
import { commentaryRouter } from "./routes/commentary.js";
import http from "http";
import { attachWebSocketServer } from "./ws/server.js";
import { securityMiddleware } from "./arcjet.js";
import { syncLiveSports } from "./services/live-sports-fetcher.js";

process.on("uncaughtException", (err) => {
  console.error("⚠️ [Process uncaughtException]:", err.message);
});

process.on("unhandledRejection", (reason) => {
  console.error("⚠️ [Process unhandledRejection]:", reason);
});

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0";

// Server initialized with WebSocket and REST API
const app = express();

const server = http.createServer(app);

app.use(express.json());

// Enable CORS for frontend requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.get("/", (req, res) => {
  res.send("Sportz Real-Time Sports Server is running.");
});

// Endpoint to trigger live sports sync on demand
app.post("/sync", async (req, res) => {
  try {
    await syncLiveSports(app.locals);
    return res.json({ success: true, message: "Real-world sports feed synchronized successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.use("/matches", matchRouter);
app.use("/matches/:id/commentary", commentaryRouter);

const { broadcastMatchCreated, broadcastCommentary, broadcastScoreUpdate } =
  attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;
app.locals.broadcastScoreUpdate = broadcastScoreUpdate;

server.listen(PORT, HOST, async () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;

  console.log(`🚀 Server is running on ${baseUrl}`);
  console.log(
    `⚡ Web Socket Server is running on ${baseUrl.replace("http", "ws")}/ws`,
  );

  // Initial sync on boot
  syncLiveSports(app.locals).catch((err) => {
    console.error("Initial live sports sync error:", err.message);
  });

  // Background poller every 30 seconds for live matches
  setInterval(() => {
    syncLiveSports(app.locals).catch((err) => {
      console.error("Live sports background sync error:", err.message);
    });
  }, 30000);
});

