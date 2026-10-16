import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const temporaryDatabaseDirectory = mkdtempSync(
  join(tmpdir(), "url-shortener-e2e-"),
);
process.env.DATABASE_URL = `file:${join(temporaryDatabaseDirectory, "test.db")}`;
process.once("exit", () =>
  rmSync(temporaryDatabaseDirectory, { recursive: true, force: true }),
);

const engineDirectory = fileURLToPath(
  new URL("../../../../libs/engine/", import.meta.url),
);
execFileSync(
  process.execPath,
  [
    join(engineDirectory, "node_modules/prisma/build/index.js"),
    "migrate",
    "deploy",
  ],
  {
    cwd: engineDirectory,
    env: { ...process.env, RUST_LOG: "info" },
    stdio: "inherit",
  },
);

await import("../../server");
