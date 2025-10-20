import { createRoute } from "@hono/zod-openapi";
import * as schemas from "./auth.schemas";

export const registerRoute = createRoute({
  method: "post",
  path: "/auth/register",
  tags: ["Authentication"],
  summary: "Register a new user",
  description:
    "Creates a new user account and sends an email verification code",
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.RegisterRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.UserSchema,
        },
      },
      description: "User registered successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Bad request - validation error",
    },
    409: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "User already exists",
    },
    500: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Server error",
    },
  },
});

export const sendEmailVerifyRoute = createRoute({
  method: "post",
  path: "/auth/send-email-verify",
  tags: ["Authentication"],
  summary: "Send email verification code",
  description: "Sends a verification code to the provided email address",
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.EmailRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.MessageSchema,
        },
      },
      description: "Verification email sent",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Email is required",
    },
  },
});

export const verifyEmailRoute = createRoute({
  method: "post",
  path: "/auth/verify-email",
  tags: ["Authentication"],
  summary: "Verify email with code",
  description:
    "Verifies a user's email using the 6-digit code sent to their email",
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.VerifyCodeRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.MessageSchema,
        },
      },
      description: "Email verified successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Invalid or expired code",
    },
  },
});

export const loginRoute = createRoute({
  method: "post",
  path: "/auth/login",
  tags: ["Authentication"],
  summary: "Login user",
  description: "Authenticates a user and returns access and refresh tokens",
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.LoginRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.LoginResponseSchema,
        },
      },
      description: "Login successful",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Missing fields",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Invalid credentials or email not verified",
    },
    500: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Server error",
    },
  },
});

export const authenticateRoute = createRoute({
  method: "post",
  path: "/auth/authenticate",
  tags: ["Authentication"],
  summary: "Authenticate with refresh token",
  description: "Validates a refresh token and returns a new access token",
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.RefreshTokenRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.AccessTokenResponseSchema,
        },
      },
      description: "New access token generated",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Missing refresh token",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Invalid or expired refresh token",
    },
    500: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Server error",
    },
  },
});

export const passwordResetCodeRoute = createRoute({
  method: "post",
  path: "/auth/password-reset-code",
  tags: ["Authentication"],
  summary: "Request password reset code",
  description: "Sends a password reset code to the provided email",
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.EmailRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.MessageSchema,
        },
      },
      description: "Reset code sent if email exists",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Email is required",
    },
    500: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Failed to send reset code",
    },
  },
});

export const verifyResetCodeRoute = createRoute({
  method: "post",
  path: "/auth/verify-reset-code",
  tags: ["Authentication"],
  summary: "Verify password reset code",
  description: "Validates the password reset code and returns a reset token",
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.VerifyCodeRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.ResetTokenResponseSchema,
        },
      },
      description: "Code verified, reset token issued",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Invalid or expired code",
    },
  },
});

export const resetPasswordRoute = createRoute({
  method: "post",
  path: "/auth/reset-password",
  tags: ["Authentication"],
  summary: "Reset password",
  description: "Resets user password using the reset token",
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.ResetPasswordRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.MessageSchema,
        },
      },
      description: "Password reset successful",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Missing token/password or password too short",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Invalid or expired token",
    },
  },
});

export const refreshRoute = createRoute({
  method: "post",
  path: "/auth/refresh",
  tags: ["Authentication"],
  summary: "Refresh tokens",
  description:
    "Exchanges an old refresh token for new access and refresh tokens",
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.RefreshTokenRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.RefreshResponseSchema,
        },
      },
      description: "Tokens refreshed successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Missing refresh token",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Invalid or expired refresh token",
    },
    500: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Server error",
    },
  },
});

export const logoutRoute = createRoute({
  method: "post",
  path: "/auth/logout",
  tags: ["Authentication"],
  summary: "Logout user",
  description: "Invalidates the refresh token and logs out the user",
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.RefreshTokenRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.MessageSchema,
        },
      },
      description: "Logged out successfully",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Missing refresh token",
    },
  },
});
