import { Hono } from "hono";
import { SQL } from "bun";
import { hash, compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const resend = new Resend(process.env.RESEND_API_KEY);

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

  app.post("/auth/password-reset-link", async (c) => {
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
        return c.json({ error: "If this email is registered, a password reset link has been sent." });
      }

      const user = users[0];

      const resetToken = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const resetLink = `https://localhost:5000/reset-password?token=${resetToken}`; // TODO

      await resend.emails.send({
        from: "onboarding@resend.dev", // TODO
        to: user.email,
        subject: "Password Reset Request",
        html: `<p>Hello ${user.username},</p>
               <p>Click <a href="${resetLink}">here</a> to reset your password. This link expires in 1 hour.</p>`,
      });

      return c.json({ message: "If this email is registered, a password reset link has been sent." });
    } catch (err) {
      console.error(err);
      return c.json({ error: "Failed to send password reset email" }, 500);
    }
  });

  app.get("/auth/reset-password", async (c) => { // TODO
    try {
      const body = await c.req.parseBody();
      const token = String(body.token || "");
      const newPassword = String(body.password || "");

      if (!token || !newPassword) {
        return c.json({ error: "Missing token or password" }, 400);
      }

      let payload: { id: number; email: string };
      try {
        payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
      } catch (err) {
        return c.json({ error: "Invalid or expired token" }, 401);
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await conn`
        UPDATE users SET password_hashed = ${hashedPassword} WHERE id = ${payload.id};
      `;

      return c.json({ message: "Password reset successful" });
    } catch (err) {
      console.error(err);
      return c.json({ error: "Failed to reset password" }, 500);
    }
});
}
