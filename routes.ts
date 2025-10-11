import { SQL } from "bun";
import { Hono } from "hono";
import { authMiddleware } from "./authMiddleware";
import fs from "fs/promises";
import path from "path";
import { serveStatic } from "hono/bun";

export default function registerRoutes(app: Hono, conn: SQL) {
  app.get("/health", async (c) => {
    return c.json({ status: "ok" });
  });

  app.use("/me", authMiddleware);
  app.get("/me", async (c) => {
    const user = c.get("user"); // set in middleware

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

  app.get("/user/:id", async (c) => {
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


  app.use("/uploads/*", serveStatic({ root: "./" }));
  app.use("/upload-photo", authMiddleware);
  app.post("/upload-photo", async (c) => {
    const user = c.get("user");

    const body = await c.req.parseBody();
    const file = body["file"] as File | undefined;
    const type = Number(body["type"]); // 0 - Avatar, 1 - Banner

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
      } catch (err) {
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

  app.use("/set-leftoff-at", authMiddleware);
  app.post("/set-leftoff-at", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();

	const anilist_id = body.anilist_id;
	const leftoff = body.leftoff;
	const episode = body.episode;

	const watch_history = await conn`
        SELECT *
        FROM watch_history
        WHERE user_id = ${user.id} AND anilist_id = ${anilist_id} AND episode = ${episode}
      `;

    if (watch_history.length === 0) {
       await conn`
        INSERT INTO watch_history (user_id, episode, leftoff, anilist_id)
        VALUES (${user.id}, ${episode}, ${leftoff}, ${anilist_id})
      `;
    }
	else {
	  await conn`
        UPDATE watch_history SET leftoff = ${leftoff} WHERE user_id = ${user.id} AND anilist_id = ${anilist_id} AND episode = ${episode};
      `;
	}

	return c.json({
		message: "Success"
	});
  });

  app.use("/get-leftoff-at", authMiddleware);
  app.post("/get-leftoff-at", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();

	const anilist_id = body.anilist_id;
	const episode_filter_lower = String(body.episode_filter).split("-")[0];
	const episode_filter_higher = String(body.episode_filter).split("-")[1];

	const leftoff = await conn`
        SELECT *
        FROM watch_history
        WHERE user_id = ${user.id} AND anilist_id = ${anilist_id}
      `;

    if (leftoff.length === 0) {
      return c.json({ error: "Not found" }, 404);
    }

	var toReturn = [];

	leftoff.forEach(episode => {
		if (episode.episode >= Number(episode_filter_lower) && episode.episode <= Number(episode_filter_higher))
			toReturn.push(episode);
	});

    return c.json(toReturn);
  });

  app.use("/get-last-watched", authMiddleware);
  app.post("/get-last-watched", async (c) => {
    const user = c.get("user");

    try {
      const lastWatched = await conn`
        SELECT DISTINCT ON (anilist_id) anilist_id, episode, created_at
        FROM watch_history
        WHERE user_id = ${user.id}
        ORDER BY anilist_id, created_at DESC
        LIMIT 50
      `;

      const sorted = lastWatched
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      return c.json(sorted);
    } catch (err) {
      console.error("Error fetching last watched:", err);
      return c.json({ error: "Failed to fetch last watched" }, 500);
  }
  });
}
