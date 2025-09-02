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
}
