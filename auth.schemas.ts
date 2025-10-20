import { z } from "@hono/zod-openapi";

// Response Schemas
export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  created_at: z.string().optional(),
});

export const ErrorSchema = z.object({
  error: z.string(),
});

export const MessageSchema = z.object({
  message: z.string(),
});

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  user: UserSchema,
});

export const AccessTokenResponseSchema = z.object({
  accessToken: z.string(),
});

export const ResetTokenResponseSchema = z.object({
  resetToken: z.string(),
});

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

// Request Schemas
export const RegisterRequestSchema = z.object({
  username: z.string().min(4).openapi({ example: "johndoe" }),
  email: z.string().email().openapi({ example: "john@example.com" }),
  password: z.string().min(8).openapi({ example: "password123" }),
});

export const LoginRequestSchema = z.object({
  email: z.string().email().openapi({ example: "john@example.com" }),
  password: z.string().openapi({ example: "password123" }),
});

export const EmailRequestSchema = z.object({
  email: z.string().email().openapi({ example: "john@example.com" }),
});

export const VerifyCodeRequestSchema = z.object({
  code: z.string().length(6).openapi({ example: "ABC123" }),
});

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().openapi({ example: "abc123xyz..." }),
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string(),
  password: z.string().min(8).openapi({ example: "newpassword123" }),
});
