import { PrismaClient } from "@prisma/client";

let _db: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url || url.includes("localhost") || url.startsWith("prisma+postgres")) {
    throw new Error(
      `DATABASE_URL is missing or invalid at runtime (got: ${url ? url.slice(0, 24) + "..." : "undefined"})`
    );
  }

  const { neonConfig } = require("@neondatabase/serverless");
  const { PrismaNeon } = require("@prisma/adapter-neon");

  // Ensure WebSocket support in Node serverless runtimes that lack a global WebSocket
  if (typeof globalThis.WebSocket === "undefined") {
    try {
      neonConfig.webSocketConstructor = require("ws");
    } catch {
      // ws not available; Neon will use global WebSocket if present
    }
  }

  // PrismaNeon takes a PoolConfig object (NOT a Pool instance) and creates
  // its own pool internally from the connection string.
  _db = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: url }),
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });

  return _db;
}

// Named export so existing `import { db }` callers keep working.
export const db = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});
