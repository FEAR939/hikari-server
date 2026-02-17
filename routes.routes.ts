import { createRoute } from "@hono/zod-openapi";
import * as schemas from "./routes.schemas";
import { z } from "@hono/zod-openapi";

export const healthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Health check",
  description: "Check if the API is running",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.HealthSchema,
        },
      },
      description: "API is healthy",
    },
  },
});

export const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["User"],
  summary: "Get current user profile",
  description: "Returns the authenticated user's profile information",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.UserProfileSchema,
        },
      },
      description: "User profile retrieved",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Unauthorized",
    },
    404: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "User not found",
    },
  },
});

export const getUserRoute = createRoute({
  method: "get",
  path: "/user/{id}",
  tags: ["User"],
  summary: "Get user by ID",
  description: "Returns public profile information for a specific user",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "123" }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.PublicUserSchema,
        },
      },
      description: "User found",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Invalid user ID",
    },
    404: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "User not found",
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

export const uploadPhotoRoute = createRoute({
  method: "post",
  path: "/upload-photo",
  tags: ["User"],
  summary: "Upload avatar or banner",
  description: "Upload a profile avatar (type=0) or banner (type=1) image",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z
              .instanceof(File)
              .openapi({ type: "string", format: "binary" }),
            type: z.string().openapi({
              example: "0",
              description: "0 for avatar, 1 for banner",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: schemas.UploadResponseSchema,
        },
      },
      description: "Upload successful",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Bad request - file missing, too large, or invalid type",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Unauthorized",
    },
  },
});

export const setLeftoffRoute = createRoute({
  method: "post",
  path: "/set-leftoff-at",
  tags: ["Watch History"],
  summary: "Set playback position",
  description: "Records where the user left off watching an episode",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.SetLeftoffRequestSchema,
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
      description: "Leftoff position saved",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Unauthorized",
    },
  },
});

export const getLeftoffRoute = createRoute({
  method: "post",
  path: "/get-leftoff-at",
  tags: ["Watch History"],
  summary: "Get playback positions",
  description: "Retrieves leftoff positions for episodes within a range",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.GetLeftoffRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(schemas.WatchHistorySchema),
        },
      },
      description: "Leftoff positions retrieved",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Unauthorized",
    },
    404: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Not found",
    },
  },
});

export const getLastWatchedRoute = createRoute({
  method: "post",
  path: "/get-last-watched",
  tags: ["Watch History"],
  summary: "Get last watched anime",
  description: "Returns the last 10 unique anime the user has watched",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(schemas.LastWatchedSchema),
        },
      },
      description: "Last watched anime retrieved",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Unauthorized",
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

export const setBookmarkRoute = createRoute({
  method: "post",
  path: "/set-bookmark",
  tags: ["Bookmarks"],
  summary: "Set or update bookmark",
  description: "Add, update, or remove an anime bookmark",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.SetBookmarkRequestSchema,
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
      description: "Bookmark saved or removed",
    },
    400: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Missing kitsu_id",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Unauthorized",
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

export const getBookmarksRoute = createRoute({
  method: "post",
  path: "/get-bookmarks",
  tags: ["Bookmarks"],
  summary: "Get user bookmarks",
  description: "Returns all or specific bookmarked anime for the user",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: schemas.GetBookmarkRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(schemas.BookmarkSchema),
        },
      },
      description: "Bookmarks retrieved",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Unauthorized",
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

export const getNotificationsRoute = createRoute({
  method: "post",
  path: "/get-notifications",
  tags: ["Notifications"],
  summary: "Get user notifications",
  description: "Returns all notifications for the user",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(schemas.NotificationSchema),
        },
      },
      description: "Notifications retrieved",
    },
    401: {
      content: {
        "application/json": {
          schema: schemas.ErrorSchema,
        },
      },
      description: "Unauthorized",
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
