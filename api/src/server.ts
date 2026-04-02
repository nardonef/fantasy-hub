import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { clerkMiddleware } from "./middleware/auth";
import leagueRoutes from "./routes/leagues";
import analyticsRoutes from "./routes/analytics";
import managerRoutes from "./routes/managers";
import activityRoutes from "./routes/activity";
import yahooAuthRoutes from "./routes/yahoo-auth";
import insightsRoutes from "./routes/insights";
import chatRoutes from "./routes/chat";
import { startSyncWorker } from "./jobs/sync-league";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const DEV_MODE = process.env.NODE_ENV === "development" && process.env.CLERK_SECRET_KEY?.includes("PLACEHOLDER");

// Middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
if (!DEV_MODE) {
  app.use(clerkMiddleware());
} else {
  console.log("⚠️  DEV MODE: Clerk auth bypassed (placeholder keys detected)");
}


// Routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/leagues", leagueRoutes);
app.use("/api/leagues", analyticsRoutes);
app.use("/api/leagues", managerRoutes);
app.use("/api/leagues", activityRoutes);
app.use("/api/leagues", insightsRoutes);
app.use("/api/leagues", chatRoutes);
app.use("/api/auth", yahooAuthRoutes);

// Start HTTP server (for iOS app and general use)
app.listen(PORT, () => {
  console.log(`Fantasy Hub API running on http://localhost:${PORT}`);
});

// Also start HTTPS server on port 3443 for Yahoo OAuth callback (requires browser trust)
const certPath = path.resolve(__dirname, "../certs/localhost+1.pem");
const keyPath = path.resolve(__dirname, "../certs/localhost+1-key.pem");
const HTTPS_PORT = 3443;

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const httpsServer = https.createServer(
    { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) },
    app
  );
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`Fantasy Hub API (HTTPS) running on https://localhost:${HTTPS_PORT}`);
  });
}

// Start background sync worker
startSyncWorker();
console.log("Sync worker started");
