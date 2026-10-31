import { PrismaClient } from "@prisma/client";

// Ensure DATABASE_URL has connection_limit=1 and pool_timeout in serverless environments
// This prevents Vercel serverless functions from opening 5-10 connections per lambda
// and exhausting Aiven's max_connections limit.
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("connection_limit")) {
  const separator = process.env.DATABASE_URL.includes("?") ? "&" : "?";
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}${separator}connection_limit=1&pool_timeout=15`;
}

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || "";
  if (!url || url.includes("connection_limit")) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}connection_limit=1&pool_timeout=15`;
}

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Always cache the prisma instance in globalThis across all environments
// so warm serverless lambdas reuse the single database connection.
globalForPrisma.prisma = prisma;
