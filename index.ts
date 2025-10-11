import bun from "bun";
import { SQL } from "bun";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import registerRoutes from "./routes";
import registerAuthRoutes from "./auth";

const SERVER_PORT = process.env.SERVER_PORT;
const HTTPS_CERT_PATH = process.env.HTTPS_CERT_PATH;
const HTTPS_CERT_KEY = process.env.HTTPS_CERT_KEY;

const POSTGRES_USERNAME = process.env.POSTGRES_USERNAME;
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;
const POSTGRES_HOST = process.env.POSTGRES_HOST;
const POSTGRES_PORT = process.env.POSTGRES_PORT;
const POSTGRES_DATABASE = process.env.POSTGRES_DATABASE;

const app = new Hono();
app.use("*", cors({ origin: "*" }));
app.use("*", logger());

async function main() {
  const db = new SQL({
    // Required
    url: `postgres://${POSTGRES_USERNAME}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`,

    bigint: true,

    // Callbacks
    onconnect: (client) => {
      console.log("Connected to database");
    },
    onclose: (client) => {
      console.log("Connection closed");
    },
  });

  const conn = await db.connect();

  registerRoutes(app, conn);
  registerAuthRoutes(app, conn);

  bun.serve({
    port: 5000,
    fetch: app.fetch,
    tls: {
      certFile: `${process.env.HTTPS_CERT_PATH}`,
      keyFile: `${process.env.HTTPS_CERT_KEY}`,
    },
  });
}

main();
