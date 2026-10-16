import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "prisma/config";
import { isSqliteFileUrl } from "./src/validators/sqlite-url";

const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(envFile)) loadEnvFile(envFile);

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
if (!isSqliteFileUrl(databaseUrl)) {
  throw new Error("DATABASE_URL must be a SQLite file URL.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: `file:${resolve(fileURLToPath(new URL("prisma/", import.meta.url)), databaseUrl.slice(5))}`,
  },
});
