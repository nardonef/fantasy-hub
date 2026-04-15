/**
 * Creates a minimal Express app for route integration tests.
 * Auth middleware is bypassed — callers inject req.dbUser via vi.mock.
 * Workers and cron are NOT started.
 */
import express from "express";
import feedRoutes from "../routes/feed";
import playerRoutes from "../routes/players";

export function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/leagues", feedRoutes);
  app.use("/api/players", playerRoutes);
  return app;
}
