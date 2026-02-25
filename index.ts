import bun from "bun";
import { SQL } from "bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import registerRoutes from "./routes";
import registerAuthRoutes from "./auth";
import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { auth } from "./lib/auth";
import { createNotificationHandler } from "./lib/notifications";

const SERVER_PORT = process.env.SERVER_PORT;
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH;
const HTTPS_CERT_KEY = process.env.HTTPS_CERT_KEY;

const POSTGRES_USERNAME = process.env.POSTGRES_USERNAME;
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;
const POSTGRES_HOST = process.env.POSTGRES_HOST;
const POSTGRES_PORT = process.env.POSTGRES_PORT;
const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE;

const app = new OpenAPIHono();
app.use(
  "/*",
  cors({
    origin: "*", // Allows all origins (use only in development)
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
    credentials: true,
  }),
);

export const customLogger = (message: string, ...rest: string[]) => {
  console.log(`[${new Date().toISOString()}] | ${message}`, ...rest);
};

app.use("*", logger(customLogger));
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

async function main() {
  let POSTGRESQL_CONNECTIONS = 0;

  console.log(
    `postgres://${POSTGRES_USERNAME}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`,
  );
  const db = new SQL({
    // Required
    url: `postgres://${POSTGRES_USERNAME}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`,

    bigint: true,

    // Callbacks
    onconnect: (client) => {
      POSTGRESQL_CONNECTIONS++;
      console.warn(
        `A postgres connection was opened. Connections currently open: ${POSTGRESQL_CONNECTIONS}`,
      );
    },
    onclose: (client) => {
      POSTGRESQL_CONNECTIONS--;
      console.warn(
        `A postgres connection was closed. Connections currently open: ${POSTGRESQL_CONNECTIONS}`,
      );
    },
  });

  const conn = await db.connect();

  registerRoutes(app, conn);
  //registerAuthRoutes(app, conn);

  createNotificationHandler(conn);

  // Add OpenAPI spec endpoint
  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "Hikari API",
      description: "API documentation",
    },
  });

  // Add Scalar documentation UI
  app.get(
    "/docs",
    Scalar({
      url: "/openapi.json",
      theme: "default", // optional: 'default', 'alternate', 'moon', 'purple', 'solarized'
    }),
  );

  bun.serve({
    port: 5000,
    fetch: app.fetch,
    // tls: { // These are needed for HTTPS, only if you don't have a reverse proxy in front of the server
    //   certFile: `${process.env.HTTPS_CERT_PATH}`,
    //   keyFile: `${process.env.HTTPS_CERT_KEY}`,
    // },
  });

  console.log("🚀 Server running on http://0.0.0.0:5000");
  console.log("📚 API Docs available at http://0.0.0.0:5000/docs");
}

main();
