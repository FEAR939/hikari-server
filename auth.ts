import { Hono } from "hono";
import { SQL } from "bun";
import { hash, compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const resend = new Resend(process.env.RESEND_API_KEY);

const resetCodes = new Map<string, { userId: number; email: string; expires: number }>();

export default function registerAuthRoutes(app: Hono, conn: SQL) {
  app.post("/auth/register", async (c) => {
    try {
	  const body = await c.req.parseBody();
	  const username = String(body.username || "");
	  const password = String(body.password || "");
	  const email = String(body.email || "");

	  function validateEmail(email: string): boolean {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
      }

      if (!username || !email || !password) {
        return c.json({ error: "Missing fields" }, 400);
      }

	  if (!validateEmail(email)) {
        return c.json({ error: "Invalid email" }, 400);
	  }

	  if (password.length < 8) {
		return c.json({ error: "Password too short" }, 400);
	  }

	  if (username.length < 4) {
		return c.json({ error: "Username too short" }, 400);
	  }

      const existing = await conn`
        SELECT id FROM users WHERE username = ${username} OR email = ${email};
      `;

      if (existing.length > 0) {
        return c.json({ error: "User already exists" }, 409);
      }

      const password_hashed = await hash(password, 10);

      const result = await conn`
        INSERT INTO users (username, email, password_hashed)
        VALUES (${username}, ${email}, ${password_hashed})
        RETURNING id, username, email, created_at;
      `;

      return c.json(result[0]);
    } catch (err) {
      console.error("Register error:", err.message, err.stack);
      return c.json({ error: "Failed to register user" }, 500);
    }
  });

  app.post("/auth/login", async (c) => {
    try {
	  const body = await c.req.parseBody();
	  const password = String(body.password || "");
	  const email = String(body.email || "");

      if (!email || !password) {
        return c.json({ error: "Missing fields" }, 400);
      }

      const users = await conn`
        SELECT id, username, email, password_hashed FROM users WHERE email = ${email};
      `;

      if (users.length === 0) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      const user = users[0];
      const valid = await compare(password, user.password_hashed);
      if (!valid) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      await conn`
        UPDATE users SET last_login = now() WHERE id = ${user.id};
      `;

      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      return c.json({ token, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
      console.error(err);
      return c.json({ error: "Failed to login" }, 500);
    }
  });

  app.post("/auth/password-reset-code", async (c) => {
    try {
      const body = await c.req.parseBody();
      const email = String(body.email || "");

      if (!email) {
        return c.json({ error: "Email is required" }, 400);
      }

      const users = await conn`
        SELECT id, username, email FROM users WHERE email = ${email};
      `;

      if (users.length === 0) {
        return c.json({ message: "If this email is registered, a code has been sent." });
      }

      const user = users[0];

	  function generateResetCode(length = 8) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let code = "";
        for (let i = 0; i < length; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      }

      const code = generateResetCode();

	  for (const [oldCode, record] of resetCodes.entries()) {
        if (record.userId === user.id && record.expires > Date.now()) {
          resetCodes.delete(oldCode);
        }
      }

      resetCodes.set(code, { userId: user.id, email: user.email, expires: Date.now() + 15 * 60 * 1000 });

      await resend.emails.send({
        from: "onboarding@resend.dev", // TODO: change domain
        to: user.email,
        subject: "Password Reset Code",
        html: `<p>Hello ${user.username},</p>
               <p>Your password reset code is: <b>${code}</b></p>
               <p>This code will expire in 15 minutes.</p>`,
      });

      return c.json({ message: "If this email is registered, a code has been sent." });
    } catch (err) {
      console.error(err);
      return c.json({ error: "Failed to send reset code" }, 500);
    }
  });

  app.post("/auth/reset-password", async (c) => {
    try {
      const body = await c.req.parseBody();
      const code = String(body.code || "");
      const newPassword = String(body.password || "");

      if (!code || !newPassword) {
        return c.json({ error: "Missing code or password" }, 400);
      }

      const record = resetCodes.get(code);

      if (!record || record.expires < Date.now()) {
        return c.json({ error: "Invalid or expired code" }, 400);
      }

      if (newPassword.length < 8) {
        return c.json({ error: "Password too short" }, 400);
      }

      const hashedPassword = await hash(newPassword, 10);

      await conn`
        UPDATE users SET password_hashed = ${hashedPassword} WHERE id = ${record.userId};
      `;

      resetCodes.delete(code);

      return c.json({ message: "Password reset successful" });
    } catch (err) {
      console.error(err);
      return c.json({ error: "Failed to reset password" }, 500);
    }
  });

}
