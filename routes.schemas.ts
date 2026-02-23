import { z } from "@hono/zod-openapi";

// User Schemas
export const UserProfileSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  avatar: z.string().nullable(),
  banner: z.string().nullable(),
});

export const PublicUserSchema = z.object({
  username: z.string(),
  avatar: z.string().nullable(),
  banner: z.string().nullable(),
});

export const HealthSchema = z.object({
  status: z.string(),
});

export const SuccessSchema = z.object({
  message: z.string(),
});

export const ErrorSchema = z.object({
  error: z.string(),
});

export const MessageSchema = z.object({
  message: z.string(),
});

// Upload Schemas
export const UploadResponseSchema = z.object({
  message: z.string(),
  type: z.enum(["avatar", "banner"]),
  path: z.string(),
});

// Watch History Schemas
export const WatchHistorySchema = z.object({
  user_id: z.number(),
  episode: z.number(),
  leftoff: z.number(),
  kitsu_id: z.number(),
  created_at: z.string().optional(),
});

export const SetLeftoffRequestSchema = z.object({
  kitsu_id: z.string().openapi({ example: "12345" }),
  leftoff: z.string().openapi({ example: "120" }),
  episode: z.string().openapi({ example: "1" }),
});

export const GetLeftoffRequestSchema = z.object({
  kitsu_id: z.string().openapi({ example: "12345" }),
  episode_filter: z.string().openapi({ example: "1-12" }),
});

export const LastWatchedSchema = z.object({
  kitsu_id: z.number(),
  episode: z.number(),
  created_at: z.string(),
});

// Bookmark Schemas
export const BookmarkSchema = z.object({
  kitsu_id: z.number(),
  subscribed: z.boolean(),
  notifications: z.boolean(),
});

export const GetBookmarkRequestSchema = z.object({
  kitsu_id: z.string().optional().openapi({ example: "12345" }),
});

export const SetBookmarkRequestSchema = z.object({
  kitsu_id: z.string().openapi({ example: "12345" }),
  subscribed: z.string().optional().openapi({ example: "true" }),
  notifications: z.string().optional().openapi({ example: "false" }),
  remove: z.string().optional().openapi({ example: "false" }),
});

export const GetNotificationsRequestSchema = z.object({
  user_id: z.number(),
});

export const NotificationSchema = z.object({
  id: z.string().openapi({ example: "uuid" }),
  user_id: z.string().openapi({ example: "uuid" }),
  title: z.string().openapi({ example: "Notification Title" }),
  body: z.string().optional().openapi({ example: "Notification Body" }),
  type: z.string().openapi({ example: "episode.airing" }),
  read: z.boolean().openapi({ example: "false" }),
  created_at: z.string().openapi({ example: "2022-01-01T00:00:00Z" }),
  kitsu_id: z.string().openapi({ example: "1" }),
  anilist_id: z.string().openapi({ example: "1" }),
  episode: z.string().openapi({ example: "1" }),
});

export const GetNotificationsResponseSchema = z.object({
  notifications: z.array(NotificationSchema),
});

export const MarkNotificationsReadRequestSchema = z.object({
  lastsync: z.date().openapi({ example: "2022-01-01T00:00:00Z" }),
});
