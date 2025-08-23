import { Hono } from "hono";
import { SQL } from "bun";
import { hash, compare } from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const resend = new Resend(process.env.RESEND_API_KEY);

const resetCodes = new Map<string, { userId: number; email: string; expires: number }>();
const verifyCode = new Map<string, { userId: number; email: string; expires: number }>();

function generateCode(length: number) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < length; i++) {
	code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function sendEmailVerification(conn: SQL, email: string) {
  const users = await conn`
    SELECT id, username, email, email_verified FROM users WHERE email = ${email};
  `;

  if (users.length === 0) {
    return { message: "If this email is registered or unverified, a code has been sent." };
  }

  const user = users[0];

  if (user.email_verified === true) {
    return { message: "If this email is registered or unverified, a code has been sent." };
  }

  for (const [oldCode, record] of verifyCode.entries()) {
    if (record.userId === user.id && record.expires > Date.now()) {
      verifyCode.delete(oldCode);
    }
  }

  const code = generateCode(6);

  verifyCode.set(code, {
    userId: user.id,
    email: email,
    expires: Date.now() + 15 * 60 * 1000, // 15 minutes
  });

  // send email
  await resend.emails.send({
    from: "onboarding@resend.dev", // TODO: change domain
    to: email,
    subject: "Verify Your Email",
    html: `<p>Hello ${user.username},</p>
           <p>Your email verification code is <b>${code}</b></p>
           <p>This code will expire in 15 minutes.</p>`,
  });

  return { message: "If this email is registered or unverified, a code has been sent." };
}

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

	  await sendEmailVerification(conn, email);

      return c.json(result[0]);
    } catch (err) {
      console.error("Register error:", err.message, err.stack);
      return c.json({ error: "Failed to register user" }, 500);
    }
  });

  app.post("/auth/send-email-verify", async (c) => {
    const body = await c.req.parseBody();
    const email = String(body.email || "");

    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    const result = await sendEmailVerification(conn, email);
    return c.json(result);
   });

   app.post("/auth/verify-email", async (c) => {
    const body = await c.req.parseBody();
    const code = String(body.code || "");

    const record = verifyCode.get(code);
    if (!record || record.expires < Date.now()) {
      return c.json({ error: "Invalid or expired code" }, 400);
    }

    verifyCode.delete(code);
	console.log(record.userId);
	await conn`
    UPDATE users SET email_verified = true WHERE id = ${record.userId.id};
    `;

    return c.json({
      message: "Email has been verified",
    });
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
        SELECT id, username, email, password_hashed, email_verified FROM users WHERE email = ${email};
      `;

      if (users.length === 0) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

      const user = users[0];
      const valid = await compare(password, user.password_hashed);
      if (!valid) {
        return c.json({ error: "Invalid credentials" }, 401);
      }

	  if (!users.email_verified) {
		return c.json({ error: "Email not verified" }, 401);
	  }

      await conn`
        UPDATE users SET last_login = now() WHERE id = ${user.id};
      `;

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

	  const refreshToken = generateCode(36);

	  await conn`
        UPDATE users SET refresh_token = ${refreshToken}, refresh_token_created = NOW() WHERE id = ${user.id};
      `;

      return c.json({ accessToken, refreshToken, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
      console.error(err);
      return c.json({ error: "Failed to login" }, 500);
    }
  });

  app.post("/auth/authenticate", async (c) => {
    const body = await c.req.parseBody();
    const refreshToken = String(body.refreshToken || "");

    if (!refreshToken) {
      return c.json({ error: "Missing refresh token" }, 400);
    }

    try {
      const users = await conn`
        SELECT id, username, email, refresh_token, refresh_token_created
        FROM users
        WHERE refresh_token = ${refreshToken}
      `;

      if (users.length === 0 || users[0].refresh_token !== refreshToken) {
        return c.json({ error: "Invalid refresh token" }, 401);
      }

      const user = users[0];
      const tokenCreated = new Date(user.refresh_token_created);
      const now = new Date();
	  const timezoneoffset = tokenCreated.getTimezoneOffset();
      tokenCreated.setMilliseconds(tokenCreated.getMilliseconds() + timezoneoffset * 60 * 1000);
      const tokenAgeMinutes = (now.getTime() - tokenCreated.getTime()) / 1000 / 60; // minutes
      const MAX_REFRESH_TOKEN_AGE_MINUTES = 60 * 24 * 90; // 90 days
      if (tokenAgeMinutes > MAX_REFRESH_TOKEN_AGE_MINUTES) {
        return c.json({ error: "Refresh token expired" }, 401);
      }

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      return c.json({ accessToken });
    } catch (err) {
      console.error(err);
      return c.json({ error: "Server error" }, 500);
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
        return c.json({
          message: "If this email is registered, a code has been sent.",
        });
      }

      const user = users[0];

      const code = generateCode(6);

      for (const [oldCode, record] of resetCodes.entries()) {
        if (record.userId === user.id && record.expires > Date.now()) {
          resetCodes.delete(oldCode);
        }
      }

      resetCodes.set(code, {
        userId: user.id,
        email: user.email,
        expires: Date.now() + 15 * 60 * 1000,
      });

      await resend.emails.send({
        from: "onboarding@resend.dev", // TODO: change domain
        to: user.email,
        subject: "Password Reset Code",
        html: `<p>Hello ${user.username},</p>
               <p>Your password reset code is: <b>${code}</b></p>
               <p>This code will expire in 15 minutes.</p>`,
      });

      return c.json({
        message: "If this email is registered, a code has been sent.",
      });
    } catch (err) {
      console.error(err);
      return c.json({ error: "Failed to send reset code" }, 500);
    }
  });

  app.post("/auth/verify-reset-code", async (c) => {
    const body = await c.req.parseBody();
    const code = String(body.code || "");

    const record = resetCodes.get(code);
    if (!record || record.expires < Date.now()) {
      return c.json({ error: "Invalid or expired code" }, 400);
    }

    resetCodes.delete(code);

    const resetToken = jwt.sign(
      { id: record.userId, email: record.email },
      JWT_SECRET,
      { expiresIn: "15m" },
    );

    return c.json({ resetToken });
  });

  app.post("/auth/reset-password", async (c) => {
    const body = await c.req.parseBody();
    const token = String(body.token || "");
    const newPassword = String(body.password || "");

    if (!token || !newPassword)
      return c.json({ error: "Missing token or password" }, 400);

    let payload: { id: number; email: string };
    try {
      payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string };
    } catch (err) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    if (newPassword.length < 8) {
      return c.json({ error: "Password too short" }, 400);
    }

    const hashedPassword = await hash(newPassword, 10);

    await conn`UPDATE users SET password_hashed = ${hashedPassword} WHERE id = ${payload.id}`;

    return c.json({ message: "Password reset successful" });
  });

  app.post("/auth/refresh", async (c) => {
    const body = await c.req.parseBody();
    const oldRefreshToken = String(body.refreshToken || "");

    if (!oldRefreshToken) {
      return c.json({ error: "Missing refresh token" }, 400);
    }

    try {
      const users = await conn`
        SELECT id, username, email, refresh_token, refresh_token_created
        FROM users
        WHERE refresh_token = ${oldRefreshToken}
      `;

      if (users.length === 0 || users[0].refresh_token !== oldRefreshToken) {
        return c.json({ error: "Invalid refresh token" }, 401);
      }

      const user = users[0];
      const tokenCreated = new Date(user.refresh_token_created);
      const now = new Date();
	  const timezoneoffset = tokenCreated.getTimezoneOffset();
      tokenCreated.setMilliseconds(tokenCreated.getMilliseconds() + timezoneoffset * 60 * 1000);
      const tokenAgeMinutes = (now.getTime() - tokenCreated.getTime()) / 1000 / 60; // minutes
      const MAX_REFRESH_TOKEN_AGE_MINUTES = 60 * 24 * 90; // 90 days
      if (tokenAgeMinutes > MAX_REFRESH_TOKEN_AGE_MINUTES) {
        return c.json({ error: "Refresh token expired" }, 401);
      }

      const accessToken = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      const newRefreshToken = generateCode(36);

      await conn`
        UPDATE users
        SET refresh_token = ${newRefreshToken}, refresh_token_created = NOW()
        WHERE id = ${user.id}
      `;

      return c.json({ accessToken, refreshToken: newRefreshToken });
    } catch (err) {
      console.error(err);
      return c.json({ error: "Server error" }, 500);
    }
  });
}
