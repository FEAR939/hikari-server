import { SQL } from "bun";
import { Hono } from "hono";
import { authMiddleware } from "./authMiddleware";

export default function registerRoutes(app: Hono, conn: SQL) {
  app.get("/health", (c) => {
    return c.json({ status: "ok" });
  });

  app.get("/me", authMiddleware, (c) => {
    const user = c.get("user"); // set in middleware
    return c.json(user);
  });
}
