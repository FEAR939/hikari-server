import { SQL } from "bun";
import { OpenAPIHono } from "@hono/zod-openapi";
import { authMiddleware } from "./authMiddleware";
import fs from "fs/promises";
import path from "path";
import { serveStatic } from "hono/bun";
import * as routes from "./routes.routes";
import { z } from "@hono/zod-openapi";

export default function registerRoutes(app: OpenAPIHono, conn: SQL) {
  // Health check
  app.openapi(routes.healthRoute, async (c) => {
    return c.json({ status: "ok" });
  });

  // Get current user profile
  app.use("/me", authMiddleware);
  app.openapi(routes.getMeRoute, async (c) => {
    const user = c.get("user");
    const userSQL = await conn`
      SELECT id, username, email, avatar, banner
      FROM users
      WHERE id = ${user.id}
      LIMIT 1
    `;
    if (userSQL.length === 0) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json(userSQL[0]);
  });

  // Get user by ID
  app.openapi(routes.getUserRoute, async (c) => {
    const id = Number(c.req.param("id"));
    if (isNaN(id)) {
      return c.json({ error: "Invalid user ID" }, 400);
    }
    try {
      const result = await conn`
        SELECT username, avatar, banner
        FROM users
        WHERE id = ${id};
      `;
      if (result.length === 0) {
        return c.json({ error: "User not found" }, 404);
      }
      return c.json(result[0]);
    } catch (err) {
      console.error("Error fetching user:", err);
      return c.json({ error: "Failed to fetch user media" }, 500);
    }
  });

  // Serve static files
  app.use("/uploads/*", serveStatic({ root: "./" }));

  // Upload photo
  app.use("/upload-photo", authMiddleware);
  app.openapi(routes.uploadPhotoRoute, async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const file = body["file"] as File | undefined;
    const type = Number(body["type"]);

    if (!file) {
      return c.json({ error: "File is required" }, 400);
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return c.json({ error: "File must be under 5MB" }, 400);
    }

    if (![0, 1].includes(type)) {
      return c.json({ error: "Invalid type (must be 0 or 1)" }, 400);
    }

    const folder = type === 0 ? "avatars" : "banners";
    const column = type === 0 ? "avatar" : "banner";
    const uploadDir = path.resolve(`./uploads/${folder}`);
    await fs.mkdir(uploadDir, { recursive: true });

    const fileExt = path.extname(file.name) || ".png";
    const fileName = `${user.id}_${Date.now()}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);

    const existing = await conn`
      SELECT ${conn(column)} FROM users WHERE id = ${user.id}
    `;
    const oldPath = existing[0]?.[column] as string | null;
    if (oldPath) {
      const oldFilePath = path.resolve("." + oldPath);
      try {
        await fs.unlink(oldFilePath);
      } catch (err: any) {
        console.warn("Could not delete old file:", oldFilePath, err.message);
      }
    }

    await Bun.write(filePath, file);

    await conn`
      UPDATE users
      SET ${conn(column)} = ${"/uploads/" + folder + "/" + fileName}
      WHERE id = ${user.id}
    `;

    return c.json({
      message: "Upload successful",
      type: type === 0 ? "avatar" : "banner",
      path: `/uploads/${folder}/${fileName}`,
    });
  });

  // Set leftoff position
  app.use("/set-leftoff-at", authMiddleware);
  app.openapi(routes.setLeftoffRoute, async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const kitsu_id = body.kitsu_id;
    const leftoff = body.leftoff;
    const episode = body.episode;

    await conn`
      INSERT INTO watch_history (user_id, kitsu_id, episode, leftoff, created_at)
      VALUES (${user.id}, ${kitsu_id}, ${episode}, ${leftoff}, NOW())
      ON CONFLICT (user_id, kitsu_id, episode)
      DO UPDATE SET
        episode = ${episode},
        leftoff = ${leftoff},
        created_at = NOW()
    `;

    return c.json({ message: "Success" });
  });

  // Get leftoff positions
  app.use("/get-leftoff-at", authMiddleware);
  app.openapi(routes.getLeftoffRoute, async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const kitsu_id = body.kitsu_id;
    const episode_filter_lower = String(body.episode_filter).split("-")[0];
    const episode_filter_higher = String(body.episode_filter).split("-")[1];

    const leftoff = await conn`
      SELECT *
      FROM watch_history
      WHERE user_id = ${user.id} AND kitsu_id = ${kitsu_id}
    `;

    if (leftoff.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

    const toReturn: any[] = [];
    leftoff.forEach((episode: any) => {
      if (
        episode.episode >= Number(episode_filter_lower) &&
        episode.episode <= Number(episode_filter_higher)
      ) {
        toReturn.push(episode);
      }
    });

    return c.json(toReturn);
  });

  // Get last watched
  app.use("/get-last-watched", authMiddleware);
  app.openapi(routes.getLastWatchedRoute, async (c) => {
    const user = c.get("user");
    try {
      const lastWatched = await conn`
        SELECT DISTINCT ON (kitsu_id) kitsu_id, episode, created_at
        FROM watch_history
        WHERE user_id = ${user.id}
        ORDER BY kitsu_id, created_at DESC
        LIMIT 30
      `;

      const sorted = lastWatched
        .sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
        .slice(0, 10);

      return c.json(sorted);
    } catch (err) {
      console.error("Error fetching last watched:", err);
      return c.json({ error: "Failed to fetch last watched" }, 500);
    }
  });

  // Set bookmark
  app.use("/set-bookmark", authMiddleware);
  app.openapi(routes.setBookmarkRoute, async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const kitsu_id = body.kitsu_id;
    const subscribed = body.subscribed ?? false;
    const notifications = body.notifications ?? false;
    const remove = body.remove ?? false;

    if (!kitsu_id) {
      return c.json({ error: "Missing kitsu_id" }, 400);
    }

    try {
      const existing = await conn`
        SELECT *
        FROM user_bookmarks
        WHERE user_id = ${user.id} AND kitsu_id = ${kitsu_id}
      `;

      if (existing.length === 0) {
        await conn`
          INSERT INTO user_bookmarks (user_id, kitsu_id, subscribed, notifications)
          VALUES (${user.id}, ${kitsu_id}, ${subscribed}, ${notifications})
        `;
      } else if (remove) {
        await conn`
          DELETE FROM user_bookmarks
          WHERE user_id = ${user.id} AND kitsu_id = ${kitsu_id}
        `;
        return c.json({ message: "Bookmark removed" });
      } else {
        await conn`
          UPDATE user_bookmarks
          SET subscribed = ${subscribed}, notifications = ${notifications}
          WHERE user_id = ${user.id} AND kitsu_id = ${kitsu_id}
        `;
      }

      return c.json({ message: "Bookmark saved successfully" });
    } catch (err) {
      console.error("Error saving bookmark:", err);
      return c.json({ error: "Failed to save bookmark" }, 500);
    }
  });

  // Get bookmarks
  app.use("/get-bookmarks", authMiddleware);
  app.openapi(routes.getBookmarksRoute, async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const kitsu_id = body.kitsu_id ?? 0;
    try {
      const bookmarks = await conn`
      SELECT DISTINCT ON (kitsu_id) kitsu_id, subscribed, notifications
      FROM user_bookmarks
      WHERE user_id = ${user.id} ${kitsu_id ? conn`AND kitsu_id = ${kitsu_id}` : conn``}
      ORDER BY kitsu_id, created_at DESC
      `;

      return c.json(bookmarks);
    } catch (err) {
      console.error("Error fetching bookmarks:", err);
      return c.json({ error: "Failed to fetch bookmarks" }, 500);
    }
  });
}
